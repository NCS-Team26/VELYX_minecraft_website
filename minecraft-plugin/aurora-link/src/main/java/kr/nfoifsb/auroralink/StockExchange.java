package kr.nfoifsb.auroralink;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import net.milkbowl.vault.economy.Economy;
import net.milkbowl.vault.economy.EconomyResponse;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.scheduler.BukkitTask;

public final class StockExchange {
  private final AuroraLinkPlugin plugin;
  private final Gson gson = new GsonBuilder().setPrettyPrinting().create();
  private final SecureRandom random = new SecureRandom();
  private final Path dataPath;

  private StoredData data = new StoredData();
  private Map<String, StockDefinition> definitions = new LinkedHashMap<>();
  private BukkitTask tickerTask;
  private boolean enabled;
  private int tickSeconds;
  private int candleSeconds;
  private int historyHours;
  private int maxCandles;
  private int maxTrades;
  private int maxOrderShares;
  private double feeRate;
  private double spreadRate;
  private double priceImpact;

  public StockExchange(AuroraLinkPlugin plugin) {
    this.plugin = plugin;
    this.dataPath = plugin.getDataFolder().toPath().resolve("stocks.json");
  }

  public void start() {
    refreshSettings();
    load();
    bootstrapStocks();
    synchronized (this) {
      advanceToNow();
      save();
    }

    if (!enabled) {
      plugin.getLogger().info("AuroraLink stock exchange is disabled.");
      return;
    }

    long periodTicks = Math.max(20L, tickSeconds * 20L);
    tickerTask = Bukkit.getScheduler().runTaskTimerAsynchronously(plugin, this::tickSafely, periodTicks, periodTicks);
    plugin.getLogger().info("AuroraLink 24H stock exchange started with " + definitions.size() + " symbols.");
  }

  public void stop() {
    if (tickerTask != null) {
      tickerTask.cancel();
      tickerTask = null;
    }
    synchronized (this) {
      save();
    }
  }

  public boolean isEnabled() {
    return enabled;
  }

  public synchronized Map<String, Object> marketSnapshot() {
    ensureEnabled();
    advanceToNow();
    save();

    List<Map<String, Object>> stocks = data.stocks.values().stream()
        .map(this::stockPayload)
        .toList();

    double marketCap = 0.0;
    long volume24h = 0L;
    double index = 0.0;
    double openIndex = 0.0;
    for (StockState stock : data.stocks.values()) {
      StockDefinition definition = definitionFor(stock.symbol);
      marketCap += stock.currentPrice * definition.outstandingShares;
      volume24h += volume24h(stock);
      index += stock.currentPrice;
      openIndex += open24h(stock);
    }

    Map<String, Object> market = new LinkedHashMap<>();
    market.put("index", roundMoney(index * 10.0));
    market.put("indexChange24h", percentChange(index, openIndex));
    market.put("volume24h", volume24h);
    market.put("marketCap", roundMoney(marketCap));
    market.put("session", "24H LIVE");
    market.put("updatedAt", Instant.now().toString());

    Map<String, Object> response = new LinkedHashMap<>();
    response.put("ok", true);
    response.put("market", market);
    response.put("stocks", stocks);
    response.put("recentTrades", recentTradesPayload(14));
    return response;
  }

  public synchronized Map<String, Object> portfolioSnapshot(LinkStore.LinkedPlayer link) {
    ensureEnabled();
    advanceToNow();
    Map<String, Integer> holdings = holdingsFor(link.uuid);
    Map<String, Double> averages = averagesFor(link.uuid);
    List<Map<String, Object>> positions = new ArrayList<>();
    double totalValue = 0.0;

    for (StockState stock : data.stocks.values()) {
      int shares = holdings.getOrDefault(stock.symbol, 0);
      double value = roundMoney(stock.currentPrice * shares);
      totalValue += value;

      Map<String, Object> position = new LinkedHashMap<>();
      position.put("symbol", stock.symbol);
      position.put("name", stock.name);
      position.put("shares", shares);
      position.put("price", roundMoney(stock.currentPrice));
      position.put("value", value);
      position.put("averageCost", roundMoney(averages.getOrDefault(stock.symbol, 0.0)));
      position.put("change24h", percentChange(stock.currentPrice, open24h(stock)));
      positions.add(position);
    }

    Map<String, Object> response = new LinkedHashMap<>();
    response.put("ok", true);
    response.put("nickname", link.nickname);
    response.put("uuid", link.uuid);
    response.put("balance", roundMoney(balanceOf(link)));
    response.put("portfolioValue", roundMoney(totalValue));
    response.put("positions", positions);
    response.put("updatedAt", Instant.now().toString());
    return response;
  }

