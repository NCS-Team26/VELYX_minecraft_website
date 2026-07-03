package kr.nfoifsb.auroralink;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.scheduler.BukkitTask;

public final class LinkStore {
  private static final SecureRandom RANDOM = new SecureRandom();

  private final AuroraLinkPlugin plugin;
  private final Gson gson = new GsonBuilder().setPrettyPrinting().create();
  private final Path dataPath;
  private StoredData data = new StoredData();
  private BukkitTask saveTask;

  public LinkStore(AuroraLinkPlugin plugin) {
    this.plugin = plugin;
    this.dataPath = plugin.getDataFolder().toPath().resolve("links.json");
  }

  public synchronized void load() {
    try {
      Files.createDirectories(dataPath.getParent());
      if (!Files.exists(dataPath)) {
        data = new StoredData();
        save();
        return;
      }
      try (Reader reader = Files.newBufferedReader(dataPath, StandardCharsets.UTF_8)) {
        StoredData loaded = gson.fromJson(reader, StoredData.class);
        data = loaded == null ? new StoredData() : loaded.ensureMaps();
      }
      cleanupExpired();
    } catch (IOException error) {
      plugin.getLogger().severe("Failed to load AuroraLink data: " + error.getMessage());
      data = new StoredData();
    }
  }

  public synchronized void save() {
    if (saveTask != null) {
      saveTask.cancel();
      saveTask = null;
    }
    saveNow();
  }

  private void saveNow() {
    writeJson(gson.toJson(data.ensureMaps()));
  }

  private synchronized void requestSave() {
    if (!plugin.isEnabled()) {
      saveNow();
      return;
    }
    if (saveTask != null) return;
    saveTask =
        Bukkit.getScheduler()
            .runTaskLaterAsynchronously(
                plugin,
                () -> {
                  String json;
                  synchronized (this) {
                    saveTask = null;
                    json = gson.toJson(data.ensureMaps());
                  }
                  writeJson(json);
                },
                20L);
  }

  private void writeJson(String json) {
    try {
      Files.createDirectories(dataPath.getParent());
      Files.writeString(dataPath, json, StandardCharsets.UTF_8);
    } catch (IOException error) {
      plugin.getLogger().severe("Failed to save AuroraLink data: " + error.getMessage());
    }
  }

  public synchronized PendingVerification startVerification(String nickname, Map<String, Object> account) {
    cleanupExpired();
    String accountKey = accountKey(account);
    String code = newCode();
    Instant now = Instant.now();
    long expiresAt =
        now.plus(Duration.ofMinutes(plugin.getConfig().getLong("verification.code-expire-minutes", 10))).toEpochMilli();

    return storePendingVerification(nickname, accountKey, code, now.toEpochMilli(), expiresAt);
  }

  public synchronized PendingVerification startVerification(
      String nickname, Map<String, Object> account, String code, long expiresAt) {
    cleanupExpired();
    return storePendingVerification(nickname, accountKey(account), code, Instant.now().toEpochMilli(), expiresAt);
  }

  private PendingVerification storePendingVerification(
      String nickname, String accountKey, String code, long requestedAt, long expiresAt) {
    PendingVerification pending = new PendingVerification();
    pending.nickname = nickname;
    pending.nicknameKey = key(nickname);
    pending.accountKey = accountKey;
    pending.code = code;
    pending.requestedAt = requestedAt;
    pending.expiresAt = expiresAt;
    data.pendingByCode.entrySet().removeIf(entry ->
        Objects.equals(entry.getValue().nicknameKey, pending.nicknameKey)
            || Objects.equals(entry.getValue().accountKey, pending.accountKey));
    data.pendingByCode.put(code, pending);
    requestSave();
    return pending;
  }

  public synchronized LinkResult confirm(Player player, String code) {
    cleanupExpired();
    PendingVerification pending = data.pendingByCode.remove(code);
    if (pending == null) {
      requestSave();
      return LinkResult.failed("Verification code was not found or has expired.");
    }

    String playerNameKey = key(player.getName());
    if (!Objects.equals(pending.nicknameKey, playerNameKey)) {
      data.pendingByCode.put(code, pending);
      requestSave();
      return LinkResult.failed("The website nickname does not match this player.");
    }

    LinkedPlayer link = new LinkedPlayer();
    link.nickname = player.getName();
    link.nicknameKey = playerNameKey;
    link.uuid = player.getUniqueId().toString();
    link.accountKey = pending.accountKey;
    link.webToken = newToken();
    link.verifiedAt = Instant.now().toEpochMilli();
    link.tokenExpiresAt =
        Instant.now()
            .plus(Duration.ofDays(plugin.getConfig().getLong("verification.web-token-days", 30)))
            .toEpochMilli();

    data.linksByAccount.put(link.accountKey, link);
    data.linksByNickname.put(link.nicknameKey, link);
    requestSave();
    return LinkResult.success(link);
  }

  public synchronized LinkedPlayer findLink(Map<String, Object> account, String nickname) {
    cleanupExpired();
    LinkedPlayer link = data.linksByAccount.get(accountKey(account));
    if (link == null || !Objects.equals(link.nicknameKey, key(nickname))) {
      return null;
    }
    return link;
  }

  public synchronized PendingVerification findPending(Map<String, Object> account, String nickname, String code) {
    cleanupExpired();
    String accountKey = accountKey(account);
    String nicknameKey = key(nickname);
    String requestedCode = String.valueOf(code).trim();
    PendingVerification direct = data.pendingByCode.get(requestedCode);
    if (direct != null
        && Objects.equals(direct.accountKey, accountKey)
        && Objects.equals(direct.nicknameKey, nicknameKey)) {
      return direct;
    }
    if (!requestedCode.isBlank()) {
      return null;
    }
    return data.pendingByCode.values().stream()
        .filter(pending ->
            Objects.equals(pending.accountKey, accountKey)
                && Objects.equals(pending.nicknameKey, nicknameKey))
        .findFirst()
        .orElse(null);
  }

