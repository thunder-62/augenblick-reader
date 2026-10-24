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
[[ "$(uname -m)" == "aarch64" ]] || echo "Hinweis: gedacht für Raspberry Pi OS 64 bit (aarch64), gefunden: $(uname -m)."

log "Systempakete"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
# build-essential/python3: falls für better-sqlite3 kein passendes arm64-Prebuild existiert
apt-get install -y -q ca-certificates curl gnupg tar build-essential python3

log "Node.js $NODE_MAJOR"
if ! command -v node >/dev/null || [[ "$(node -p 'process.versions.node.split(".")[0]')" != "$NODE_MAJOR" ]]; then
  install -d -m 755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -q
  apt-get install -y -q nodejs
fi
node --version

log "Benutzer und Verzeichnisse"
id augenblick >/dev/null 2>&1 || useradd --system --home-dir "$DATA_DIR" --no-create-home --shell /usr/sbin/nologin augenblick
install -d -m 755 "$APP_DIR" "$APP_DIR/releases"
install -d -m 750 -o augenblick -g augenblick "$DATA_DIR"
install -d -m 750 -o root -g augenblick "$CONF_DIR"

log "Konfiguration ($ENV_FILE)"
if [[ ! -f "$ENV_FILE" ]]; then
  sed -e 's|^HOST=.*|HOST=0.0.0.0|' -e "s|^AUGENBLICK_DATA_DIR=.*|AUGENBLICK_DATA_DIR=$DATA_DIR|" \
    "$REPO_DIR/.env.example" > "$ENV_FILE"
  echo "Neu angelegt aus .env.example – bei Bedarf anpassen (z. B. BR24_FEED_URL, AUGENBLICK_THEME)."
else
  echo "Vorhanden, bleibt unverändert."
fi
chown root:augenblick "$ENV_FILE"
chmod 640 "$ENV_FILE"

log "systemd-Dienste und Update-Programm"
install -m 644 "$SCRIPT_DIR"/systemd/*.service "$SCRIPT_DIR"/systemd/*.timer /etc/systemd/system/
install -m 755 "$SCRIPT_DIR/update.sh" /usr/local/sbin/augenblick-update

log "Hardware-Watchdog"
install -d -m 755 /etc/systemd/system.conf.d
cat > /etc/systemd/system.conf.d/augenblick-watchdog.conf <<'CONF'
# Startet den Pi neu, wenn das System hängt (SPEC §9).
[Manager]
RuntimeWatchdogSec=15
RebootWatchdogSec=2min
CONF
BOOT_CONFIG=/boot/firmware/config.txt
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

systemctl enable --quiet augenblick-api augenblick-worker augenblick-update.timer
systemctl start augenblick-api augenblick-worker augenblick-update.timer

log "Prüfung"
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT:-8080}/health" >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS "http://127.0.0.1:${PORT:-8080}/health" && echo

cat <<MSG

Fertig. Augenblick läuft unter http://$(hostname):${PORT:-8080}/
  Status:   systemctl status augenblick-api augenblick-worker
  Logs:     journalctl -u augenblick-worker -f
  Update:   sudo augenblick-update   (läuft sonst jede Nacht um 03:00)

Tailscale (Fernwartung, später HTTPS): siehe deploy/README.md
MSG