  public synchronized Map<String, Object> trade(LinkStore.LinkedPlayer link, Map<String, Object> body) {
    ensureEnabled();
    Economy economy = requireEconomy();
    advanceToNow();

    String symbol = LinkStore.value(body.get("symbol"), "").trim().toUpperCase(Locale.ROOT);
    String side = LinkStore.value(body.get("side"), "").trim().toLowerCase(Locale.ROOT);
    int quantity = readInt(body.get("quantity"), 0);

    if (!"buy".equals(side) && !"sell".equals(side)) {
      throw new StockException(400, "side must be buy or sell.");
    }
    if (quantity <= 0) {
      throw new StockException(400, "quantity must be greater than 0.");
    }
    if (quantity > maxOrderShares) {
      throw new StockException(400, "quantity cannot exceed " + maxOrderShares + " shares per order.");
    }

    StockState stock = data.stocks.get(symbol);
    if (stock == null) {
      throw new StockException(404, "Unknown stock symbol: " + symbol);
    }

    StockDefinition definition = definitionFor(symbol);
    Map<String, Integer> holdings = holdingsFor(link.uuid);
    Map<String, Double> averages = averagesFor(link.uuid);
    int owned = holdings.getOrDefault(symbol, 0);
    boolean buy = "buy".equals(side);
    if (!buy && owned < quantity) {
      throw new StockException(409, "Not enough shares to sell. Current holding: " + owned);
    }

    double direction = buy ? 1.0 : -1.0;
    double basePrice = Math.max(0.01, stock.currentPrice);
    double impact = direction * Math.log1p(quantity / Math.max(1.0, definition.liquidity)) * priceImpact;
    double executionPrice = clampMoney(basePrice * (1.0 + direction * spreadRate + impact * 0.5), definition);
    double total = roundMoney(executionPrice * quantity);
    double fee = roundMoney(total * feeRate);
    OfflinePlayer player = offlinePlayer(link);

    if (buy) {
      double cost = roundMoney(total + fee);
      if (economy.getBalance(player) + 0.0001 < cost) {
        throw new StockException(409, "Not enough server money. Required: " + cost);
      }
      EconomyResponse response = economy.withdrawPlayer(player, cost);
      if (!response.transactionSuccess()) {
        throw new StockException(409, response.errorMessage == null ? "Money withdrawal failed." : response.errorMessage);
      }

      double oldAverage = averages.getOrDefault(symbol, 0.0);
      int nextShares = owned + quantity;
      double nextAverage = ((oldAverage * owned) + (executionPrice * quantity)) / nextShares;
      holdings.put(symbol, nextShares);
      averages.put(symbol, roundMoney(nextAverage));
    } else {
      double payout = roundMoney(total - fee);
      EconomyResponse response = economy.depositPlayer(player, payout);
      if (!response.transactionSuccess()) {
        throw new StockException(409, response.errorMessage == null ? "Money deposit failed." : response.errorMessage);
      }

      int nextShares = owned - quantity;
      if (nextShares <= 0) {
        holdings.remove(symbol);
        averages.remove(symbol);
      } else {
        holdings.put(symbol, nextShares);
      }
    }

    long now = System.currentTimeMillis();
    stock.currentPrice = clampMoney(basePrice * (1.0 + impact), definition);
    updateCandle(stock, now, stock.currentPrice, quantity, 1);

    Trade trade = new Trade();
    trade.id = now + "-" + symbol + "-" + link.uuid.substring(0, Math.min(8, link.uuid.length()));
    trade.symbol = symbol;
    trade.name = stock.name;
    trade.side = side;
    trade.playerName = link.nickname;
    trade.uuid = link.uuid;
    trade.quantity = quantity;
    trade.price = executionPrice;
    trade.total = total;
    trade.fee = fee;
    trade.at = now;
    data.trades.add(trade);
    trimTrades();
    save();

    maybeBroadcastTrade(trade);

    Map<String, Object> response = new LinkedHashMap<>();
    response.put("ok", true);
    response.put("message", link.nickname + " " + symbol + " " + (buy ? "buy" : "sell") + " filled.");
    response.put("trade", tradePayload(trade));
    response.put("position", positionPayload(stock, holdings.getOrDefault(symbol, 0), averages.getOrDefault(symbol, 0.0)));
    response.put("balance", roundMoney(economy.getBalance(player)));
    response.put("market", marketSnapshot());
    return response;
  }

