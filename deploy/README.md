# Betrieb auf dem Raspberry Pi

Augenblick läuft ohne Docker direkt auf einem Raspberry Pi 5 (SSD, Raspberry Pi OS Lite 64 bit) als zwei systemd-Dienste (SPEC §9):

| Dienst | Aufgabe |
|---|---|
| `augenblick-api` | liefert Web-App und JSON-API (Port aus `PORT`, Standard 8080) |
| `augenblick-worker` | holt Artikel ab (5:00–22:00 alle 30 Minuten), bereinigt sie, stellt die Ausgabe zusammen |
| `augenblick-update.timer` | jede Nacht 03:00: neues Release laden, Healthcheck, bei Fehler zurück |

Verzeichnisse: Programm unter `/opt/augenblick/releases/<version>` mit Symlink `/opt/augenblick/current`, Daten (SQLite) unter `/var/lib/augenblick`, Konfiguration in `/etc/augenblick/augenblick.env`. Die Dienste laufen als Systembenutzer `augenblick`.

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

Wichtig ist vor allem `AUGENBLICK_ADMIN_PIN` (mindestens 4 Ziffern) – ohne PIN bleibt der Admin-Bereich gesperrt. Die Datei ist nur für root und den Dienstbenutzer lesbar; sie gehört nie ins Repo.

## Admin-Bereich

`http://<tailscale-name>:8080/admin` – nur aus dem Tailnet (und vom Pi selbst) erreichbar, zusätzlich mit PIN. Dort: Einstellungen mit Live-Vorschau, Kalibrierung (am Tablet ausführen; das Tablet muss dafür im Tailnet sein), BR24-Feed und Rubriken-Mix, Status, Nutzungsprotokoll und der Spickzettel zum Ausdrucken. Andere Netze lassen sich mit `AUGENBLICK_ADMIN_NETWORKS` freigeben (siehe ADR 007).

Am Tablet: Chrome öffnen, `http://<name-des-pi>:8080/` aufrufen. Bis HTTPS (M4) läuft, funktionieren Wake Lock und Installation als App nur eingeschränkt.

## Updates

- automatisch jede Nacht um 03:00 (`systemctl list-timers augenblick-update.timer`)
- von Hand: `sudo augenblick-update` (oder mit `--file paket.tar.gz`, `--force` für dieselbe Version)

Ablauf: Release laden → Prüfsumme prüfen → nach `/opt/augenblick/releases/<version>` entpacken → `npm ci --omit=dev` → Symlink `current` umstellen → Dienste neu starten → `/health` muss „ok“ und die neue Version melden. Sonst zurück auf die vorige Version. Die letzten 3 Versionen bleiben liegen.

`better-sqlite3` bringt fertige arm64-Pakete mit. Gibt es keins, baut npm es auf dem Pi (dafür installiert `install.sh` `build-essential`).

## Fehlersuche

```bash
systemctl status augenblick-api augenblick-worker
journalctl -u augenblick-worker -f        # Abrufe, Fehler je Quelle
journalctl -u augenblick-update           # letzte Updates
curl http://127.0.0.1:8080/health         # Version, Ausgabe, letzter Abruf je Quelle
```

Sofort neu abholen: `sudo systemctl restart augenblick-worker` (der Worker holt beim Start einmal ab, solange `AUGENBLICK_FETCH_ON_START=true`).

## Hardware-Watchdog

`install.sh` schaltet den Watchdog ein (`dtparam=watchdog=on` in `/boot/firmware/config.txt`, `RuntimeWatchdogSec=15` für systemd). Hängt das System, startet der Pi von selbst neu. Wirksam nach dem nächsten Neustart.

## Tailscale (Fernwartung)

Tailscale verbindet den Pi und die Geräte des Betreuers, ohne Ports im Router zu öffnen. HTTPS über Tailscale-Zertifikate folgt mit M4; bis dahin dient Tailscale nur der Fernwartung.

1. Auf dem Pi installieren und anmelden:
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up --ssh
   ```
   Den angezeigten Link im Browser öffnen und den Pi dem eigenen Tailnet hinzufügen.
2. In der Tailscale-Verwaltung einen sprechenden Gerätenamen vergeben (z. B. `augenblick`) und für den Pi „Key expiry“ abschalten, damit er nicht nach Monaten herausfällt.
3. Auf Smartphone/PC des Betreuers Tailscale installieren und mit demselben Konto anmelden. Dann ist der Pi unter `http://augenblick:8080/` bzw. per `ssh augenblick` erreichbar.
4. Optional das Tablet ebenfalls ins Tailnet nehmen (für M4 nötig, weil das Zertifikat auf den Tailscale-Namen ausgestellt wird).

## Tablet (vorläufig)

Chrome, Seite aufrufen, „Zum Startbildschirm hinzufügen“. Bildschirmfixierung oder Kiosk-Launcher wird beim Einrichten entschieden (SPEC §15, offener Punkt 4). Benachrichtigungen aus, Systemschrift groß, Helligkeit hoch.
