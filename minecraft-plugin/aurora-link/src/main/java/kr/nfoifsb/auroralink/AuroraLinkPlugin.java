package kr.nfoifsb.auroralink;

import net.milkbowl.vault.economy.Economy;
import org.bukkit.Bukkit;
import org.bukkit.command.PluginCommand;
import org.bukkit.plugin.RegisteredServiceProvider;
import org.bukkit.plugin.java.JavaPlugin;

public final class AuroraLinkPlugin extends JavaPlugin {
  private LinkStore linkStore;
  private BridgeHttpServer bridgeServer;
  private PlayerActions playerActions;
  private Economy economy;

  @Override
  public void onEnable() {
    saveDefaultConfig();
    startServices();
  }

  @Override
  public void onDisable() {
    stopServices();
  }

  public void reloadAurora() {
    stopServices();
    reloadConfig();
    startServices();
  }

  public LinkStore linkStore() {
    return linkStore;
  }

  public Economy economy() {
    return economy;
  }

  public boolean isBridgeRunning() {
    return bridgeServer != null && bridgeServer.isRunning();
  }

  private void startServices() {
    linkStore = new LinkStore(this);
    linkStore.load();
    economy = loadVaultEconomy();
    playerActions = new PlayerActions(this, linkStore, economy);

    registerCommands();

    if (getConfig().getBoolean("api.enabled", true)) {
      bridgeServer = new BridgeHttpServer(this, linkStore, playerActions);
      bridgeServer.start();
    } else {
      getLogger().warning("AuroraLink web API is disabled in config.yml.");
    }
  }

  private void stopServices() {
    if (bridgeServer != null) {
      bridgeServer.stop();
      bridgeServer = null;
    }
    if (linkStore != null) {
      linkStore.save();
    }
  }

  private void registerCommands() {
    PluginCommand webAuth = getCommand("webauth");
    if (webAuth != null) {
      webAuth.setExecutor(new WebAuthCommand(this, linkStore));
    }

    PluginCommand admin = getCommand("auroralink");
    if (admin != null) {
      AuroraAdminCommand command = new AuroraAdminCommand(this);
      admin.setExecutor(command);
      admin.setTabCompleter(command);
    }
  }

  private Economy loadVaultEconomy() {
    if (Bukkit.getPluginManager().getPlugin("Vault") == null) {
      getLogger().info("Vault was not found. Money rewards will be skipped, but web linking still works.");
      return null;
    }

    RegisteredServiceProvider<Economy> provider =
        Bukkit.getServicesManager().getRegistration(Economy.class);
    if (provider == null) {
      getLogger().warning("Vault is installed, but no economy provider is registered.");
      return null;
    }

    getLogger().info("Hooked Vault economy provider: " + provider.getProvider().getName());
    return provider.getProvider();
  }
}