  private void refreshSettings() {
    enabled = plugin.getConfig().getBoolean("stock-market.enabled", true);
    tickSeconds = Math.max(10, plugin.getConfig().getInt("stock-market.tick-seconds", 60));
    candleSeconds = Math.max(tickSeconds, plugin.getConfig().getInt("stock-market.candle-seconds", 900));
    historyHours = Math.max(1, plugin.getConfig().getInt("stock-market.history-hours", 24));
    maxCandles = Math.max(8, (int) Math.ceil((historyHours * 3600.0) / candleSeconds) + 2);
    maxTrades = Math.max(10, plugin.getConfig().getInt("stock-market.max-trades", 160));
    maxOrderShares = Math.max(1, plugin.getConfig().getInt("stock-market.max-order-shares", 500));
    feeRate = clamp(plugin.getConfig().getDouble("stock-market.fee-rate", 0.003), 0.0, 0.1);
    spreadRate = clamp(plugin.getConfig().getDouble("stock-market.spread-rate", 0.0015), 0.0, 0.05);
    priceImpact = clamp(plugin.getConfig().getDouble("stock-market.price-impact", 0.055), 0.0, 0.5);
    definitions = readDefinitions();
  }

  private void load() {
    try {
      Files.createDirectories(dataPath.getParent());
      if (!Files.exists(dataPath)) {
        data = new StoredData().ensure();
        save();
        return;
      }
      try (Reader reader = Files.newBufferedReader(dataPath, StandardCharsets.UTF_8)) {
        StoredData loaded = gson.fromJson(reader, StoredData.class);
        data = loaded == null ? new StoredData().ensure() : loaded.ensure();
      }
    } catch (IOException error) {
      plugin.getLogger().severe("Failed to load AuroraLink stock data: " + error.getMessage());
      data = new StoredData().ensure();
    }
  }

  private void save() {
    try {
      Files.createDirectories(dataPath.getParent());
      try (Writer writer = Files.newBufferedWriter(dataPath, StandardCharsets.UTF_8)) {
        gson.toJson(data.ensure(), writer);
      }
    } catch (IOException error) {
      plugin.getLogger().severe("Failed to save AuroraLink stock data: " + error.getMessage());
    }
  }

  private void bootstrapStocks() {
    data.ensure();
    long now = System.currentTimeMillis();
    boolean repairedHistory = false;
    for (StockDefinition definition : definitions.values()) {
      StockState stock = data.stocks.get(definition.symbol);
      if (stock == null) {
        stock = new StockState();
        stock.symbol = definition.symbol;
        stock.currentPrice = definition.startPrice;
        stock.createdAt = now;
        data.stocks.put(definition.symbol, stock);
      }
      stock.name = definition.name;
      if (stock.currentPrice <= 0) stock.currentPrice = definition.startPrice;
      if (stock.candles == null || stock.candles.isEmpty()) {
        seedStockHistory(stock, definition, now);
        repairedHistory = true;
      } else if (shouldRepairStockHistory(stock, definition)) {
        seedStockHistory(stock, definition, now);
        repairedHistory = true;
      }
    }
    if (repairedHistory) data.lastAdvancedAt = now;
    data.stocks.keySet().removeIf(symbol -> !definitions.containsKey(symbol));
    trimTrades();
  }

