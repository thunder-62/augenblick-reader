#!/usr/bin/env bash
# Augenblick – Einrichtung auf einem frischen Raspberry Pi OS Lite (64 bit) (SPEC §9)
#
# Richtet Benutzer, Verzeichnisse, Node.js 22, Konfiguration, systemd-Dienste,
# Hardware-Watchdog und das nächtliche Update ein und installiert ein Release.
# Idempotent: kann beliebig oft ausgeführt werden.
#
# Aufruf (als root, aus einem Klon des Repos):
#   sudo ./deploy/install.sh                 # neuestes GitHub-Release
#   sudo ./deploy/install.sh --file X.tar.gz # lokales Release-Paket
#   sudo ./deploy/install.sh --from-source   # aus diesem Klon bauen (wenn es noch kein Release gibt)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR=/opt/augenblick
DATA_DIR=/var/lib/augenblick
CONF_DIR=/etc/augenblick
ENV_FILE="$CONF_DIR/augenblick.env"
NODE_MAJOR=22

MODE="release"
FILE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --file) MODE="file"; FILE="$(readlink -f "$2")"; shift 2 ;;
    --from-source) MODE="source"; shift ;;
    -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
    *) echo "Unbekannte Option: $1" >&2; exit 2 ;;
  esac
done

log() { echo; echo "==> $*"; }
[[ $EUID -eq 0 ]] || { echo "Bitte mit sudo ausführen." >&2; exit 1; }
[[ "$(uname -m)" == "aarch64" || "$(uname -m)" == "armv7l" ]] || echo "Hinweis: gedacht für Raspberry Pi OS (aarch64 oder armv7l), gefunden: $(uname -m)."

log "Systempakete"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
# build-essential/python3: falls für better-sqlite3 kein passendes Prebuild existiert (z. B. armhf)
apt-get install -y -q ca-certificates curl gnupg tar xz-utils build-essential python3

log "Node.js $NODE_MAJOR"
# Die Dienste brauchen ein systemweites Node (nicht nvm im Home-Verzeichnis eines Benutzers).
# Ein per nvm installiertes Node bleibt unberührt (ADR 015).
ARCH="$(dpkg --print-architecture)"
system_node_ok() {
  local n
  for n in /usr/local/bin/node /usr/bin/node; do
    if [[ -x "$n" && "$("$n" -p 'process.versions.node.split(".")[0]')" == "$NODE_MAJOR" ]]; then return 0; fi
  done
  return 1
}
if system_node_ok; then
  echo "Systemweites Node.js $NODE_MAJOR vorhanden."
elif [[ "$ARCH" == "armhf" ]]; then
  # 32-bit Raspberry Pi OS: NodeSource liefert dafür keine aktuellen Pakete –
  # offizielles Archiv von nodejs.org (armv7l), Prüfsumme gegen SHASUMS256.txt.
  NODE_DIST="https://nodejs.org/dist/latest-v$NODE_MAJOR.x"
  TMP_NODE="$(mktemp -d)"
  curl -fsSL "$NODE_DIST/SHASUMS256.txt" -o "$TMP_NODE/SHASUMS256.txt"
  NODE_TAR="$(grep -oE "node-v$NODE_MAJOR\.[0-9.]+-linux-armv7l\.tar\.xz" "$TMP_NODE/SHASUMS256.txt" | head -n1)"
  [[ -n "$NODE_TAR" ]] || { echo "Kein Node.js $NODE_MAJOR für armv7l gefunden." >&2; exit 1; }
  curl -fsSL "$NODE_DIST/$NODE_TAR" -o "$TMP_NODE/$NODE_TAR"
  (cd "$TMP_NODE" && grep " $NODE_TAR\$" SHASUMS256.txt | sha256sum -c -) || { echo "Prüfsumme von $NODE_TAR stimmt nicht." >&2; exit 1; }
  rm -rf /opt/node.new && mkdir -p /opt/node.new
  tar -xJf "$TMP_NODE/$NODE_TAR" -C /opt/node.new --strip-components=1
  rm -rf /opt/node && mv /opt/node.new /opt/node
  for bin in node npm npx; do ln -sfn "/opt/node/bin/$bin" "/usr/local/bin/$bin"; done
  rm -rf "$TMP_NODE"
  echo "Node.js nach /opt/node installiert (${NODE_TAR})."
else
  install -d -m 755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -q
  apt-get install -y -q nodejs
fi
export PATH="/usr/local/bin:/usr/bin:$PATH"
node --version

log "Benutzer und Verzeichnisse"
id augenblick >/dev/null 2>&1 || useradd --system --home-dir "$DATA_DIR" --no-create-home --shell /usr/sbin/nologin augenblick
# Eigener Benutzer für das nächtliche Update: darf nur /opt/augenblick schreiben (ADR 012).
id augenblick-update >/dev/null 2>&1 || useradd --system --home-dir /var/cache/augenblick-update --no-create-home --shell /usr/sbin/nologin augenblick-update
install -d -m 755 -o augenblick-update -g augenblick-update "$APP_DIR" "$APP_DIR/releases"
install -d -m 750 -o augenblick -g augenblick "$DATA_DIR"
install -d -m 750 -o root -g augenblick "$CONF_DIR"

