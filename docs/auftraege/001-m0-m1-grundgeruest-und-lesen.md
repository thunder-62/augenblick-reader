# Auftrag 001 – Grundgerüst und erste lesbare Ausgabe (M0 + M1)

**Status:** erledigt
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

**Quellen**

1. **Kein Live-Abruf möglich:** Aus der Entwicklungsumgebung waren tagesschau.de, br.de und br24.de gesperrt. Die Adapter beruhen auf der Dokumentation (ADR 001, 002) und sind mit selbst geschriebenen Testdaten abgesichert. Beim ersten Start auf dem Pi prüfen: `journalctl -u augenblick-worker` und `curl http://127.0.0.1:8080/health` – kommen Artikel beider Quellen an, und sind die Texte sauber (keine Bildunterschriften, Linklisten, Hinweiskästen)?
2. **BR24-Feed für Franken/Mittelfranken:** Keine bestätigte URL gefunden (ADR 002). Bitte auf der Franken-Seite von BR24 nach dem RSS-Symbol suchen und in `BR24_FEED_URL` eintragen; bis dahin läuft der allgemeine Feed.
3. **tagesschau in Einfacher Sprache:** In der dokumentierten Schnittstelle gibt es dafür kein eigenes Ressort. Zugangsweg vor M3 klären.

**Gerät und Darstellung (beim Test mit der Nutzerin)**

4. **CSS-Auflösung und Millimeter des Tab S11:** E2E-Viewport (1280×800) und die Umrechnung für Tippziele (6,3 CSS-px/mm) sind geschätzt. Bitte am Gerät messen: `window.innerWidth/innerHeight` im Vollbild und die Höhe einer Taste mit dem Lineal (soll 20 mm sein). Werte in `playwright.config.ts` und `shared/src/geometry.ts` eintragen.
5. **Standardwerte bis zur Kalibrierung (M2):** gewählt sind 30 px Schrift und das dunkle Schema. Änderbar über `AUGENBLICK_FONT_SIZE_PX` und `AUGENBLICK_THEME` in `/etc/augenblick/augenblick.env`.
6. **Karten pro Übersichtsseite:** Die Spec nennt 3 Karten je Seite. Bei 30 px Schrift, Zeilenabstand 2,0 und höchstens 45 Zeichen je Zeile passt im vorläufigen Viewport meist nur **eine** Karte; die Übersicht hat dann bis zu 12 Seiten (ADR 005). Ist das in Ordnung, oder soll die Kurzfassung in der Karte enger gesetzt bzw. kürzer werden?
7. **Eine Ausgabe pro Tag:** Was morgens in der Ausgabe steht, bleibt; tagesüber kommen nur Artikel auf freie Plätze (ADR 003). Wünscht die Nutzerin eher eine zweite Ausgabe am Nachmittag?
8. **Ende des letzten Artikels:** Dort gibt es keinen „Nächsten Artikel“; „Weiter“ ist inaktiv, zurück geht es über „Übersicht“. Passt das, oder soll dort „Zur Übersicht ▸“ stehen?
9. **Quellenangabe:** Karten zeigen „Region · BR24“, der Artikel „Quelle: tagesschau“. Gewünscht, oder lieber nur die Rubrik?
10. **Wake Lock ohne HTTPS:** Browser erlauben Wake Lock nur in sicheren Kontexten. Über `http://pi:8080` bleibt der Bildschirm bis M4 (HTTPS) evtl. nicht an. Übergangsweise am Tablet die Bildschirm-Zeitüberschreitung hochsetzen.

**Betrieb**

11. **Abnahme 7 (frischer Pi) nicht am echten Gerät geprüft:** `install.sh` ist mit shellcheck geprüft, aber hier gab es weder Raspberry Pi OS noch systemd. Den Update-Ablauf (`update.sh`) habe ich mit echten Release-Paketen durchgespielt, dabei ersetzte ein Stub `systemctl`: Installation, Versionswechsel, kaputte Version → automatischer Rückfall, Aufräumen. Bitte einmal auf dem Pi ausführen: `sudo ./deploy/install.sh --from-source` (solange es noch kein Release gibt) oder nach dem ersten Tag `v0.1.0` `sudo ./deploy/install.sh`.
12. **Erstes Release:** Ein Tag `v0.1.0` erzeugt das Release-Paket für `install.sh`/`update.sh`. Das Tag setze ich nicht selbst; es ist eine Freigabe des Betreuers.
13. **Secret-Scanning:** CI nutzt gitleaks. In den Repo-Einstellungen zusätzlich „Secret scanning“ und „Push protection“ einschalten (nur der Repo-Besitzer kann das).

## Abschlussbericht

**Gebaut**