  private void tickSafely() {
    try {
      synchronized (this) {
        if (!enabled) return;
        advanceToNow();
        save();
      }
    } catch (RuntimeException error) {
      plugin.getLogger().warning("AuroraLink stock ticker failed: " + error.getMessage());
    }
  }

  private void advanceToNow() {
    long now = System.currentTimeMillis();
    long step = tickSeconds * 1000L;
    long last = data.lastAdvancedAt > 0 ? Math.min(data.lastAdvancedAt, now) : now;
    int ticks = (int) Math.min(2000, Math.max(0L, (now - last) / step));
    long tickAt = last;
    for (int index = 0; index < ticks; index += 1) {
      tickAt += step;
      for (StockState stock : data.stocks.values()) {
        advanceStock(stock, definitionFor(stock.symbol), tickAt);
      }
      data.lastAdvancedAt = tickAt;
    }

    if (data.lastAdvancedAt <= 0) data.lastAdvancedAt = now;
    pruneAll();
  }

  private void advanceStock(StockState stock, StockDefinition definition, long at) {
    double price = Math.max(0.01, stock.currentPrice);
    double minutes = at / 60000.0;
    double cycle = Math.sin((minutes + definition.symbol.hashCode()) * definition.cycleSpeed) * definition.volatility * 0.48;
    double marketSwing =
        Math.sin((minutes * definition.cycleSpeed * 0.52) + definition.symbol.hashCode() * 0.013)
            * definition.volatility
            * 0.28;
    double technicalBreakout =
        Math.sin((minutes * definition.cycleSpeed * 2.4) + price * 0.0007)
            * definition.volatility
            * 0.20;
    double anchor = ((definition.startPrice - price) / definition.startPrice) * definition.meanReversion * 1.65;
    double noise = random.nextGaussian() * definition.volatility * 0.72;
    double change = clamp(noise + cycle + marketSwing + technicalBreakout + anchor, -definition.maxTickMove, definition.maxTickMove);
    double nextPrice = clampMoney(price * (1.0 + change), definition);
    stock.currentPrice = nextPrice;
    long ambientVolume = ambientMarketVolume(definition, change, at);
    int ambientTrades = Math.max(1, (int) Math.round(ambientVolume / Math.max(35.0, definition.liquidity * 0.018)));
    updateCandle(stock, at, nextPrice, ambientVolume, ambientTrades);
  }

  private long ambientMarketVolume(StockDefinition definition, double change, long at) {
    double minutes = at / 60000.0;
    double rhythm = 0.5 + 0.5 * Math.abs(Math.sin(minutes * definition.cycleSpeed * 3.1 + definition.symbol.hashCode()));
    double activity = 0.004 + Math.abs(change) * 1.15 + definition.volatility * 0.32 + rhythm * 0.006;
    return Math.max(1L, Math.round(definition.liquidity * activity));
  }

  private boolean shouldRepairStockHistory(StockState stock, StockDefinition definition) {
    pruneCandles(stock);
    if (stock.candles == null || stock.candles.size() < 4) return true;
    long volume = 0L;
    double high = 0.0;
    double low = Double.MAX_VALUE;
    for (Candle candle : stock.candles) {
      volume += Math.max(0L, candle.volume);
      high = Math.max(high, candle.high);
      low = Math.min(low, candle.low);
    }
    if (volume <= 0L) return true;
    if (low <= 0.0 || high <= 0.0) return true;
    double range = (high - low) / Math.max(1.0, definition.startPrice);
    double maxHealthyRange = Math.max(0.34, definition.volatility * 36.0);
    return range > maxHealthyRange;
  }

