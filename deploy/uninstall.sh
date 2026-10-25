#!/usr/bin/env bash
# Augenblick – Entfernen von einem Pi (Gegenstück zu install.sh)
#
# Stoppt die Dienste und entfernt Units, Update-Programm, Programmversionen und Konfiguration.
# Daten (SQLite unter /var/lib/augenblick) und Benutzer bleiben, außer mit --purge.
# Das systemweite Node unter /opt/node (nur 32 bit) und die Watchdog-Zeile in der
# Boot-Konfiguration bleiben, außer mit --remove-node bzw. --remove-watchdog.
#
# Aufruf:  sudo ./deploy/uninstall.sh [--purge] [--remove-node] [--remove-watchdog]
set -euo pipefail

PURGE=0
REMOVE_NODE=0
REMOVE_WATCHDOG=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --purge) PURGE=1; shift ;;
    --remove-node) REMOVE_NODE=1; shift ;;
    --remove-watchdog) REMOVE_WATCHDOG=1; shift ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "Unbekannte Option: $1" >&2; exit 2 ;;
  esac
done

log() { echo; echo "==> $*"; }
[[ $EUID -eq 0 ]] || { echo "Bitte mit sudo ausführen." >&2; exit 1; }

log "Dienste stoppen"
for unit in augenblick-api.service augenblick-worker.service augenblick-update.timer \
  augenblick-update.service augenblick-restart.path augenblick-restart.service; do
  systemctl disable --now "$unit" 2>/dev/null || true
done

log "Units, Update-Programm und Watchdog-Einstellung für systemd entfernen"
rm -f /etc/systemd/system/augenblick-*.service /etc/systemd/system/augenblick-*.timer \
  /etc/systemd/system/augenblick-*.path /usr/local/sbin/augenblick-update \
  /etc/systemd/system.conf.d/augenblick-watchdog.conf
systemctl daemon-reload

log "Programmversionen und Konfiguration entfernen"
rm -rf /opt/augenblick /etc/augenblick /var/cache/augenblick-update

if [[ $PURGE -eq 1 ]]; then
  log "Daten und Benutzer entfernen (--purge)"
  rm -rf /var/lib/augenblick
  for u in augenblick augenblick-update; do
    if id "$u" >/dev/null 2>&1; then userdel "$u"; fi
  done
else
  echo "Daten unter /var/lib/augenblick und die Benutzer augenblick, augenblick-update bleiben (entfernen mit --purge)."
fi

if [[ $REMOVE_NODE -eq 1 && -d /opt/node ]]; then
  log "Systemweites Node unter /opt/node entfernen (--remove-node)"
  for bin in node npm npx; do
    if [[ "$(readlink "/usr/local/bin/$bin" 2>/dev/null)" == /opt/node/* ]]; then rm -f "/usr/local/bin/$bin"; fi
  done
  rm -rf /opt/node
fi

if [[ $REMOVE_WATCHDOG -eq 1 ]]; then
  log "Watchdog-Zeile aus der Boot-Konfiguration entfernen (--remove-watchdog)"
  for cfg in /boot/firmware/config.txt /boot/config.txt; do
    if [[ -f "$cfg" ]]; then sed -i '/^dtparam=watchdog=on$/d' "$cfg"; fi
  done
fi

echo
echo "Augenblick ist entfernt."
