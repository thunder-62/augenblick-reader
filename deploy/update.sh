#!/usr/bin/env bash
# Augenblick – Update (SPEC §9)
#
# Lädt das neueste GitHub-Release (oder ein lokales Paket), entpackt es nach
# /opt/augenblick/releases/<version>, installiert die Abhängigkeiten, stellt den
# Symlink „current“ um, startet die Dienste neu und prüft /health. Schlägt der
# Healthcheck fehl, geht es zurück auf die vorige Version. Die letzten 3 Versionen bleiben liegen.
#
# Aufruf:  augenblick-update [--file PAKET.tar.gz] [--force]
# Nachts läuft es als Benutzer augenblick-update (ADR 012), von Hand auch mit sudo.
set -euo pipefail

APP_DIR="${AUGENBLICK_APP_DIR:-/opt/augenblick}"
RELEASES="$APP_DIR/releases"
CURRENT="$APP_DIR/current"
REPO="${AUGENBLICK_REPO:-thunder-62/augenblick-reader}"
PORT="${PORT:-8080}"
HEALTH_URL="${AUGENBLICK_HEALTH_URL:-http://127.0.0.1:$PORT/health}"
KEEP=3
# Version, deren Healthcheck fehlschlug – wird nachts nicht erneut versucht (nur mit --force).
FAILED_MARK="$APP_DIR/failed-version"
SYSTEMCTL="${SYSTEMCTL:-systemctl}"
SERVICES=(augenblick-api augenblick-worker)

FILE=""
FORCE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --file) FILE="$2"; shift 2 ;;
    --force) FORCE=1; shift ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) echo "Unbekannte Option: $1" >&2; exit 2 ;;
  esac
done

log() { echo "[augenblick-update] $*"; }
die() { echo "[augenblick-update] FEHLER: $*" >&2; exit 1; }

current_version() {
  if [[ -L "$CURRENT" && -f "$CURRENT/VERSION" ]]; then cat "$CURRENT/VERSION"; else echo ""; fi
}

# Gesund heißt: /health antwortet mit „ok“ und meldet die erwartete Version.
healthy() {
  local expected="$1" body
  for _ in $(seq 1 30); do
    body="$(curl -fsS --max-time 3 "$HEALTH_URL" 2>/dev/null || true)"
    if grep -q '"status":"ok"' <<<"$body" && grep -q "\"version\":\"$expected\"" <<<"$body"; then return 0; fi
    sleep 1
  done
  return 1
}

# Als root direkt, sonst (nächtlicher Dienst als augenblick-update, ADR 012) über die Pfad-Unit
# augenblick-restart.path. Der Healthcheck wartet ohnehin, bis die neue Version antwortet.
RESTART_REQUEST="$APP_DIR/restart-request"
restart_services() {
  if [[ $EUID -eq 0 ]]; then
    $SYSTEMCTL restart "${SERVICES[@]}"
  else
    : > "$RESTART_REQUEST"
  fi
}

switch_to() {
  ln -sfn "$1" "$APP_DIR/current.new"
  mv -T "$APP_DIR/current.new" "$CURRENT"
}

# Von Hand mit sudo gestartet: alles unter $APP_DIR gehört danach wieder dem Update-Benutzer,
# damit das nächtliche Update (ohne Root-Rechte) weiterarbeiten kann (ADR 012).
UPDATE_USER="${AUGENBLICK_UPDATE_USER:-augenblick-update}"
finish() {
  rm -rf "$WORK"
  if [[ $EUID -eq 0 ]] && id "$UPDATE_USER" >/dev/null 2>&1; then
    chown -R "$UPDATE_USER:$UPDATE_USER" "$APP_DIR" || true
  fi
}
WORK="$(mktemp -d)"
trap finish EXIT
mkdir -p "$RELEASES"

