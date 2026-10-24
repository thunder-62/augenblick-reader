# 012 – Nächtliches Update ohne Root-Rechte

**Status:** angenommen · **Datum:** 24.10.2026 · **Bezug:** Auftrag 004 (D15), SPEC §9

## Kontext

`augenblick-update.service` lief bisher als root. Das Update lädt Pakete aus dem Internet, führt `npm ci` aus und installierte sich selbst und die systemd-Units neu. Wer ein Release-Paket manipuliert, hätte damit Root-Rechte auf dem Pi.

## Entscheidung

- Eigener Systembenutzer **`augenblick-update`**. Ihm gehört `/opt/augenblick` (Releases, Symlink `current`, Marker `failed-version`). Der Dienst läuft mit `NoNewPrivileges`, `ProtectSystem=strict` und darf nur `/opt/augenblick` und seinen Cache (`/var/cache/augenblick-update`, npm) schreiben.
- **Neustart ohne sudo:** Das Update legt die Datei `/opt/augenblick/restart-request` an. Die root-eigene Pfad-Unit `augenblick-restart.path` startet daraufhin `augenblick-restart.service`. Dieser Dienst löscht die Datei und führt den festen Befehl `systemctl restart augenblick-api augenblick-worker` aus. Vom Update-Benutzer kommt keine Eingabe außer „bitte neu starten“. Der Healthcheck wartet wie bisher, bis `/health` die neue Version meldet. Erst dann gilt das Update als gelungen, sonst geht es zurück.
- **Kein Selbst-Update mehr:** `update.sh` und die Units unter `/etc/systemd/system` gehören root und werden nur durch `install.sh` erneuert. Bringt ein Release neuere mit, schreibt das Update einen Hinweis ins Log.
- Von Hand mit `sudo augenblick-update` gestartet, startet das Programm die Dienste direkt neu und gibt am Ende alles unter `/opt/augenblick` an `augenblick-update` zurück.
- Die Dienste `augenblick-api` und `augenblick-worker` lesen `/opt/augenblick` nur (wie bisher als `augenblick`).

## Folgen

- Ein manipuliertes Release kann den Programmcode der App ersetzen; das ließe sich ohnehin nicht verhindern. Es bekommt aber keine Root-Rechte und kann weder die Units noch das Update-Programm ändern.
- `EnvironmentFile` liest systemd selbst; der Update-Benutzer braucht keinen Zugriff auf `/etc/augenblick`. Er sieht damit aber die Variablen dieser Datei (u. a. den OpenRouter-Schlüssel) in seiner Umgebung. Er braucht davon nur `PORT` und ggf. `AUGENBLICK_REPO`; eine eigene, kleinere Datei wäre sauberer. Das kann mit M4 kommen.
- Neue Units (`augenblick-restart.path/.service`) und der neue Benutzer kommen mit dem nächsten Lauf von `install.sh`. Bestehende Installationen: einmal `sudo ./deploy/install.sh` ausführen; dabei wird `/opt/augenblick` umgeschrieben (`chown`).
- In der Entwicklungsumgebung gibt es kein systemd. Geprüft wurde mit `shellcheck`, `systemd-analyze verify` und einem Durchlauf von `update.sh` als unprivilegierter Benutzer, bei dem ein Hilfsskript die Pfad-Unit spielt.
