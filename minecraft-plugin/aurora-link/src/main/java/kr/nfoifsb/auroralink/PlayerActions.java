package kr.nfoifsb.auroralink;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import net.milkbowl.vault.economy.Economy;
import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.Particle;
import org.bukkit.Sound;
import org.bukkit.entity.Player;

public final class PlayerActions {
  private final AuroraLinkPlugin plugin;
  private final LinkStore linkStore;
  private final Economy economy;

  public PlayerActions(AuroraLinkPlugin plugin, LinkStore linkStore, Economy economy) {
    this.plugin = plugin;
    this.linkStore = linkStore;
    this.economy = economy;
  }

  public Map<String, Object> perform(String action, LinkStore.LinkedPlayer link) {
    return switch (action) {
      case "daily-reward" -> dailyReward(link);
      case "spark" -> spark(link);
      case "market-bell" -> marketBell(link);
      default -> throw new ActionException(404, "Unknown action: " + action);
    };
  }

  private Map<String, Object> dailyReward(LinkStore.LinkedPlayer link) {
    if (!plugin.getConfig().getBoolean("actions.daily-reward.enabled", true)) {
      throw new ActionException(403, "Daily reward is disabled.");
    }

    long cooldown =
        Duration.ofHours(plugin.getConfig().getLong("actions.daily-reward.cooldown-hours", 20)).toMillis();
    requireCooldown(link.uuid, "daily-reward", cooldown);
    Player player = requireOnlinePlayer(link);

    double money = plugin.getConfig().getDouble("actions.daily-reward.money", 250.0);
    if (economy != null && money > 0) {
      economy.depositPlayer(player, money);
    }

    List<String> commands = plugin.getConfig().getStringList("actions.daily-reward.commands");
    for (String command : commands) {
      Bukkit.dispatchCommand(Bukkit.getConsoleSender(), command.replace("%player%", player.getName()));
    }

    linkStore.markCooldown(link.uuid, "daily-reward");
    player.sendMessage(color("&b[AuroraLink] &fDaily reward received."));
    return ok("daily-reward", "Daily reward sent.", Map.of("money", money));
  }

  private Map<String, Object> spark(LinkStore.LinkedPlayer link) {
    if (!plugin.getConfig().getBoolean("actions.spark.enabled", true)) {
      throw new ActionException(403, "Spark action is disabled.");
    }

    long cooldown =
        Duration.ofSeconds(plugin.getConfig().getLong("actions.spark.cooldown-seconds", 60)).toMillis();
    requireCooldown(link.uuid, "spark", cooldown);
    Player player = requireOnlinePlayer(link);

    player.getWorld().spawnParticle(Particle.HAPPY_VILLAGER, player.getLocation().add(0, 1.2, 0), 24, 0.6, 0.7, 0.6, 0.02);
    player.playSound(player.getLocation(), Sound.ENTITY_PLAYER_LEVELUP, 0.7f, 1.45f);
    player.sendTitle(color("&bWeb Ping"), color("&fThe website sent a signal to your character."), 8, 36, 10);

    linkStore.markCooldown(link.uuid, "spark");
    return ok("spark", "A web ping was sent to your character.", Map.of());
  }

  private Map<String, Object> marketBell(LinkStore.LinkedPlayer link) {
    if (!plugin.getConfig().getBoolean("actions.market-bell.enabled", true)) {
      throw new ActionException(403, "Market bell is disabled.");
    }

    long cooldown =
        Duration.ofMinutes(plugin.getConfig().getLong("actions.market-bell.cooldown-minutes", 10)).toMillis();
    requireCooldown(link.uuid, "market-bell", cooldown);
    Player player = requireOnlinePlayer(link);
    String format =
        plugin.getConfig().getString(
            "actions.market-bell.broadcast-format",
            "&b[Market] &f%player% &7sent a market ping from the website.");
    Bukkit.broadcastMessage(color(format.replace("%player%", player.getName())));

    linkStore.markCooldown(link.uuid, "market-bell");
    return ok("market-bell", "Market ping broadcasted.", Map.of());
  }

  private void requireCooldown(String uuid, String action, long cooldownMillis) {
    long remaining = linkStore.remainingCooldownMillis(uuid, action, cooldownMillis);
    if (remaining > 0) {
      throw new ActionException(
          429,
          "Cooldown is still active.",
          Map.of("remainingSeconds", Math.ceil(remaining / 1000.0)));
    }
  }

  private Player requireOnlinePlayer(LinkStore.LinkedPlayer link) {
    Player player = null;
    try {
      player = Bukkit.getPlayer(UUID.fromString(link.uuid));
    } catch (IllegalArgumentException ignored) {
      // Fall back to exact nickname below.
    }
    if (player == null) player = Bukkit.getPlayerExact(link.nickname);
    if (player == null) {
      throw new ActionException(409, "Player must be online to use this action.");
    }
    return player;
  }

  private static Map<String, Object> ok(String action, String message, Map<String, Object> extra) {
    Map<String, Object> payload = new HashMap<>();
    payload.put("ok", true);
    payload.put("action", action);
    payload.put("message", message);
    payload.putAll(extra);
    return payload;
  }

  private static String color(String message) {
    return ChatColor.translateAlternateColorCodes('&', message);
  }

  public static final class ActionException extends RuntimeException {
    public final int status;
    public final Map<String, Object> extra;

    public ActionException(int status, String message) {
      this(status, message, Map.of());
    }

    public ActionException(int status, String message, Map<String, Object> extra) {
      super(message);
      this.status = status;
      this.extra = extra;
    }
  }
}
