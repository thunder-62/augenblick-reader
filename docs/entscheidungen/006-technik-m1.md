# 006 – Technische Entscheidungen in M1

**Status:** angenommen · **Datum:** 24.10.2026

## Kontext

SPEC §3 gibt den Stack vor und lässt einige Punkte offen (Preact oder Vanilla TS, Form der Konfiguration, Aufbau des Release-Pakets).

## Entscheidung

- **Web-App in Vanilla TypeScript** (Vite, kein Framework). Die App hat zwei Bildschirme; der Seitenumbruch braucht ohnehin direkten DOM-Zugriff zum Messen. Bundle ca. 16 kB.
- **Seitenumbruch per Messung:** Ein unsichtbarer Messbehälter mit exakt der Größe des Lesebereichs wird satzweise gefüllt (`web/src/paginate.ts`, rein funktional und getestet). Das berücksichtigt Schrift, Abstände und Gerät ohne Schätzwerte.
- **Server gebündelt mit esbuild** zu `server/dist/api.js` und `worker.js`; Laufzeit-Abhängigkeiten (`fastify`, `better-sqlite3`, …) bleiben extern und werden auf dem Pi mit `npm ci --omit=dev` installiert. Das gemeinsame Paket `shared` wird mitgebündelt und ist zur Laufzeit nicht nötig.
- **Konfiguration per Umgebungsvariablen:** `.env` im Repo-Verzeichnis (Entwicklung) bzw. `/etc/augenblick/augenblick.env` (Pi, über systemd `EnvironmentFile`). Vorlage: `.env.example`. Einstellungen aus SPEC §7 kommen bis M2 als feste Standardwerte, Schema und Schriftgröße sind per Variable wählbar.
- **SQLite im WAL-Modus**, damit API (liest) und Worker (schreibt) gleichzeitig arbeiten. Migrationen über `PRAGMA user_version`.
- **Release-Paket** `augenblick-<version>.tar.gz` (+ `.sha256`) enthält gebaute Web-App, gebündelten Server, `package.json`/`package-lock.json` der Workspaces, `deploy/` und `VERSION`. `/health` meldet die Version; `update.sh` gilt nur dann als erfolgreich, wenn die **neue** Version antwortet.
- **Beispielquelle** (`server/src/sources/demo.ts`) mit selbst geschriebenen Texten für Entwicklung ohne Internet (`npm run demo`) und für die E2E-Tests (SPEC §12).

## Folgen

- Wer später doch Preact möchte, kann die beiden Bildschirme einzeln umstellen; Seitenumbruch, Tipp-Logik und Zustand sind framework-unabhängig.
- Der Rubriken-Mix ist per `AUGENBLICK_SECTIONS` einstellbar, bis der Admin-Bereich (M2) ihn übernimmt.