  public synchronized LinkedPlayer linkExternal(Map<String, Object> account, String nickname, String uuid) {
    cleanupExpired();
    String accountKey = accountKey(account);
    String nicknameKey = key(nickname);
    LinkedPlayer link = data.linksByAccount.get(accountKey);
    if (link == null) {
      link = new LinkedPlayer();
      link.webToken = newToken();
    }
    link.nickname = nickname;
    link.nicknameKey = nicknameKey;
    link.uuid = uuid == null || uuid.isBlank() ? nicknameKey : uuid;
    link.accountKey = accountKey;
    if (link.webToken == null || link.webToken.isBlank()) link.webToken = newToken();
    link.verifiedAt = Instant.now().toEpochMilli();
    link.tokenExpiresAt =
        Instant.now()
            .plus(Duration.ofDays(plugin.getConfig().getLong("verification.web-token-days", 30)))
            .toEpochMilli();

    data.linksByAccount.put(accountKey, link);
    data.linksByNickname.put(nicknameKey, link);
    data.pendingByCode.entrySet().removeIf(entry ->
        Objects.equals(entry.getValue().nicknameKey, nicknameKey)
            && Objects.equals(entry.getValue().accountKey, accountKey));
    requestSave();
    return link;
  }

  public synchronized LinkedPlayer validateToken(String nickname, String token) {
    cleanupExpired();
    if (token == null || token.isBlank()) return null;
    LinkedPlayer link = data.linksByNickname.get(key(nickname));
    if (link == null || !Objects.equals(link.webToken, token)) return null;
    if (link.tokenExpiresAt > 0 && link.tokenExpiresAt < Instant.now().toEpochMilli()) return null;
    return link;
  }

  public synchronized long remainingCooldownMillis(String playerKey, String action, long cooldownMillis) {
    if (cooldownMillis <= 0) return 0;
    Map<String, Long> playerCooldowns = data.cooldowns.getOrDefault(playerKey, Map.of());
    long last = playerCooldowns.getOrDefault(action, 0L);
    long elapsed = Instant.now().toEpochMilli() - last;
    return Math.max(0, cooldownMillis - elapsed);
  }

  public synchronized void markCooldown(String playerKey, String action) {
    data.cooldowns.computeIfAbsent(playerKey, ignored -> new HashMap<>()).put(action, Instant.now().toEpochMilli());
    requestSave();
  }

  public synchronized int linkedCount() {
    cleanupExpired();
    return data.linksByNickname.size();
  }

  public static String accountKey(Map<String, Object> account) {
    if (account == null) return "anonymous:unknown";
    String provider = value(account.get("provider"), "site").toLowerCase(Locale.ROOT);
    String sub = value(account.get("sub"), "");
    String email = value(account.get("email"), "").toLowerCase(Locale.ROOT);
    String name = value(account.get("name"), "").toLowerCase(Locale.ROOT);
    if (!sub.isBlank()) return provider + ":sub:" + sub;
    if (!email.isBlank()) return provider + ":email:" + email;
    return provider + ":name:" + name;
  }

  public static String key(String value) {
    return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
  }

  public static String value(Object value, String fallback) {
    return value == null ? fallback : String.valueOf(value);
  }

  private void cleanupExpired() {
    long now = Instant.now().toEpochMilli();
    data.ensureMaps();
    data.pendingByCode.entrySet().removeIf(entry -> entry.getValue().expiresAt < now);
    data.linksByAccount.entrySet().removeIf(entry -> entry.getValue().tokenExpiresAt > 0 && entry.getValue().tokenExpiresAt < now);
    data.linksByNickname.entrySet().removeIf(entry -> entry.getValue().tokenExpiresAt > 0 && entry.getValue().tokenExpiresAt < now);
  }

  private static String newCode() {
    return String.valueOf(100000 + RANDOM.nextInt(900000));
  }

  private static String newToken() {
    byte[] bytes = new byte[32];
    RANDOM.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  public static final class StoredData {
    Map<String, PendingVerification> pendingByCode = new HashMap<>();
    Map<String, LinkedPlayer> linksByAccount = new HashMap<>();
    Map<String, LinkedPlayer> linksByNickname = new HashMap<>();
    Map<String, Map<String, Long>> cooldowns = new HashMap<>();

    StoredData ensureMaps() {
      if (pendingByCode == null) pendingByCode = new HashMap<>();
      if (linksByAccount == null) linksByAccount = new HashMap<>();
      if (linksByNickname == null) linksByNickname = new HashMap<>();
      if (cooldowns == null) cooldowns = new HashMap<>();
      return this;
    }
  }

  public static final class PendingVerification {
    public String nickname;
    public String nicknameKey;
    public String accountKey;
    public String code;
    public long requestedAt;
    public long expiresAt;
  }

  public static final class LinkedPlayer {
    public String nickname;
    public String nicknameKey;
    public String uuid;
    public String accountKey;
    public String webToken;
    public long verifiedAt;
    public long tokenExpiresAt;
  }

  public static final class LinkResult {
    public final boolean success;
    public final String message;
    public final LinkedPlayer link;

    private LinkResult(boolean success, String message, LinkedPlayer link) {
      this.success = success;
      this.message = message;
      this.link = link;
    }

    public static LinkResult success(LinkedPlayer link) {
      return new LinkResult(true, "Website account linked to your character.", link);
    }

    public static LinkResult failed(String message) {
      return new LinkResult(false, message, null);
    }
  }
}