  private void seedStockHistory(StockState stock, StockDefinition definition, long now) {
    int targetCount = Math.max(24, Math.min(maxCandles, (historyHours * 3600) / Math.max(1, candleSeconds)));
    long candleMillis = candleSeconds * 1000L;
    long end = alignCandle(now);
    long start = end - (long) (targetCount - 1) * candleMillis;
    double guard = clamp(definition.volatility * 13.0, 0.10, 0.15);
    double targetPrice = clamp(stock.currentPrice, definition.startPrice * (1.0 - guard), definition.startPrice * (1.0 + guard));
    double startPrice = definition.startPrice * (1.0 - guard * 0.18);
    double previousClose = roundMoney(startPrice);
    List<Candle> candles = new ArrayList<>();

    for (int index = 0; index < targetCount; index += 1) {
      long at = start + (long) index * candleMillis;
      double progress = targetCount <= 1 ? 1.0 : (double) index / (double) (targetCount - 1);
      double path = startPrice + (targetPrice - startPrice) * progress;
      double wave = Math.sin(index * 0.47 + definition.symbol.hashCode() * 0.011) * definition.volatility * 4.7;
      double chop = Math.sin(index * 1.31 + definition.symbol.hashCode() * 0.017) * definition.volatility * 1.9;
      double close = index == targetCount - 1 ? targetPrice : clampMoney(path * (1.0 + wave + chop), definition);
      double open = previousClose;
      double change = (close - open) / Math.max(1.0, open);
      double wick = Math.max(
          definition.startPrice * 0.004,
          Math.abs(close - open) * 0.34 + definition.startPrice * definition.volatility * (0.65 + random.nextDouble() * 0.85));
      Candle candle = new Candle();
      candle.startedAt = at;
      candle.open = roundMoney(open);
      candle.high = roundMoney(Math.max(open, close) + wick);
      candle.low = roundMoney(Math.max(0.01, Math.min(open, close) - wick * 0.82));
      candle.close = roundMoney(close);
      candle.volume = ambientMarketVolume(definition, change, at) * Math.max(1, candleSeconds / Math.max(1, tickSeconds));
      candle.trades = Math.max(1, (int) Math.round(candle.volume / Math.max(35.0, definition.liquidity * 0.018)));
      candles.add(candle);
      previousClose = candle.close;
    }

    stock.currentPrice = candles.get(candles.size() - 1).close;
    if (stock.createdAt <= 0) stock.createdAt = now;
    stock.candles = candles;
  }

  private void updateCandle(StockState stock, long at, double price, long volume, int trades) {
    Candle candle = ensureCandle(stock, at);
    candle.high = roundMoney(Math.max(candle.high, price));
    candle.low = roundMoney(Math.min(candle.low, price));
    candle.close = roundMoney(price);
    candle.volume += Math.max(0, volume);
    candle.trades += Math.max(0, trades);
  }

  private Candle ensureCandle(StockState stock, long at) {
    if (stock.candles == null) stock.candles = new ArrayList<>();
    long slot = alignCandle(at);
    if (stock.candles.isEmpty()) {
      Candle candle = newCandle(slot, stock.currentPrice);
      stock.candles.add(candle);
      return candle;
    }

    Candle last = stock.candles.get(stock.candles.size() - 1);
    long candleMillis = candleSeconds * 1000L;
    long gap = Math.max(0L, (slot - last.startedAt) / candleMillis);
    if (gap > maxCandles + 4L) {
      stock.candles.clear();
      Candle candle = newCandle(slot, stock.currentPrice);
      stock.candles.add(candle);
      return candle;
    }

    while (last.startedAt < slot) {
      Candle next = newCandle(last.startedAt + candleMillis, last.close);
      stock.candles.add(next);
      last = next;
    }
    pruneCandles(stock);
    return last;
  }

  private Candle newCandle(long startedAt, double price) {
    Candle candle = new Candle();
    candle.startedAt = startedAt;
    candle.open = roundMoney(price);
    candle.high = roundMoney(price);
    candle.low = roundMoney(price);
    candle.close = roundMoney(price);
    candle.volume = 0;
    candle.trades = 0;
    return candle;
  }

