package kr.nfoifsb.auroralink;

import java.util.List;
import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;

public final class AuroraAdminCommand implements CommandExecutor, TabCompleter {
  private final AuroraLinkPlugin plugin;

  public AuroraAdminCommand(AuroraLinkPlugin plugin) {
    this.plugin = plugin;
  }

  @Override
  public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
    if (!sender.hasPermission("auroralink.admin")) {
      sender.sendMessage(color("&c[AuroraLink] You do not have permission."));
      return true;
    }

    String sub = args.length == 0 ? "status" : args[0].toLowerCase();
    switch (sub) {
      case "reload" -> {
        plugin.reloadAurora();
        sender.sendMessage(color("&b[AuroraLink] &fConfiguration reloaded."));
      }
      case "status" -> sender.sendMessage(
          color(
              "&b[AuroraLink] &fAPI: &e"
                  + (plugin.isBridgeRunning() ? "online" : "offline")
                  + "&f, linked players: &e"
                  + plugin.linkStore().linkedCount()
                  + "&f, Vault: &e"
                  + (plugin.economy() == null ? "none" : plugin.economy().getName())
                  + "&f, Stocks: &e"
                  + (plugin.stockExchange() != null && plugin.stockExchange().isEnabled() ? "24H live" : "off")));
      default -> sender.sendMessage(color("&b[AuroraLink] &fUsage: /auroralink <reload|status>"));
    }

    return true;
  }

  @Override
  public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
    if (args.length == 1) return List.of("status", "reload");
    return List.of();
  }

  private static String color(String message) {
    return ChatColor.translateAlternateColorCodes('&', message);
  }
}
