package kr.nfoifsb.auroralink;

import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

public final class WebAuthCommand implements CommandExecutor {
  private final AuroraLinkPlugin plugin;
  private final LinkStore linkStore;

  public WebAuthCommand(AuroraLinkPlugin plugin, LinkStore linkStore) {
    this.plugin = plugin;
    this.linkStore = linkStore;
  }

  @Override
  public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
    if (!(sender instanceof Player player)) {
      sender.sendMessage("This command can only be used in game.");
      return true;
    }

    if (args.length != 1) {
      player.sendMessage(color("&b[AuroraLink] &fEnter the code shown on the website: &e/webauth 123456"));
      return true;
    }

    LinkStore.LinkResult result = linkStore.confirm(player, args[0]);
    if (!result.success) {
      player.sendMessage(color("&c[AuroraLink] " + result.message));
      return true;
    }

    player.sendMessage(color("&b[AuroraLink] &fWebsite account linked to &e" + player.getName() + "&f."));
    plugin.getLogger().info(player.getName() + " linked their website account.");
    return true;
  }

  private static String color(String message) {
    return ChatColor.translateAlternateColorCodes('&', message);
  }
}