  private void pruneAll() {
    for (StockState stock : data.stocks.values()) {
      pruneCandles(stock);
    }
  }

  private void pruneCandles(StockState stock) {
    if (stock.candles == null) {
      stock.candles = new ArrayList<>();
      return;
    }
    long cutoff = System.currentTimeMillis() - (historyHours * 3600_000L);
    while (stock.candles.size() > 2 && stock.candles.get(0).startedAt < cutoff) {
      stock.candles.remove(0);
    }
    while (stock.candles.size() > maxCandles) {
      stock.candles.remove(0);
    }
  }

  private Map<String, Object> stockPayload(StockState stock) {
    StockDefinition definition = definitionFor(stock.symbol);
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("symbol", stock.symbol);
    payload.put("code", stock.symbol);
    payload.put("name", stock.name);
    payload.put("price", roundMoney(stock.currentPrice));
    payload.put("open24h", roundMoney(open24h(stock)));
    payload.put("high24h", roundMoney(high24h(stock)));
    payload.put("low24h", roundMoney(low24h(stock)));
    payload.put("change24h", percentChange(stock.currentPrice, open24h(stock)));
    payload.put("volume24h", volume24h(stock));
    payload.put("marketCap", roundMoney(stock.currentPrice * definition.outstandingShares));
    payload.put("history", historyPayload(stock));
    return payload;
  }

