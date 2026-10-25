# Betrieb auf dem Raspberry Pi

Augenblick läuft ohne Docker direkt auf einem Raspberry Pi 5 (SSD, Raspberry Pi OS Lite 64 bit; ein vorhandener Pi 4 mit 32-bit-System geht auch, siehe unten) als zwei systemd-Dienste (SPEC §9):

| Dienst | Aufgabe |
|---|---|
| `augenblick-api` | liefert Web-App und JSON-API (Port aus `PORT`, Standard 7341) |
| `augenblick-worker` | holt Artikel ab (5:00–22:00 alle 30 Minuten), bereinigt sie, stellt die Ausgabe zusammen |
| `augenblick-update.timer` | jede Nacht 03:00: neues Release laden, Healthcheck, bei Fehler zurück |
| `augenblick-restart.path` | startet API und Worker neu, wenn das Update darum bittet (ADR 012) |

Verzeichnisse: Programm unter `/opt/augenblick/releases/<version>` mit Symlink `/opt/augenblick/current`, Daten (SQLite) unter `/var/lib/augenblick`, Konfiguration in `/etc/augenblick/augenblick.env`. Die Dienste laufen als Systembenutzer `augenblick`. Das nächtliche Update läuft als eigener Benutzer `augenblick-update` ohne Root-Rechte: Es darf nur `/opt/augenblick` schreiben und bittet über die Datei `/opt/augenblick/restart-request` um den Neustart (ADR 012).

## Einrichten

Auf einem frisch installierten Pi (mit Netzwerk):

```bash
sudo apt-get install -y git
git clone https://github.com/thunder-62/augenblick-reader.git
cd augenblick-reader
sudo ./deploy/install.sh
```

`install.sh` ist idempotent und kann jederzeit erneut laufen. Varianten:

- `sudo ./deploy/install.sh` – neuestes GitHub-Release installieren
- `sudo ./deploy/install.sh --file augenblick-0.1.0.tar.gz` – ein vorhandenes Release-Paket installieren
- `sudo ./deploy/install.sh --from-source` – aus dem Klon bauen (solange es noch kein Release gibt; dauert auf dem Pi einige Minuten)

Danach die Konfiguration prüfen und bei Bedarf anpassen:

```bash
sudo nano /etc/augenblick/augenblick.env
sudo systemctl restart augenblick-api augenblick-worker
```

Für KI-Zusammenfassungen `OPENROUTER_API_KEY` eintragen (Schlüssel von openrouter.ai), optional `OPENROUTER_MODEL`, `OPENROUTER_FALLBACK_MODEL` und `AUGENBLICK_SUMMARY_DAILY_LIMIT`. Ohne Schlüssel zeigen die Karten den Anreißer der Quelle bzw. die ersten Sätze. Die Datei ist nur für root und den Dienstbenutzer lesbar; sie gehört nie ins Repo.

### Auf einem bestehenden Pi (z. B. Pi 4, 32 bit, mit Docker)

Läuft auf dem Gerät schon anderes, vorher prüfen (ADR 015):

```bash
dpkg --print-architecture        # armhf (32 bit) oder arm64
sudo ss -ltnp | grep 7341        # Port 7341 belegt?
free -h                          # wenig RAM → Paket auf dem PC bauen
```

1. Auf dem PC (Windows geht auch): `npm install && npm run build && npm run package`, dann `release/augenblick-<version>.tar.gz` auf den Pi kopieren (`scp`).
2. Nur falls Port 7341 belegt ist: die Konfiguration mit einem freien Port **vor** der Installation anlegen:
   ```bash
   sudo mkdir -p /etc/augenblick
   sed -e 's|^HOST=.*|HOST=0.0.0.0|' -e 's|^PORT=.*|PORT=7342|' \
       -e 's|^AUGENBLICK_DATA_DIR=.*|AUGENBLICK_DATA_DIR=/var/lib/augenblick|' \
       .env.example | sudo tee /etc/augenblick/augenblick.env >/dev/null
   ```
3. `sudo ./deploy/install.sh --file ~/augenblick-<version>.tar.gz`

Ein Node.js über nvm bleibt unberührt; für die Dienste installiert `install.sh` bei 32 bit ein eigenes Node 22 nach `/opt/node`. Ist der Port belegt, bricht `install.sh` mit einem Hinweis ab. Spätere Stände: neues Paket bauen, kopieren, `sudo augenblick-update --file ~/augenblick-<version>.tar.gz`.

## Leseeinstellungen und Technik-Bereich

Die **Leseeinstellungen** ändert die Leserin selbst auf dem Tablet (Taste „Einstellungen“ in der Übersicht, mit Rückfrage vor dem Speichern). Beim ersten Öffnen führt eine **Einführung** durch Schrift, Farben, Blättern und Artikel öffnen.

Der **Technik-Bereich** liegt unter `http://<name-des-pi>:7341/technik` – ohne PIN, aber nur aus dem Heimnetz bzw. über Tailscale erreichbar (`AUGENBLICK_TECHNIK_NETWORKS`), und auf dem Tablet nicht verlinkt. Dort: Status (Quellen, KI-Verbrauch und -Kosten, Speicher, Version), Leseeinstellungen ansehen und bei einem Versehen auf eine frühere Fassung zurücksetzen, BR24-Feed und Rubriken-Mix, gelernte Interessen (nur Themen-Gewichte), Anrede (Sie/du), Einführung neu starten, Spickzettel zum Ausdrucken.

