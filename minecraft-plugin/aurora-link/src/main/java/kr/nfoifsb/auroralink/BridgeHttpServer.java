package kr.nfoifsb.auroralink;

import com.google.gson.Gson;
import com.google.gson.JsonSyntaxException;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.lang.reflect.Method;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.PlayerInventory;
import org.bukkit.inventory.meta.Damageable;
import org.bukkit.inventory.meta.ItemMeta;

public final class BridgeHttpServer {
  private final AuroraLinkPlugin plugin;
  private final LinkStore linkStore;
  private final PlayerActions playerActions;
  private final StockExchange stockExchange;
  private final WebAuthWhitelistBridge webAuthBridge;
  private final Gson gson = new Gson();
  private final RateLimiter rateLimiter;
  private HttpServer server;
  private ExecutorService executor;

  public BridgeHttpServer(
      AuroraLinkPlugin plugin,
      LinkStore linkStore,
      PlayerActions playerActions,
      StockExchange stockExchange,
      WebAuthWhitelistBridge webAuthBridge) {
    this.plugin = plugin;
    this.linkStore = linkStore;
    this.playerActions = playerActions;
    this.stockExchange = stockExchange;
    this.webAuthBridge = webAuthBridge;
    this.rateLimiter = new RateLimiter(plugin.getConfig().getInt("api.rate-limit-per-minute", 80));
  }

  public void start() {
    String host = plugin.getConfig().getString("api.host", "0.0.0.0");
    int port = plugin.getConfig().getInt("api.port", 8787);
    try {
      executor = Executors.newFixedThreadPool(4);
      server = HttpServer.create(new InetSocketAddress(host, port), 0);
      server.createContext("/", this::handle);
      server.setExecutor(executor);
      server.start();
      plugin.getLogger().info("AuroraLink web API listening on " + host + ":" + port);

      String adminToken = plugin.getConfig().getString("api.admin-token", "");
      if (adminToken == null || adminToken.isBlank() || adminToken.startsWith("CHANGE_ME")) {
        plugin.getLogger().warning("api.admin-token is still the default. Admin web endpoints are locked.");
      }
    } catch (IOException error) {
      plugin.getLogger().severe("Failed to start AuroraLink web API: " + error.getMessage());
    }
  }

  public void stop() {
    if (server != null) {
      server.stop(0);
      server = null;
    }
    if (executor != null) {
      executor.shutdownNow();
      executor = null;
    }
  }

  public boolean isRunning() {
    return server != null;
  }

  private void handle(HttpExchange exchange) throws IOException {
    applyCors(exchange);
    if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
      exchange.sendResponseHeaders(204, -1);
      return;
    }

    String clientKey = exchange.getRemoteAddress().getAddress().getHostAddress();
    if (!rateLimiter.allow(clientKey)) {
      sendJson(exchange, 429, Map.of("ok", false, "message", "Too many requests."));
      return;
    }