  private Map<String, Object> positionPayload(StockState stock, int shares, double averageCost) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("symbol", stock.symbol);
    payload.put("name", stock.name);
    payload.put("shares", shares);
    payload.put("price", roundMoney(stock.currentPrice));
    payload.put("value", roundMoney(stock.currentPrice * shares));
    payload.put("averageCost", roundMoney(averageCost));
    payload.put("change24h", percentChange(stock.currentPrice, open24h(stock)));
    return payload;
  }

  private List<Map<String, Object>> historyPayload(StockState stock) {
    pruneCandles(stock);
    List<Map<String, Object>> history = new ArrayList<>();
    for (Candle candle : stock.candles) {
      Map<String, Object> item = new LinkedHashMap<>();
      item.put("time", Instant.ofEpochMilli(candle.startedAt).toString());
      item.put("open", roundMoney(candle.open));
      item.put("high", roundMoney(candle.high));
      item.put("low", roundMoney(candle.low));
      item.put("close", roundMoney(candle.close));
      item.put("volume", candle.volume);
      item.put("trades", candle.trades);
      history.add(item);
    }
    return history;
  }

  private List<Map<String, Object>> recentTradesPayload(int limit) {
    List<Map<String, Object>> payload = new ArrayList<>();
    int start = Math.max(0, data.trades.size() - limit);
    for (int index = data.trades.size() - 1; index >= start; index -= 1) {
      payload.add(tradePayload(data.trades.get(index)));
    }
    return payload;
  }

  private Map<String, Object> tradePayload(Trade trade) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("id", trade.id);
    payload.put("symbol", trade.symbol);
    payload.put("code", trade.symbol);
    payload.put("name", trade.name);
    payload.put("side", trade.side);
    payload.put("playerName", trade.playerName);
    payload.put("quantity", trade.quantity);
    payload.put("price", roundMoney(trade.price));
    payload.put("total", roundMoney(trade.total));
    payload.put("fee", roundMoney(trade.fee));
    payload.put("at", Instant.ofEpochMilli(trade.at).toString());
    return payload;
  }

  private void maybeBroadcastTrade(Trade trade) {
    if (!plugin.getConfig().getBoolean("stock-market.broadcast-trades", true)) return;
    double minimum = plugin.getConfig().getDouble("stock-market.broadcast-min-total", 25000.0);
    if (trade.total < minimum) return;
    String sideLabel = "buy".equals(trade.side) ? "매수" : "매도";
    Bukkit.broadcastMessage(
        "§b[NFO Exchange] §f"
            + trade.playerName
            + " §7"
            + trade.symbol
            + " "
            + sideLabel
            + " §e"
            + trade.quantity
            + "주 §7@ §f"
            + roundMoney(trade.price));
  }

  private Map<String, StockDefinition> readDefinitions() {
    Map<String, StockDefinition> next = new LinkedHashMap<>();
    ConfigurationSection section = plugin.getConfig().getConfigurationSection("stock-market.symbols");
    if (section != null) {
      for (String rawCode : section.getKeys(false)) {
        String code = rawCode.trim().toUpperCase(Locale.ROOT);
        String path = "stock-market.symbols." + rawCode + ".";
        StockDefinition definition = new StockDefinition();
        definition.symbol = code;
        definition.name = plugin.getConfig().getString(path + "name", code);
        definition.startPrice = Math.max(1.0, plugin.getConfig().getDouble(path + "start-price", 1000.0));
        definition.outstandingShares = Math.max(1L, plugin.getConfig().getLong(path + "outstanding-shares", 20000L));
        definition.liquidity = Math.max(1.0, plugin.getConfig().getDouble(path + "liquidity", 8000.0));
        definition.volatility = clamp(plugin.getConfig().getDouble(path + "volatility", 0.0035), 0.0001, 0.08);
        definition.meanReversion = clamp(plugin.getConfig().getDouble(path + "mean-reversion", 0.0018), 0.0, 0.05);
        definition.maxTickMove = clamp(plugin.getConfig().getDouble(path + "max-tick-move", 0.025), 0.001, 0.2);
        definition.cycleSpeed = clamp(plugin.getConfig().getDouble(path + "cycle-speed", 0.007), 0.001, 0.05);
        next.put(code, definition);
      }
    }

    if (next.isEmpty()) {
      next.put("DMD", fallbackDefinition("DMD", "다이아 광산", 3420.0, 24000L, 8200.0, 0.0165));
      next.put("FARM", fallbackDefinition("FARM", "농산물 조합", 1280.0, 42000L, 12600.0, 0.0125));
      next.put("LOG", fallbackDefinition("LOG", "건축 목재", 890.0, 36000L, 9400.0, 0.0145));
      next.put("RED", fallbackDefinition("RED", "레드스톤 공업", 2160.0, 28000L, 7800.0, 0.0180));
    }
    return next;
  }

  private StockDefinition fallbackDefinition(
      String symbol, String name, double startPrice, long outstandingShares, double liquidity, double volatility) {
    StockDefinition definition = new StockDefinition();
    definition.symbol = symbol;
    definition.name = name;
    definition.startPrice = startPrice;
    definition.outstandingShares = outstandingShares;
    definition.liquidity = liquidity;
    definition.volatility = volatility;
    definition.meanReversion = 0.0023;
    definition.maxTickMove = 0.062;
    definition.cycleSpeed = 0.014;
    return definition;
  }

  private StockDefinition definitionFor(String symbol) {
    StockDefinition definition = definitions.get(symbol);
    if (definition != null) return definition;
    return fallbackDefinition(symbol, symbol, 1000.0, 20000L, 8000.0, 0.0035);
  }

  private Map<String, Integer> holdingsFor(String uuid) {
    return data.holdings.computeIfAbsent(uuid, ignored -> new HashMap<>());
  }

  private Map<String, Double> averagesFor(String uuid) {
    return data.averageCost.computeIfAbsent(uuid, ignored -> new HashMap<>());
  }

  private Economy requireEconomy() {
    Economy economy = plugin.economy();
    if (economy == null) {
      throw new StockException(503, "Vault economy is not ready.");
    }
    return economy;
  }

  private double balanceOf(LinkStore.LinkedPlayer link) {
    Economy economy = plugin.economy();
    if (economy == null) return 0.0;
    return economy.getBalance(offlinePlayer(link));
  }

  private OfflinePlayer offlinePlayer(LinkStore.LinkedPlayer link) {
    try {
      return Bukkit.getOfflinePlayer(UUID.fromString(link.uuid));
    } catch (IllegalArgumentException error) {
      throw new StockException(400, "Linked player UUID is invalid.");
    }
  }

  private void ensureEnabled() {
    if (!enabled) throw new StockException(503, "Stock exchange is disabled.");
  }

  private void trimTrades() {
    if (data.trades == null) data.trades = new ArrayList<>();
    while (data.trades.size() > maxTrades) {
      data.trades.remove(0);
    }
  }

  private long alignCandle(long at) {
    long interval = candleSeconds * 1000L;
    return at - Math.floorMod(at, interval);
  }

  private double open24h(StockState stock) {
    pruneCandles(stock);
    if (stock.candles == null || stock.candles.isEmpty()) return stock.currentPrice;
    return stock.candles.get(0).open;
  }

  private double high24h(StockState stock) {
    pruneCandles(stock);
    double high = stock.currentPrice;
    for (Candle candle : stock.candles) high = Math.max(high, candle.high);
    return high;
  }

  private double low24h(StockState stock) {
    pruneCandles(stock);
    double low = stock.currentPrice;
    for (Candle candle : stock.candles) low = Math.min(low, candle.low);
    return low;
  }

  private long volume24h(StockState stock) {
    pruneCandles(stock);
    long volume = 0L;
    for (Candle candle : stock.candles) volume += Math.max(0L, candle.volume);
    return volume;
  }

  private double percentChange(double current, double open) {
    if (open <= 0) return 0.0;
    return Math.round(((current - open) / open) * 10000.0) / 100.0;
  }

  private double clampMoney(double value, StockDefinition definition) {
    double floor = Math.max(0.01, definition.startPrice * 0.12);
    double ceiling = Math.max(floor + 1.0, definition.startPrice * 8.0);
    return roundMoney(clamp(value, floor, ceiling));
  }

  private static int readInt(Object value, int fallback) {
    if (value instanceof Number number) return number.intValue();
    try {
      return Integer.parseInt(String.valueOf(value));
    } catch (RuntimeException ignored) {
      return fallback;
    }
  }

  private static double roundMoney(double value) {
    return Math.round(value * 100.0) / 100.0;
  }

  private static double clamp(double value, double min, double max) {
    return Math.max(min, Math.min(max, value));
  }

  public static final class StockException extends RuntimeException {
    final int status;

    StockException(int status, String message) {
      super(message);
      this.status = status;
    }

    Map<String, Object> payload() {
      return Map.of("ok", false, "message", getMessage());
    }
  }

  private static final class StockDefinition {
    String symbol;
    String name;
    double startPrice;
    long outstandingShares;
    double liquidity;
    double volatility;
    double meanReversion;
    double maxTickMove;
    double cycleSpeed;
  }

  public static final class StoredData {
    int schemaVersion = 1;
    long lastAdvancedAt = 0L;
    Map<String, StockState> stocks = new LinkedHashMap<>();
    Map<String, Map<String, Integer>> holdings = new HashMap<>();
    Map<String, Map<String, Double>> averageCost = new HashMap<>();
    List<Trade> trades = new ArrayList<>();

    StoredData ensure() {
      if (stocks == null) stocks = new LinkedHashMap<>();
      if (holdings == null) holdings = new HashMap<>();
      if (averageCost == null) averageCost = new HashMap<>();
      if (trades == null) trades = new ArrayList<>();
      return this;
    }
  }

  public static final class StockState {
    public String symbol;
    public String name;
    public double currentPrice;
    public long createdAt;
    public List<Candle> candles = new ArrayList<>();
  }

  public static final class Candle {
    public long startedAt;
    public double open;
    public double high;
    public double low;
    public double close;
    public long volume;
    public int trades;
  }

  public static final class Trade {
    public String id;
    public String symbol;
    public String name;
    public String side;
    public String playerName;
    public String uuid;
    public int quantity;
    public double price;
    public double total;
    public double fee;
    public long at;
  }
}