## Updates

- **Woher:** Jeder Merge nach `main` erzeugt auf GitHub automatisch ein Release `v0.1.<n>` mit fertig gebautem Paket (`.github/workflows/release.yml`, ADR 019). Reine Doku-Änderungen lösen keins aus. Bauen auf dem Pi ist dafür nicht nötig.
- automatisch jede Nacht um 03:00 (`systemctl list-timers augenblick-update.timer`)
- von Hand: `sudo augenblick-update` (oder mit `--file paket.tar.gz`, `--force` für dieselbe Version)

Ablauf: Release laden → Prüfsumme prüfen → nach `/opt/augenblick/releases/<version>` entpacken → `npm ci --omit=dev` → Symlink `current` umstellen → Dienste neu starten → `/health` muss „ok“ und die neue Version melden. Sonst zurück auf die vorige Version. Die letzten 3 Versionen bleiben liegen.

Update-Programm und systemd-Units selbst ändern sich dabei nicht (sie gehören root). Bringt ein Release neuere mit, steht ein Hinweis im Log (`journalctl -u augenblick-update`); dann einmal `sudo ./deploy/install.sh` aus einem aktuellen Klon ausführen.

`better-sqlite3` bringt fertige arm64-Pakete mit. Gibt es keins, baut npm es auf dem Pi (dafür installiert `install.sh` `build-essential`).

## Fehlersuche

```bash
systemctl status augenblick-api augenblick-worker
journalctl -u augenblick-worker -f        # Abrufe, Fehler je Quelle
journalctl -u augenblick-update           # letzte Updates
curl http://127.0.0.1:7341/health         # Version, Ausgabe, letzter Abruf je Quelle
```

Sofort neu abholen: `sudo systemctl restart augenblick-worker` (der Worker holt beim Start einmal ab, solange `AUGENBLICK_FETCH_ON_START=true`).

## Was installiert wird – und wieder entfernen

`install.sh` legt einmalig an (idempotent, Vorhandenes bleibt):

| Was | Wo | Besitzer |
|---|---|---|
| Systembenutzer `augenblick` (API, Worker), ohne Login | Home = `/var/lib/augenblick` | – |
| Systembenutzer `augenblick-update` (nächtliches Update), ohne Login | Home = `/var/cache/augenblick-update` (legt systemd an) | – |
| Programmversionen | `/opt/augenblick` | `augenblick-update` |
| Daten (SQLite) | `/var/lib/augenblick` | `augenblick` |
| Konfiguration | `/etc/augenblick/augenblick.env` | root, Gruppe `augenblick` |
| Units, Update-Programm | `/etc/systemd/system/augenblick-*`, `/usr/local/sbin/augenblick-update` | root |
| nur 32 bit: Node 22 | `/opt/node`, Verweise in `/usr/local/bin` | root |
| Watchdog | `/etc/systemd/system.conf.d/augenblick-watchdog.conf`, Zeile in der Boot-Konfiguration | root |

Unter `/home` entsteht nichts. Entfernen:

```bash
sudo ./deploy/uninstall.sh                     # Dienste, Programm, Konfiguration; Daten und Benutzer bleiben
sudo ./deploy/uninstall.sh --purge             # zusätzlich Datenbank und Benutzer
#   --remove-node      systemweites Node unter /opt/node (nur wenn sonst niemand es nutzt)
#   --remove-watchdog  Watchdog-Zeile aus der Boot-Konfiguration
```

## Hardware-Watchdog

`install.sh` schaltet den Watchdog ein (`dtparam=watchdog=on` in `/boot/firmware/config.txt`, `RuntimeWatchdogSec=15` für systemd). Hängt das System, startet der Pi von selbst neu. Wirksam nach dem nächsten Neustart.

## Tailscale (optional)

Tailscale verbindet den Pi mit Tablet und Geräten des Betreuers, ohne Ports im Router zu öffnen. Es ist der einfachste Weg zu HTTPS (M4, nötig für Wake Lock und die Installation als App) und ermöglicht nebenbei optional den Fernzugriff des Betreuers. Fernwartung ist eine Entscheidung des Betreuers, keine Pflicht.

1. Auf dem Pi installieren und anmelden:
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up --ssh
   ```
   Den angezeigten Link im Browser öffnen und den Pi dem eigenen Tailnet hinzufügen.
2. In der Tailscale-Verwaltung einen sprechenden Gerätenamen vergeben (z. B. `augenblick`) und für den Pi „Key expiry“ abschalten, damit er nicht nach Monaten herausfällt.
3. Auf Smartphone/PC des Betreuers Tailscale installieren und mit demselben Konto anmelden. Dann ist der Pi unter `http://augenblick:7341/` bzw. per `ssh augenblick` erreichbar.
4. Optional das Tablet ebenfalls ins Tailnet nehmen (für M4 nötig, weil das Zertifikat auf den Tailscale-Namen ausgestellt wird).

## Tablet

Chrome, Seite aufrufen, „Zum Startbildschirm hinzufügen“. Kein Kiosk-Modus, kein Offline-Modus (SPEC §9). Benachrichtigungen aus, Systemschrift groß, Helligkeit hoch.