- *M0:* npm-Workspaces `shared`, `server`, `web`; TypeScript strict; ESLint + Prettier; Vitest; Playwright. GitHub Actions: Lint (inkl. shellcheck), Unit-Tests, E2E-Tests, Build mit Installationsprobe des Release-Pakets, Secret-Scanning (gitleaks); bei Tag `v*` Release-Paket als Asset. `.gitignore`, `.env.example`, Hinweis zum Secret-Scanning im README. Atkinson Hyperlegible selbst gehostet mit OFL. `shared/locales/de.json` mit kleinem i18n-Helfer (Platzhalter, Plural); alle UI-Texte kommen daraus.
- *Quellen:* Adapter `tagesschau` (JSON-Schnittstelle, höchstens 50 Abrufe/Stunde) und `br24` (RSS, Feed-URL per Konfiguration, Volltext per Readability). ADRs 001 und 002.
- *Pipeline ohne KI:* Zeitplan 5:00–22:00 alle 30 Minuten, Bereinigung zu `Block[]`, deutscher Satztrenner mit Abkürzungsliste und Ordnungszahlen, Dubletten zwischen Quellen (Fassung mit mehr Text bleibt), Auswahl nach Rubriken-Mix mit höchstens 12 Artikeln (stabile Tagesausgabe, ADR 003), Aufräumen nach 7 Tagen, Kurzfassung = erste zwei Sätze. Quellen arbeiten unabhängig voneinander; ein kaputter Artikel blockiert nichts.
- *Speicherung:* SQLite (`better-sqlite3`, WAL) mit Migrationen.
- *API:* `GET /api/edition`, `/api/articles/:id`, `/api/settings`, `/health` (Version, Ausgabe, letzter Abruf je Quelle).
- *Web-App:* Übersicht (Datum, bis zu 3 Karten je Seite, aus der Schriftgröße berechnet, gelesen-Häkchen, Blättern per Taste), Artikel seitenweise ohne Scrollen mit Umbruch zwischen Sätzen und ohne verwaiste Zwischenüberschriften, „◂ Übersicht“ immer sichtbar, „Nächster Artikel ▸“ mit Titel. Beide Farbschemata; Auswahl per Konfiguration. Tipp-Logik nach §8.1 (Auslösen beim Loslassen, < 80 ms und zweiter Tipp < 300 ms ignoriert, > 10 mm Bewegung kein Tipp, 150 ms Invertierung). Tippziele 20 mm, ≤ 6 je Bildschirm, 15 mm Randabstand. Zustand inkl. Seite wird wiederhergestellt (ADR 004). Querformat, kein Zoom, keine Textauswahl, kein Kontextmenü, Wake Lock im Artikel. Layout-Entscheidungen in ADR 005, Technik in ADR 006.
- *Betrieb:* `deploy/install.sh` (idempotent: Pakete, Node 22, Benutzer, Verzeichnisse, Konfiguration, Dienste, Watchdog, Release), `deploy/update.sh` (Release laden, Prüfsumme, `npm ci --omit=dev`, Symlink, Neustart, Healthcheck mit Versionsprüfung, Rückfall, 3 Versionen behalten, fehlgeschlagene Version nicht nachts wiederholen), systemd-Units `augenblick-api`, `augenblick-worker`, `augenblick-update.timer` (03:00). Tailscale-Anleitung in `deploy/README.md`.
- *Beispielquelle* mit selbst geschriebenen Texten für Entwicklung ohne Internet (`npm run demo`) und für die E2E-Tests.

**Getestet**

- `npm run lint` (ESLint, Prettier, TypeScript) und shellcheck: sauber.
- `npm test`: 84 Unit-Tests grün – Satztrennung, Bereinigung, beide Adapter mit selbst geschriebenen Fixtures, Ratenbegrenzung, Dubletten, Auswahl, Pipeline (Quelle fällt aus, kaputter Artikel, letzte Ausgabe bleibt), Aufräumen, Migrationen, API, Konfiguration, Zeitplan, Kontrast beider Schemata, i18n-Vollständigkeit, Seitenumbruch, Tipp-Logik.
- `npm run test:e2e`: 20 Playwright-Tests grün im Viewport 1280×800 (vorläufig) – Übersicht blättern, Artikel öffnen/blättern/verlassen, kein Satz geteilt oder verloren, „Nächster Artikel“, Zustand nach Neuladen, fehlender Artikel, kurze Berührung, Doppeltipp, verrutschter Finger, sowie in beiden Schemata bei 24/30/40 px: Kontrast ≥ 7:1 für allen Text, Tippziele ≥ 15 mm mit Rand- und Zwischenabstand, ≤ 6 Ziele, keine Scrollbalken, nichts abgeschnitten; keine externen Requests; Server nicht erreichbar.
- `npm run dev` startet API, Worker und Web-App; mit Beispieltexten vollständig bedienbar. Echte Artikel konnten hier wegen gesperrtem Netz nicht abgerufen werden (Offene Frage 1).
- Release-Paket gebaut, ohne Entwicklungsabhängigkeiten installiert und gestartet; `update.sh` mit echten Paketen inkl. Rückfall durchgespielt (Offene Frage 11).

**Offen** – siehe „Offene Fragen“, vor allem: Live-Abruf und Franken-Feed am Pi prüfen (1, 2), Gerätemaße messen (4), Karten pro Seite und Tagesausgabe mit der Nutzerin klären (6, 7), `install.sh` auf frischem Pi ausführen (11).

**Nach M1 angehalten.** Der Betreuer testet jetzt mit der Nutzerin am Gerät.
