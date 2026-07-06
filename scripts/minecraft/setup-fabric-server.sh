#!/usr/bin/env bash
set -euo pipefail

SERVER_DIR="${FABRIC_SERVER_DIR:-$HOME/minecraft-fabric}"
MINECRAFT_VERSION="${MINECRAFT_VERSION:-26.1.2}"
FABRIC_LOADER_VERSION="${FABRIC_LOADER_VERSION:-0.19.3}"
FABRIC_INSTALLER_VERSION="${FABRIC_INSTALLER_VERSION:-1.1.1}"
MEMORY_XMS="${MEMORY_XMS:-1G}"
MEMORY_XMX="${MEMORY_XMX:-4G}"
SERVER_PORT="${SERVER_PORT:-25565}"

mkdir -p "$SERVER_DIR/mods" "$SERVER_DIR/backups"
cd "$SERVER_DIR"

curl -fsSL \
  "https://meta.fabricmc.net/v2/versions/loader/${MINECRAFT_VERSION}/${FABRIC_LOADER_VERSION}/${FABRIC_INSTALLER_VERSION}/server/jar" \
  -o fabric-server-launch.jar

cat > eula.txt <<'EULA'
eula=true
EULA

if [ ! -f server.properties ]; then
  cat > server.properties <<EOF
server-port=${SERVER_PORT}
motd=\u00A75\u00A7lVELYX \u00A7f\uACBD\uC81C \uC57C\uC0DD \u00A78| \u00A7bvelyx.kr\n\u00A77\uAC70\uB798 \u00B7 \uD1A0\uC9C0\uBCF4\uD638 \u00B7 \uD568\uAED8 \uD0A4\uC6B0\uB294 \uC6D4\uB4DC
online-mode=true
white-list=true
enable-command-block=true
view-distance=8
simulation-distance=6
max-players=20
spawn-protection=0
EOF
else
  if grep -q '^server-port=' server.properties; then
    sed -i "s/^server-port=.*/server-port=${SERVER_PORT}/" server.properties
  else
    printf '\nserver-port=%s\n' "$SERVER_PORT" >> server.properties
  fi
fi

cat > start.sh <<EOF
#!/usr/bin/env bash
cd "\$(dirname "\$0")"
exec java -Xms${MEMORY_XMS} -Xmx${MEMORY_XMX} -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+DisableExplicitGC -XX:+PerfDisableSharedMem -jar fabric-server-launch.jar nogui
EOF
chmod +x start.sh

echo "Fabric server prepared at $SERVER_DIR"
echo "Minecraft $MINECRAFT_VERSION, Fabric Loader $FABRIC_LOADER_VERSION, port $SERVER_PORT, memory $MEMORY_XMS/$MEMORY_XMX"