    try {
      Map<String, Object> response = route(exchange);
      sendJson(exchange, 200, response);
    } catch (HttpError error) {
      sendJson(exchange, error.status, error.payload());
    } catch (PlayerActions.ActionException error) {
      Map<String, Object> payload = new HashMap<>();
      payload.put("ok", false);
      payload.put("message", error.getMessage());
      payload.putAll(error.extra);
      sendJson(exchange, error.status, payload);
    } catch (StockExchange.StockException error) {
      sendJson(exchange, error.status, error.payload());
    } catch (JsonSyntaxException error) {
      sendJson(exchange, 400, Map.of("ok", false, "message", "Invalid JSON body."));
    } catch (Exception error) {
      plugin.getLogger().warning("AuroraLink API request failed: " + error.getMessage());
      sendJson(exchange, 500, Map.of("ok", false, "message", "Internal server error."));
    }
  }

  private Map<String, Object> route(HttpExchange exchange) throws Exception {
    String method = exchange.getRequestMethod().toUpperCase(Locale.ROOT);
    String path = pathAfterBase(exchange.getRequestURI());

    if ("GET".equals(method) && "/server/overview".equals(path)) {
      return sync(this::serverOverview);
    }

    if ("POST".equals(method) && "/verification/start".equals(path)) {
      return verificationStart(readBody(exchange));
    }

    if ("POST".equals(method) && "/verification/check".equals(path)) {
      return verificationCheck(readBody(exchange));
    }

    if ("GET".equals(method) && "/stocks/market".equals(path)) {
      return stockExchange.marketSnapshot();
    }

    if ("POST".equals(method) && "/stocks/portfolio".equals(path)) {
      Map<String, Object> body = readBody(exchange);
      LinkStore.LinkedPlayer link = linkedPlayerFrom(exchange, body);
      return sync(() -> stockExchange.portfolioSnapshot(link));
    }

    if ("POST".equals(method) && "/stocks/trade".equals(path)) {
      Map<String, Object> body = readBody(exchange);
      LinkStore.LinkedPlayer link = linkedPlayerFrom(exchange, body);
      return sync(() -> stockExchange.trade(link, body));
    }

    String[] parts = splitPath(path);
    if (parts.length == 3 && "GET".equals(method) && "players".equals(parts[0]) && "inventory".equals(parts[2])) {
      String nickname = decode(parts[1]);
      String token = tokenFrom(exchange.getRequestHeaders(), Map.of());
      LinkStore.LinkedPlayer link = linkStore.validateToken(nickname, token);
      if (link == null) throw new HttpError(401, "Player web token is missing or invalid.");
      return sync(() -> inventorySnapshot(link.nickname));
    }

    if (parts.length == 4
        && "POST".equals(method)
        && "players".equals(parts[0])
        && "actions".equals(parts[2])) {
      String nickname = decode(parts[1]);
      String action = decode(parts[3]);
      Map<String, Object> body = readBody(exchange);
      String token = tokenFrom(exchange.getRequestHeaders(), body);
      LinkStore.LinkedPlayer link = linkStore.validateToken(nickname, token);
      if (link == null) throw new HttpError(401, "Player web token is missing or invalid.");
      return sync(() -> playerActions.perform(action, link));
    }

    if ("POST".equals(method) && "/admin/broadcast".equals(path)) {
      requireAdmin(exchange.getRequestHeaders());
      Map<String, Object> body = readBody(exchange);
      String message = LinkStore.value(body.get("message"), "").trim();
      if (message.isBlank()) throw new HttpError(400, "message is required.");
      return sync(() -> {
        Bukkit.broadcastMessage("[AuroraLink] " + message);
        return Map.of("ok", true, "message", "Broadcast sent.");
      });
    }

    throw new HttpError(404, "Route not found.");
  }

  private Map<String, Object> verificationStart(Map<String, Object> body) {
    String nickname = LinkStore.value(body.get("nickname"), "").trim();
    if (nickname.isBlank()) throw new HttpError(400, "nickname is required.");
    Map<String, Object> account = accountFrom(body);
    LinkStore.PendingVerification pending;
    if (webAuthBridge != null && webAuthBridge.enabled()) {
      try {
        WebAuthWhitelistBridge.RequestResult external = webAuthBridge.requestCode(nickname, account);
        pending = linkStore.startVerification(nickname, account, external.code(), external.expiresAt());
      } catch (WebAuthWhitelistBridge.BridgeException error) {
        plugin.getLogger().warning("WebAuthWhitelist code request failed: " + error.getMessage());
        throw new HttpError(502, "Minecraft web authentication is temporarily unavailable.");
      }
    } else {
      pending = linkStore.startVerification(nickname, account);
    }
    LinkStore.LinkedPlayer existing = linkStore.findLink(account, nickname);
    Map<String, Object> response = new HashMap<>();
    response.put("ok", true);
    response.put("nickname", nickname);
    response.put("code", pending.code);
    response.put("verified", existing != null);
    response.put("uuid", existing == null ? "" : existing.uuid);
    if (existing != null) response.put("webToken", existing.webToken);
    response.put("expiresAt", Instant.ofEpochMilli(pending.expiresAt).toString());
    return response;
  }

  private Map<String, Object> verificationCheck(Map<String, Object> body) throws Exception {
    String nickname = LinkStore.value(body.get("nickname"), "").trim();
    if (nickname.isBlank()) throw new HttpError(400, "nickname is required.");
    Map<String, Object> account = accountFrom(body);
    String code = LinkStore.value(body.get("code"), "").trim();
    LinkStore.LinkedPlayer link = linkStore.findLink(account, nickname);
    if (link == null && webAuthBridge != null && webAuthBridge.enabled()) {
      LinkStore.PendingVerification pending = linkStore.findPending(account, nickname, code);
      if (pending != null) {
        try {
          WebAuthWhitelistBridge.StatusResult status = webAuthBridge.status(nickname);
          if (status.verified()) {
            String uuid = sync(() -> playerUuid(nickname));
            link = linkStore.linkExternal(account, nickname, uuid);
          }
        } catch (WebAuthWhitelistBridge.BridgeException error) {
          plugin.getLogger().warning("WebAuthWhitelist status request failed: " + error.getMessage());
        }
      }
    }
    Map<String, Object> response = new HashMap<>();
    response.put("ok", true);
    response.put("nickname", nickname);
    response.put("verified", link != null);
    response.put("uuid", link == null ? "" : link.uuid);
    if (link != null) {
      response.put("webToken", link.webToken);
      response.put("verifiedAt", Instant.ofEpochMilli(link.verifiedAt).toString());
      response.put("tokenExpiresAt", Instant.ofEpochMilli(link.tokenExpiresAt).toString());
    }
    return response;
  }

  private String playerUuid(String nickname) {
    Player online = Bukkit.getPlayerExact(nickname);
    if (online != null) return online.getUniqueId().toString();
    return Bukkit.getOfflinePlayer(nickname).getUniqueId().toString();
  }

  private Map<String, Object> serverOverview() {
    List<Map<String, Object>> players = Bukkit.getOnlinePlayers().stream()
        .map(player -> {
          Map<String, Object> item = new HashMap<>();
          item.put("name", player.getName());
          item.put("uuid", player.getUniqueId().toString());
          item.put("ping", player.getPing());
          return item;
        })
        .toList();

    Map<String, Object> response = new HashMap<>();
    response.put("ok", true);
    response.put("online", true);
    response.put("minecraftVersion", callString(Bukkit.getServer(), "getMinecraftVersion", Bukkit.getVersion()));
    response.put("serverVersion", Bukkit.getVersion());
    response.put("linkedPlayers", linkStore.linkedCount());
    response.put("economyProvider", plugin.economy() == null ? "" : plugin.economy().getName());
    response.put("players", Map.of("online", players.size(), "max", Bukkit.getMaxPlayers(), "list", players));
    response.put("memory", memorySnapshot());
    response.put("system", systemSnapshot());
    response.put("tps", readTps());
    response.put("updatedAt", Instant.now().toString());
    return response;
  }

  private Map<String, Object> memorySnapshot() {
    Runtime runtime = Runtime.getRuntime();
    long maxBytes = runtime.maxMemory();
    long totalBytes = runtime.totalMemory();
    long freeBytes = runtime.freeMemory();
    long usedBytes = Math.max(0L, totalBytes - freeBytes);
    double usedPercent = maxBytes > 0 ? Math.round((usedBytes * 1000.0) / maxBytes) / 10.0 : 0.0;

    Map<String, Object> memory = new HashMap<>();
    memory.put("usedBytes", usedBytes);
    memory.put("freeBytes", freeBytes);
    memory.put("totalBytes", totalBytes);
    memory.put("maxBytes", maxBytes);
    memory.put("usedPercent", usedPercent);
    return memory;
  }

  private Map<String, Object> systemSnapshot() {
    Map<String, Object> system = new HashMap<>();
    system.put("cpu", cpuSnapshot());
    system.put("temperature", temperatureSnapshot());
    return system;
  }

  private Map<String, Object> cpuSnapshot() {
    java.lang.management.OperatingSystemMXBean bean = ManagementFactory.getOperatingSystemMXBean();
    Map<String, Object> cpu = new HashMap<>();
    cpu.put("availableProcessors", bean.getAvailableProcessors());
    double loadAverage = bean.getSystemLoadAverage();
    if (loadAverage >= 0) cpu.put("loadAverage", Math.round(loadAverage * 100.0) / 100.0);

    if (bean instanceof com.sun.management.OperatingSystemMXBean extended) {
      putCpuPercent(cpu, "systemLoadPercent", extended.getCpuLoad());
      putCpuPercent(cpu, "processLoadPercent", extended.getProcessCpuLoad());
    }

    return cpu;
  }

  private void putCpuPercent(Map<String, Object> cpu, String key, double load) {
    if (Double.isFinite(load) && load >= 0) {
      cpu.put(key, Math.round(load * 1000.0) / 10.0);
    }
  }

  private Map<String, Object> temperatureSnapshot() {
    Map<String, Object> temperature = new HashMap<>();
    temperature.put("available", false);

    for (TemperatureCandidate candidate : temperatureCandidates()) {
      double celsius = readTemperatureCelsius(candidate.path());
      if (Double.isFinite(celsius) && celsius > -20.0 && celsius < 130.0) {
        temperature.put("available", true);
        temperature.put("celsius", Math.round(celsius * 10.0) / 10.0);
        temperature.put("source", candidate.source());
        return temperature;
      }
    }

    return temperature;
  }

  private List<TemperatureCandidate> temperatureCandidates() {
    List<TemperatureCandidate> candidates = new ArrayList<>();
    Path thermalRoot = Path.of("/sys/class/thermal");
    if (Files.isDirectory(thermalRoot)) {
      try (DirectoryStream<Path> zones = Files.newDirectoryStream(thermalRoot, "thermal_zone*")) {
        for (Path zone : zones) {
          Path temp = zone.resolve("temp");
          if (Files.isReadable(temp)) {
            String source = readFirstLine(zone.resolve("type"), zone.getFileName().toString());
            candidates.add(new TemperatureCandidate(temp, source));
          }
        }
      } catch (IOException ignored) {
        // Temperature is optional; skip unreadable sensor groups.
      }
    }

    Path hwmonRoot = Path.of("/sys/class/hwmon");
    if (Files.isDirectory(hwmonRoot)) {
      try (DirectoryStream<Path> devices = Files.newDirectoryStream(hwmonRoot, "hwmon*")) {
        for (Path device : devices) {
          try (DirectoryStream<Path> inputs = Files.newDirectoryStream(device, "temp*_input")) {
            for (Path input : inputs) {
              if (!Files.isReadable(input)) continue;
              String fileName = input.getFileName().toString();
              String prefix = fileName.substring(0, fileName.indexOf("_input"));
              String label = readFirstLine(device.resolve(prefix + "_label"), "");
              String deviceName = readFirstLine(device.resolve("name"), device.getFileName().toString());
              String source = label.isBlank() ? deviceName : deviceName + " " + label;
              candidates.add(new TemperatureCandidate(input, source));
            }
          } catch (IOException ignored) {
            // Continue with the next hwmon device.
          }
        }
      } catch (IOException ignored) {
        // Temperature is optional.
      }
    }

    return candidates;
  }

  private double readTemperatureCelsius(Path path) {
    try {
      String raw = Files.readString(path, StandardCharsets.UTF_8).trim();
      if (raw.isBlank()) return Double.NaN;
      double value = Double.parseDouble(raw);
      return value > 1000.0 ? value / 1000.0 : value;
    } catch (IOException | NumberFormatException ignored) {
      return Double.NaN;
    }
  }

  private String readFirstLine(Path path, String fallback) {
    try {
      if (!Files.isReadable(path)) return fallback;
      String value = Files.readString(path, StandardCharsets.UTF_8).trim();
      int newline = value.indexOf('\n');
      return newline >= 0 ? value.substring(0, newline).trim() : value;
    } catch (IOException ignored) {
      return fallback;
    }
  }

  private Map<String, Object> inventorySnapshot(String nickname) {
    Player player = Bukkit.getPlayerExact(nickname);
    if (player == null) throw new HttpError(404, "Player is not online.");

    PlayerInventory inventory = player.getInventory();
    List<Map<String, Object>> items = new ArrayList<>();
    for (int slot = 0; slot < 36; slot += 1) {
      ItemStack stack = inventory.getItem(slot);
      Map<String, Object> item = itemPayload(stack, slot);
      if (item != null) items.add(item);
    }

    Location location = player.getLocation();
    Map<String, Object> response = new HashMap<>();
    response.put("ok", true);
    response.put("nickname", player.getName());
    response.put("uuid", player.getUniqueId().toString());
    response.put("level", player.getLevel());
    response.put("health", Math.round(player.getHealth()) + " / " + Math.round(player.getMaxHealth()));
    response.put("location", location.getBlockX() + ", " + location.getBlockY() + ", " + location.getBlockZ());
    response.put("world", location.getWorld() == null ? "" : location.getWorld().getName());
    response.put("heldSlot", inventory.getHeldItemSlot());
    response.put("equipment", equipmentPayload(inventory));
    response.put("updatedAt", Instant.now().toString());
    response.put("items", items);
    return response;
  }

  private Map<String, Object> equipmentPayload(PlayerInventory inventory) {
    Map<String, Object> equipment = new LinkedHashMap<>();
    putEquipment(equipment, "mainHand", inventory.getItemInMainHand());
    putEquipment(equipment, "offHand", inventory.getItemInOffHand());
    putEquipment(equipment, "helmet", inventory.getHelmet());
    putEquipment(equipment, "chestplate", inventory.getChestplate());
    putEquipment(equipment, "leggings", inventory.getLeggings());
    putEquipment(equipment, "boots", inventory.getBoots());
    return equipment;
  }

  private void putEquipment(Map<String, Object> equipment, String key, ItemStack stack) {
    Map<String, Object> item = itemPayload(stack, -1);
    if (item != null) equipment.put(key, item);
  }

  private Map<String, Object> itemPayload(ItemStack stack, int slot) {
    if (stack == null || stack.getType() == Material.AIR) return null;

    Material material = stack.getType();
    String materialId = material.name().toLowerCase(Locale.ROOT);
    Map<String, Object> item = new HashMap<>();
    if (slot >= 0) item.put("slot", slot);
    item.put("name", itemName(stack));
    item.put("type", material.name());
    item.put("id", materialId);
    item.put("key", "minecraft:" + materialId);
    item.put("count", stack.getAmount());
    item.put("maxStackSize", material.getMaxStackSize());
    item.put("isBlock", material.isBlock());
    item.put("isItem", material.isItem());
    item.put("texture", materialId);
    item.put("itemTexture", "item/" + materialId + ".png");
    if (material.isBlock()) item.put("blockTexture", "block/" + materialId + ".png");
    item.put("color", colorFor(material));

    int maxDurability = material.getMaxDurability();
    if (maxDurability > 0) {
      item.put("maxDurability", maxDurability);
      ItemMeta meta = stack.getItemMeta();
      int damage = meta instanceof Damageable damageable ? damageable.getDamage() : 0;
      int remaining = Math.max(0, maxDurability - damage);
      item.put("damage", damage);
      item.put("durability", remaining);
      item.put("durabilityPercent", Math.round((remaining * 1000.0) / maxDurability) / 10.0);
    }

    Map<Enchantment, Integer> enchantments = stack.getEnchantments();
    if (!enchantments.isEmpty()) {
      item.put("enchanted", true);
      List<Map<String, Object>> enchantmentPayloads = new ArrayList<>();
      enchantments.forEach((enchantment, level) -> {
        Map<String, Object> payload = new HashMap<>();
        payload.put("key", enchantment.getKey().toString());
        payload.put("level", level);
        enchantmentPayloads.add(payload);
      });
      item.put("enchantments", enchantmentPayloads);
    } else {
      item.put("enchanted", false);
    }

    ItemMeta meta = stack.getItemMeta();
    if (meta != null && meta.hasLore()) {
      List<Component> lore = meta.lore();
      if (lore != null && !lore.isEmpty()) {
        List<String> lines = lore.stream()
            .limit(8)
            .map(PlainTextComponentSerializer.plainText()::serialize)
            .toList();
        item.put("lore", lines);
      }
    }

    return item;
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> accountFrom(Map<String, Object> body) {
    Object account = body.get("account");
    if (account instanceof Map<?, ?> map) {
      return (Map<String, Object>) map;
    }
    return Map.of();
  }

  private Map<String, Object> readBody(HttpExchange exchange) throws IOException {
    byte[] bytes = exchange.getRequestBody().readAllBytes();
    if (bytes.length == 0) return new HashMap<>();
    String json = new String(bytes, StandardCharsets.UTF_8);
    @SuppressWarnings("unchecked")
    Map<String, Object> body = gson.fromJson(json, Map.class);
    return body == null ? new HashMap<>() : body;
  }

  private String pathAfterBase(URI uri) {
    String base = plugin.getConfig().getString("api.base-path", "/minecraft");
    String path = uri.getPath();
    if (!path.equals(base) && !path.startsWith(base + "/")) throw new HttpError(404, "Route not found.");
    if (path.equals(base)) return "/";
    String next = path.substring(base.length());
    return next.isBlank() ? "/" : next;
  }

  private String[] splitPath(String path) {
    String clean = path.startsWith("/") ? path.substring(1) : path;
    return clean.isBlank() ? new String[0] : clean.split("/");
  }

  private String decode(String value) {
    return URLDecoder.decode(value, StandardCharsets.UTF_8);
  }

  private String tokenFrom(Headers headers, Map<String, Object> body) {
    String authorization = headers.getFirst("Authorization");
    if (authorization != null && authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
      return authorization.substring(7).trim();
    }
    String headerToken = headers.getFirst("X-Aurora-Link-Token");
    if (headerToken != null && !headerToken.isBlank()) return headerToken.trim();
    String bodyToken = LinkStore.value(body.get("webToken"), "");
    if (!bodyToken.isBlank()) return bodyToken;
    return LinkStore.value(body.get("token"), "");
  }

  private LinkStore.LinkedPlayer linkedPlayerFrom(HttpExchange exchange, Map<String, Object> body) {
    String nickname = LinkStore.value(body.get("nickname"), "").trim();
    if (nickname.isBlank()) throw new HttpError(400, "nickname is required.");
    String token = tokenFrom(exchange.getRequestHeaders(), body);
    LinkStore.LinkedPlayer link = linkStore.validateToken(nickname, token);
    if (link == null) throw new HttpError(401, "Player web token is missing or invalid.");
    return link;
  }

  private void requireAdmin(Headers headers) {
    String expected = plugin.getConfig().getString("api.admin-token", "");
    if (expected == null || expected.isBlank() || expected.startsWith("CHANGE_ME")) {
      throw new HttpError(403, "Admin API token is not configured.");
    }
    String actual = headers.getFirst("X-Aurora-Admin-Token");
    if (!expected.equals(actual)) throw new HttpError(401, "Invalid admin token.");
  }

  private <T> T sync(Callable<T> task) throws Exception {
    if (Bukkit.isPrimaryThread()) return task.call();
    Future<T> future = Bukkit.getScheduler().callSyncMethod(plugin, task);
    return future.get(5, TimeUnit.SECONDS);
  }

  private void applyCors(HttpExchange exchange) {
    Headers response = exchange.getResponseHeaders();
    String origin = exchange.getRequestHeaders().getFirst("Origin");
    List<String> allowed = plugin.getConfig().getStringList("api.allowed-origins");
    if (allowed.contains("*")) {
      response.set("Access-Control-Allow-Origin", "*");
    } else if (origin != null && allowed.contains(origin)) {
      response.set("Access-Control-Allow-Origin", origin);
      response.set("Vary", "Origin");
    }
    response.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    response.set("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Aurora-Link-Token,X-Aurora-Admin-Token");
    response.set("Access-Control-Max-Age", "86400");
  }

  private void sendJson(HttpExchange exchange, int status, Map<String, Object> payload) throws IOException {
    byte[] bytes = gson.toJson(payload).getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
    exchange.sendResponseHeaders(status, bytes.length);
    exchange.getResponseBody().write(bytes);
    exchange.close();
  }

  private static String itemName(ItemStack stack) {
    ItemMeta meta = stack.getItemMeta();
    if (meta != null && meta.hasDisplayName()) {
      Component component = meta.displayName();
      if (component != null) {
        return PlainTextComponentSerializer.plainText().serialize(component);
      }
    }
    String raw = stack.getType().name().toLowerCase(Locale.ROOT).replace('_', ' ');
    StringBuilder builder = new StringBuilder();
    for (String word : raw.split(" ")) {
      if (word.isBlank()) continue;
      if (!builder.isEmpty()) builder.append(' ');
      builder.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1));
    }
    return builder.toString();
  }

  private static String colorFor(Material material) {
    String key = material.name().toLowerCase(Locale.ROOT);
    if (key.contains("diamond")) return "#55d9e8";
    if (key.contains("emerald")) return "#31c96b";
    if (key.contains("gold")) return "#f5c84b";
    if (key.contains("iron")) return "#c9d0d5";
    if (key.contains("wood") || key.contains("log")) return "#9a6439";
    if (key.contains("stone")) return "#8f9693";
    if (key.contains("apple")) return "#d94f45";
    if (key.contains("potion")) return "#b05cff";
    return "#83b36a";
  }

  private static String callString(Object target, String method, String fallback) {
    try {
      Method reflected = target.getClass().getMethod(method);
      Object value = reflected.invoke(target);
      return value == null ? fallback : String.valueOf(value);
    } catch (ReflectiveOperationException ignored) {
      return fallback;
    }
  }

  private static List<Double> readTps() {
    try {
      Method reflected = Bukkit.class.getMethod("getTPS");
      double[] tps = (double[]) reflected.invoke(null);
      List<Double> values = new ArrayList<>();
      for (double value : tps) values.add(Math.round(value * 100.0) / 100.0);
      return values;
    } catch (ReflectiveOperationException ignored) {
      return List.of();
    }
  }

  private record TemperatureCandidate(Path path, String source) {}

  private static final class RateLimiter {
    private final int limit;
    private final Map<String, ArrayDeque<Long>> hits = new ConcurrentHashMap<>();

    RateLimiter(int limit) {
      this.limit = Math.max(1, limit);
    }

    boolean allow(String key) {
      long now = System.currentTimeMillis();
      long windowStart = now - TimeUnit.MINUTES.toMillis(1);
      ArrayDeque<Long> bucket = hits.computeIfAbsent(key, ignored -> new ArrayDeque<>());
      synchronized (bucket) {
        while (!bucket.isEmpty() && bucket.peekFirst() < windowStart) {
          bucket.removeFirst();
        }
        if (bucket.size() >= limit) return false;
        bucket.addLast(now);
        return true;
      }
    }
  }

  private static final class HttpError extends RuntimeException {
    final int status;

    HttpError(int status, String message) {
      super(message);
      this.status = status;
    }

    Map<String, Object> payload() {
      return Map.of("ok", false, "message", getMessage());
    }
  }
}