log "Konfiguration ($ENV_FILE)"
if [[ ! -f "$ENV_FILE" ]]; then
  sed -e 's|^HOST=.*|HOST=0.0.0.0|' -e "s|^AUGENBLICK_DATA_DIR=.*|AUGENBLICK_DATA_DIR=$DATA_DIR|" \
    "$REPO_DIR/.env.example" > "$ENV_FILE"
  echo "Neu angelegt aus .env.example – bei Bedarf anpassen (z. B. AUGENBLICK_RSS_FEEDS, OPENROUTER_API_KEY)."
else
  echo "Vorhanden, bleibt unverändert."
fi
chown root:augenblick "$ENV_FILE"
chmod 640 "$ENV_FILE"

log "systemd-Dienste und Update-Programm"
install -m 644 "$SCRIPT_DIR"/systemd/*.service "$SCRIPT_DIR"/systemd/*.timer "$SCRIPT_DIR"/systemd/*.path /etc/systemd/system/
install -m 755 "$SCRIPT_DIR/update.sh" /usr/local/sbin/augenblick-update

log "Hardware-Watchdog"
install -d -m 755 /etc/systemd/system.conf.d
cat > /etc/systemd/system.conf.d/augenblick-watchdog.conf <<'CONF'
# Startet den Pi neu, wenn das System hängt (SPEC §9).
[Manager]
RuntimeWatchdogSec=15
RebootWatchdogSec=2min
CONF
# Bookworm: /boot/firmware/config.txt, ältere Systeme (bullseye): /boot/config.txt
BOOT_CONFIG=/boot/firmware/config.txt
[[ -f "$BOOT_CONFIG" ]] || BOOT_CONFIG=/boot/config.txt
if [[ -f "$BOOT_CONFIG" ]] && ! grep -q '^dtparam=watchdog=on' "$BOOT_CONFIG"; then
  echo 'dtparam=watchdog=on' >> "$BOOT_CONFIG"
  echo "Watchdog in $BOOT_CONFIG eingeschaltet (wirksam nach Neustart)."
fi
systemctl daemon-reexec
systemctl daemon-reload

log "Release installieren"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
# Belegter Port (z. B. durch einen Docker-Container): abbrechen statt den falschen Dienst zu prüfen.
if ss -Hltn "sport = :${PORT:-7341}" | grep -q . && ! systemctl is-active --quiet augenblick-api; then
  echo "Port ${PORT:-7341} ist schon belegt:" >&2
  ss -Hltnp "sport = :${PORT:-7341}" >&2 || true
  echo "Bitte in $ENV_FILE einen freien PORT eintragen (z. B. PORT=7342) und install.sh erneut starten." >&2
  exit 1
fi
case "$MODE" in
  file) /usr/local/sbin/augenblick-update --file "$FILE" --force ;;
  source)
    # Bauen als Besitzer des Klons, nicht als root.
    OWNER="$(stat -c %U "$REPO_DIR")"
    sudo -u "$OWNER" bash -c "cd '$REPO_DIR' && npm ci --no-audit --no-fund && npm run build && npm run package"
    PKG="$(find "$REPO_DIR/release" -maxdepth 1 -name 'augenblick-*.tar.gz' -printf '%T@ %p\n' | sort -nr | head -n1 | cut -d' ' -f2-)"
    /usr/local/sbin/augenblick-update --file "$PKG" --force
    ;;
  release)
    /usr/local/sbin/augenblick-update \
      || { echo "Kein Release installierbar – mit --from-source aus diesem Klon bauen." >&2; exit 1; }
    ;;
esac

# Was root eben installiert hat, gehört danach dem Update-Benutzer (ADR 012).
chown -R augenblick-update:augenblick-update "$APP_DIR"

systemctl enable --quiet augenblick-api augenblick-worker augenblick-update.timer augenblick-restart.path
systemctl start augenblick-api augenblick-worker augenblick-update.timer augenblick-restart.path

log "Prüfung"
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT:-7341}/health" >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS "http://127.0.0.1:${PORT:-7341}/health" && echo

cat <<MSG

Fertig. Augenblick läuft unter http://$(hostname):${PORT:-7341}/
  Status:   systemctl status augenblick-api augenblick-worker
  Logs:     journalctl -u augenblick-worker -f
  Update:   sudo augenblick-update   (läuft sonst jede Nacht um 03:00)
  Technik:  http://$(hostname):${PORT:-7341}/technik (nur im Heimnetz bzw. über Tailscale)

Tailscale (Fernwartung, später HTTPS): siehe deploy/README.md
MSG
