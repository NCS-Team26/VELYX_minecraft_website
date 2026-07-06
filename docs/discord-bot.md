# Discord Bot Bridge

This bot connects Discord slash commands to the existing AuroraLink website and Minecraft API.

Target Discord invite checked on 2026-07-05:

- Invite: `https://discord.gg/8pJTVEraa`
- Guild: `NCS GROUP`
- Guild ID: `1519722855791726748`
- Invite channel: `webhooks`

## Commands

- `/주식 시장` - public market summary
- `/주식 종목 종목:DMD` - public stock quote with a generated chart image
- `/주식 내계좌` - linked player's stock portfolio
- `/주식 매수 종목:DMD 수량:10` - buy shares with Minecraft server money
- `/주식 매도 종목:DMD 수량:10` - sell shares
- `/주식 지원금` - claim the linked character's daily reward
- `/마크 인증 닉네임:PlayerName` - start Discord-to-Minecraft verification
- `/마크 확인` - finish verification after the player runs `/webauth <code>` in game
- `/마크 상태` - live server status
- `/마크 온라인` - online player list
- `/마크 인벤토리` - linked character inventory summary
- `/마크 공지 내용:...` - send an in-game broadcast, requires Discord Manage Server permission and an admin token
- `/마크 웹` - website links

## Environment

```bash
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_GUILD_ID=1519722855791726748
DISCORD_PLAYER_API_BASE=https://api.velyx.kr/minecraft
DISCORD_SITE_URL=https://www.velyx.kr
DISCORD_MINECRAFT_ADDRESS=velyx.kr
DISCORD_MINECRAFT_ADMIN_TOKEN=optional-auroralink-admin-token
DISCORD_BOT_DATA_DIR=discord-bot/data
DISCORD_PUBLIC_ACTION_REPLIES=true
```

`DISCORD_MINECRAFT_ADMIN_TOKEN` is only needed for `/마크 공지`. It must match AuroraLink's `api.admin-token`.

## Register And Run

```bash
npm ci
npm run discord:register
npm run discord:start
```

Guild command registration is used so command changes appear quickly in the configured Discord server.

## Linux Service Example

```ini
[Unit]
Description=NFOIFSB Discord bridge bot
After=network-online.target

[Service]
WorkingDirectory=/home/ad1969/mincraft_server_website
EnvironmentFile=/home/ad1969/discord-bot.env
ExecStart=/usr/bin/npm run discord:start
Restart=always
RestartSec=8
User=ad1969

[Install]
WantedBy=multi-user.target
```

Run `npm run discord:register` once after changing commands, then restart the service.

## Stock Webhook Notifier

If a webhook URL is created in the Discord `webhooks` channel, the stock notifier can post market summaries, large fills, sharp movers, and API outage alerts without a Discord bot token.

```bash
DISCORD_STOCK_WEBHOOK_URL=https://discord.com/api/webhooks/... npm run discord:stock-webhook:once
DISCORD_STOCK_WEBHOOK_URL=https://discord.com/api/webhooks/... npm run discord:stock-webhook
```

Environment:

```bash
DISCORD_STOCK_WEBHOOK_URL=...
DISCORD_STOCK_WEBHOOK_INTERVAL_SECONDS=60
DISCORD_STOCK_WEBHOOK_SUMMARY_INTERVAL_SECONDS=900
DISCORD_STOCK_WEBHOOK_MIN_CHANGE_PERCENT=2.5
DISCORD_STOCK_WEBHOOK_MIN_TRADE_TOTAL=25000
DISCORD_STOCK_WEBHOOK_API_ALERT_COOLDOWN_SECONDS=1800
DISCORD_STOCK_WEBHOOK_DRY_RUN=false
DISCORD_STOCK_LOCAL_DATA_FILE=/home/ad1969/minecraft/plugins/AuroraLink/stocks.json
```

`DISCORD_STOCK_LOCAL_DATA_FILE` lets the notifier keep posting the last saved AuroraLink stock data while the live `/minecraft/stocks/market` API is unavailable.

On the Fabric server, install `nfoifsb-minecraft-api-bridge.service` so the website and Discord notifier can read `/minecraft/stocks/market` and `/minecraft/server/overview` from `127.0.0.1:8787` again:

```bash
./scripts/minecraft/install-api-bridge.sh
```

The bridge is read-only for player-sensitive actions. Live buy/sell slash commands still require a Fabric gameplay bridge with token validation and economy access.

Linux service example:

```ini
[Unit]
Description=NFOIFSB Discord stock webhook
After=network-online.target

[Service]
WorkingDirectory=/home/ad1969/mincraft_server_website
EnvironmentFile=/home/ad1969/discord-bot.env
ExecStart=/usr/bin/npm run discord:stock-webhook
Restart=always
RestartSec=8
User=ad1969

[Install]
WantedBy=multi-user.target
```

The repo also includes ready-to-copy service files:

- `infra/discord/nfoifsb-discord-bot.service`
- `infra/discord/nfoifsb-discord-stock-webhook.service`
- `infra/discord/discord-bot.env.example`

Install them on the Raspberry Pi:

```bash
./scripts/discord/install-discord-services.sh
```

After filling `/home/ad1969/discord-bot.env`, enable the webhook notifier:

```bash
sudo systemctl enable --now nfoifsb-discord-stock-webhook.service
```
