# Auftrag 001 – Grundgerüst und erste lesbare Ausgabe (M0 + M1)

**Status:** offen
**Bezug:** SPEC §3–5, §8.1–8.3, §11, §12, §13 (M0, M1), §14

## Ziel

Am Ende läuft Augenblick lokal (`npm run dev`) und auf einem Raspberry Pi als systemd-Dienst. Die Web-App zeigt eine Übersicht mit echten Artikeln von **tagesschau** und **BR24** und eine gut lesbare Artikelansicht. Noch **ohne** KI, Vorlesen, Admin-Bereich und Offline-Modus.

## Umfang

### M0 – Gerüst
- npm-Workspaces `server`, `web`, `shared`; TypeScript strict; ESLint + Prettier; Vitest; Playwright.
- GitHub Actions: Lint, Unit-Tests, E2E-Tests, Build. Bei Tag `v*`: Release-Paket (gebaute Web-App + Server, ohne `node_modules`) als Release-Asset.
- `.gitignore`, `.env.example`, Secret-Scanning-Hinweis in README.
- Schrift Atkinson Hyperlegible selbst gehostet, inkl. OFL-Lizenz.
- `shared/locales/de.json` und kleiner i18n-Helfer.

### M1 – Inhalte und Lesen
- **Quellen-Adapter** nach SPEC §5.1:
  - `tagesschau`: öffentliche JSON-Schnittstelle. Endpunkte und Nutzungsbedingungen prüfen, Ergebnis als ADR festhalten.
  - `br24`: RSS-Feed, Feed-URL per Konfiguration (`.env`/Config-Datei, Standard: allgemeiner BR24-Feed). Volltext von der Artikelseite holen und bereinigen. Prüfen, ob es einen Feed für Franken/Mittelfranken gibt, Ergebnis als ADR.
- **Pipeline** nach SPEC §5.2 ohne KI: Abholen (Zeitplan), Bereinigen zu `Block[]`, Satztrennung (deutsch, mit Abkürzungsliste), Dubletten zwischen Quellen, Auswahl max. 12 Artikel, Aufräumen nach 7 Tagen. Kurzfassung vorerst = erste zwei Sätze (Fallback aus SPEC §6).
- **Speicherung** in SQLite (`better-sqlite3`), Schema mit Migrationen.
- **API:** `GET /api/edition` (Übersicht), `GET /api/articles/:id`, `GET /api/settings`, `GET /health`.
- **Web-App** nach SPEC §8.1–8.3:
  - Übersicht mit 3 Karten pro Seite, Blättern per Taste, keine Scrollbalken.
  - Artikelansicht seitenweise, „◂ Übersicht" immer sichtbar, „Nächster Artikel ▸" am Ende.
  - Einstellungen aus SPEC §7 als feste Standardwerte aus `GET /api/settings` (Bearbeiten kommt in M2). Beide Farbschemata umsetzen; Auswahl vorerst per Konfiguration.
  - Tipp-Logik nach §8.1 (Auslösen beim Loslassen, Kurzberührungen und Doppeltipps ignorieren), Tippziele ≥ 15 mm, max. 6 Ziele pro Bildschirm.
  - Zustand (letzter Artikel, Seite) wiederherstellen.
  - Querformat, kein Pinch-Zoom, keine Textauswahl, Wake Lock im Artikel.
- **Betrieb** nach SPEC §9: `deploy/install.sh`, `deploy/update.sh`, systemd-Units `augenblick-api` und `augenblick-worker`, systemd-Timer für nächtliches Update. Tailscale nur als Anleitung in `deploy/README.md` (HTTPS kommt mit M4).

## Nicht in diesem Auftrag
KI-Kurzfassungen (M3), Admin-Bereich und Kalibrierung (M2), Service Worker/Offline und HTTPS (M4), Vorlesen (M5), Experimente (M6), Regionalzeitung (M7).

## Abnahme
1. `npm run dev` startet Server und Web-App; nach dem ersten Abruf zeigt die Übersicht echte Artikel beider Quellen.
2. Artikel lassen sich öffnen, seitenweise lesen und verlassen, ohne zu scrollen.
3. Nach Neuladen öffnet die App den zuletzt gelesenen Artikel auf derselben Seite.
4. CI-Checks aus SPEC §14 laufen: Kontrast ≥ 7:1 in beiden Schemata, Tippziele ≥ Mindestgröße, ≤ 6 Tippziele pro Bildschirm, keine Scrollbalken.
5. Playwright-Tests im Querformat-Tablet-Viewport (vorläufig 1280×800 CSS-px, im README als „am Gerät zu prüfen" markiert).
6. Fällt eine Quelle aus, bleibt die andere bzw. die letzte Ausgabe sichtbar.
7. `deploy/install.sh` läuft auf einem frischen Raspberry Pi OS Lite (64 bit) durch; Dienste starten und `/health` antwortet.
8. Keine Testdaten mit fremden Artikeltexten im Repo.

## Offene Fragen
_(vom Agenten zu ergänzen)_

## Abschlussbericht
_(vom Agenten zu ergänzen)_
