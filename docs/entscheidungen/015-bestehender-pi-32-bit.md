# 015 – Installation auf einem bestehenden Pi (32 bit, bullseye)

**Status:** angenommen · **Datum:** 25.10.2026 · **Bezug:** SPEC §9, Rückmeldung des Betreuers

## Kontext

SPEC §9 geht von einem frischen Raspberry Pi 5 mit Raspberry Pi OS Lite 64 bit aus. Augenblick soll nun aber auf vorhandener Hardware mitlaufen: einem Raspberry Pi 4 (2 GB) mit Raspbian 11 (bullseye). Das System hat einen 64-bit-Kernel, aber 32-bit-Programme (`armhf`). Darauf laufen schon andere Dienste in Docker, Port 8080 ist belegt. Node.js 22 ist nur über nvm im Home-Verzeichnis eines Benutzers installiert.

`install.sh` hätte hier drei Probleme gehabt:

- Unter `sudo` und für die Dienstbenutzer ist das nvm-Node unsichtbar. Das Skript hätte NodeSource eingerichtet, und NodeSource liefert für `armhf` keine aktuellen Pakete.
- Die Boot-Konfiguration liegt bei bullseye unter `/boot/config.txt`, nicht unter `/boot/firmware/config.txt`.
- Auf dem belegten Port 8080 wäre der Start gescheitert, und der Healthcheck hätte womöglich den fremden Dienst gefragt.

## Entscheidung

- **Node.js:** Gesucht wird ein systemweites Node 22 (`/usr/local/bin/node` oder `/usr/bin/node`). Fehlt es, gilt je nach System:
  - Bei `armhf` kommt das offizielle Archiv `linux-armv7l` von nodejs.org nach `/opt/node`, die Prüfsumme wird gegen `SHASUMS256.txt` geprüft. Dazu kommen Verweise in `/usr/local/bin` (`node`, `npm`, `npx`).
  - Sonst wie bisher NodeSource.

  Ein Node über nvm bleibt unberührt; im Benutzerpfad steht es weiter vorn.
- **Dienste** starten Node über `/usr/bin/env node`. Damit gilt der Systempfad (`/usr/local/bin` vor `/usr/bin`), und beide Installationswege funktionieren.
- **Watchdog:** `/boot/firmware/config.txt`, sonst `/boot/config.txt`.
- **Port:** Ist `PORT` schon belegt und läuft `augenblick-api` nicht, bricht `install.sh` mit einem Hinweis ab. Der Port gehört dann vorher in `/etc/augenblick/augenblick.env`.
- **Empfehlung bei wenig RAM:** Das Release-Paket auf einem anderen Rechner bauen (`npm run build && npm run package`), dann mit `install.sh --file` bzw. `augenblick-update --file` einspielen. Bauen auf dem Pi (`--from-source`) braucht neben Docker viel Arbeitsspeicher.

## Folgen

- `better-sqlite3` hat für `armhf` womöglich kein fertiges Paket. Dann kompiliert `npm ci` es auf dem Pi (dafür `build-essential`, `python3`); das dauert einige Minuten.
- Der Hardware-Watchdog gilt für das ganze Gerät, also auch für die anderen Dienste darauf.
- Debian 11 bekommt keine Sicherheitsupdates mehr. Augenblick läuft dort, ein Umstieg auf ein aktuelles 64-bit-System bleibt empfehlenswert.
- Geprüft in der Entwicklungsumgebung: `shellcheck`, `systemd-analyze verify` und der Download- und Prüfsummenteil für `armv7l` in einem Testverzeichnis. Auf dem Gerät selbst ist es noch nicht gelaufen.
