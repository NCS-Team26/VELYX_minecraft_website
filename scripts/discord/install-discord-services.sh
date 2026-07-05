#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/mincraft_server_website}"
ENV_FILE="${ENV_FILE:-$HOME/discord-bot.env}"
ENABLE_SERVICES="${ENABLE_DISCORD_SERVICES:-false}"

if [ ! -d "$REPO_DIR" ]; then
  echo "Missing repo directory: $REPO_DIR" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js and npm are required before enabling Discord services." >&2
  echo "On Debian: sudo apt-get update && sudo apt-get install -y nodejs npm" >&2
  exit 1
fi

cd "$REPO_DIR"
npm ci --omit=dev

if [ ! -f "$ENV_FILE" ]; then
  cp "$REPO_DIR/infra/discord/discord-bot.env.example" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "Created $ENV_FILE. Fill DISCORD_TOKEN/DISCORD_CLIENT_ID or DISCORD_STOCK_WEBHOOK_URL before enabling."
fi

sudo cp "$REPO_DIR/infra/discord/nfoifsb-discord-bot.service" /etc/systemd/system/nfoifsb-discord-bot.service
sudo cp "$REPO_DIR/infra/discord/nfoifsb-discord-stock-webhook.service" /etc/systemd/system/nfoifsb-discord-stock-webhook.service
sudo systemctl daemon-reload

if [ "$ENABLE_SERVICES" = "true" ]; then
  if grep -q '^DISCORD_STOCK_WEBHOOK_URL=https://discord.com/api/webhooks/' "$ENV_FILE"; then
    sudo systemctl enable --now nfoifsb-discord-stock-webhook.service
  else
    echo "Skipping stock webhook service: DISCORD_STOCK_WEBHOOK_URL is not set."
  fi

  if grep -q '^DISCORD_TOKEN=.' "$ENV_FILE" && grep -q '^DISCORD_CLIENT_ID=.' "$ENV_FILE"; then
    npm run discord:register
    sudo systemctl enable --now nfoifsb-discord-bot.service
  else
    echo "Skipping slash-command bot service: DISCORD_TOKEN or DISCORD_CLIENT_ID is not set."
  fi
fi

echo "Discord service files installed."