if [[ -z "$FILE" ]]; then
  log "Frage neuestes Release von $REPO ab …"
  curl -fsSL --max-time 30 -H 'Accept: application/vnd.github+json' \
    "https://api.github.com/repos/$REPO/releases/latest" -o "$WORK/release.json" \
    || die "Release-Information nicht abrufbar"
  read -r TAG ASSET_URL SUM_URL < <(node -e '
    const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const a = (r.assets || []).find((x) => /^augenblick-.*\.tar\.gz$/.test(x.name));
    const s = (r.assets || []).find((x) => /^augenblick-.*\.tar\.gz\.sha256$/.test(x.name));
    if (!a) process.exit(3);
    console.log(r.tag_name, a.browser_download_url, s ? s.browser_download_url : "-");
  ' "$WORK/release.json") || die "Release enthält kein Paket"
  VERSION_NEW="${TAG#v}"
  if [[ "$VERSION_NEW" == "$(current_version)" && $FORCE -eq 0 ]]; then
    log "Version $VERSION_NEW ist bereits aktiv – nichts zu tun."
    exit 0
  fi
  if [[ -f "$FAILED_MARK" && "$(cat "$FAILED_MARK")" == "$VERSION_NEW" && $FORCE -eq 0 ]]; then
    log "Version $VERSION_NEW ist früher fehlgeschlagen – übersprungen (erneut versuchen mit --force)."
    exit 0
  fi
  FILE="$WORK/$(basename "$ASSET_URL")"
  log "Lade $ASSET_URL"
  curl -fsSL --max-time 300 "$ASSET_URL" -o "$FILE" || die "Download fehlgeschlagen"
  if [[ "$SUM_URL" != "-" ]]; then
    curl -fsSL --max-time 30 "$SUM_URL" -o "$FILE.sha256" || die "Prüfsumme nicht abrufbar"
    (cd "$WORK" && sha256sum -c "$(basename "$FILE").sha256" >/dev/null) || die "Prüfsumme stimmt nicht"
  fi
fi

[[ -f "$FILE" ]] || die "Paket nicht gefunden: $FILE"
tar -xzf "$FILE" -C "$WORK"
SRC="$(find "$WORK" -mindepth 1 -maxdepth 1 -type d -name 'augenblick-*' | head -n1)"
[[ -n "$SRC" && -f "$SRC/VERSION" ]] || die "Paket hat keine VERSION-Datei"
VERSION_NEW="$(cat "$SRC/VERSION")"
TARGET="$RELEASES/$VERSION_NEW"
PREVIOUS="$(readlink -f "$CURRENT" 2>/dev/null || true)"

if [[ "$VERSION_NEW" == "$(current_version)" && $FORCE -eq 0 ]]; then
  log "Version $VERSION_NEW ist bereits aktiv – nichts zu tun."
  exit 0
fi

log "Installiere Version $VERSION_NEW nach $TARGET"
if [[ "$PREVIOUS" == "$TARGET" ]]; then
  # Dieselbe Version erneut (--force): erst neben der aktiven Version aufbauen.
  TARGET="$RELEASES/$VERSION_NEW-$(date +%Y%m%d%H%M%S)"
fi
rm -rf "$TARGET.tmp"
mv "$SRC" "$TARGET.tmp"
(cd "$TARGET.tmp" && npm ci --omit=dev --no-audit --no-fund --loglevel=error) || die "npm ci fehlgeschlagen"
rm -rf "$TARGET"
mv "$TARGET.tmp" "$TARGET"

switch_to "$TARGET"
restart_services || true

if healthy "$VERSION_NEW"; then
  log "Version $VERSION_NEW läuft, Healthcheck in Ordnung."
  rm -f "$FAILED_MARK"
else
  log "Healthcheck fehlgeschlagen."
  echo "$VERSION_NEW" > "$FAILED_MARK"
  if [[ -n "$PREVIOUS" && -d "$PREVIOUS" ]]; then
    log "Zurück auf $(basename "$PREVIOUS")."
    switch_to "$PREVIOUS"
    restart_services || true
    if healthy "$(cat "$PREVIOUS/VERSION" 2>/dev/null)"; then
      log "Vorige Version läuft wieder."
    else
      log "Auch die vorige Version antwortet nicht – bitte Logs prüfen: journalctl -u augenblick-api"
    fi
    rm -rf "$TARGET"
  fi
  exit 1
fi

# Update-Programm und systemd-Units sind root-eigen und ändern sich nur mit install.sh (ADR 012).
if [[ "$APP_DIR" == "/opt/augenblick" && -d "$TARGET/deploy" ]]; then
  stale=0
  cmp -s "$TARGET/deploy/update.sh" /usr/local/sbin/augenblick-update || stale=1
  for unit in "$TARGET"/deploy/systemd/*; do
    cmp -s "$unit" "/etc/systemd/system/$(basename "$unit")" || stale=1
  done
  if [[ $stale -eq 1 ]]; then
    log "Hinweis: Update-Programm oder systemd-Units sind neuer – bitte einmal ausführen:"
    log "  sudo $TARGET/deploy/install.sh --file <Paket>  (oder aus einem Klon: sudo ./deploy/install.sh)"
  fi
fi

# Aufräumen: die letzten $KEEP Versionen behalten, die aktive und die vorige nie löschen.
ACTIVE="$(readlink -f "$CURRENT")"
mapfile -t ALL < <(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | cut -d' ' -f2-)
count=0
for dir in "${ALL[@]}"; do
  count=$((count + 1))
  if [[ $count -le $KEEP || "$dir" == "$ACTIVE" || "$dir" == "$PREVIOUS" ]]; then continue; fi
  log "Entferne alte Version $(basename "$dir")"
  rm -rf "$dir"
done
