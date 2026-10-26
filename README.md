# Augenblick

Ein ruhiger, sehr gut lesbarer Zeitungs-Reader für Menschen mit Makuladegeneration. Gebaut für ein Android-Tablet mit AMOLED-Display.

Augenblick gibt es in zwei Formen:

- **Augenblick für Firefox** (Hauptrichtung seit 26.10.2026, SPEC §16): eine Firefox-Erweiterung. Auf Nachrichtenseiten erscheint die Taste „Lesen“, ein Tipp zeigt den Artikel in der Augenblick-Leseansicht. Anleitung: [`extension/README.md`](extension/README.md).
- **Augenblick-Zeitung** (SPEC §3–§15): eigene Übersicht aus tagesschau und BR24, mit einem Raspberry Pi im Heimnetz.

Für die Augenblick-Zeitung:

- Große Schrift, doppelter Zeilenabstand, hoher Kontrast, eine Spalte
- Übersicht mit kurzen Zusammenfassungen: „Lohnt sich dieser Artikel?"
- Blättern per Taste statt Scrollen, nur einfache Tipps
- Sanftes Vorlesen ab einem angetippten Wort – Begleitung, kein Ersatz fürs eigene Lesen
- Leseeinstellungen ändert die Leserin selbst, mit Rückfrage vor dem dauerhaften Speichern; um die Technik kümmert sich ein Angehöriger

**Status:**
- Augenblick-Zeitung: M0–M3 umgesetzt (Grundgerüst, tagesschau und BR24, Übersicht und Artikel, Einstellungen der Leserin mit Einführung, Technik-Bereich, KI-Zusammenfassungen über OpenRouter, Interessen lernen), danach Aufträge 004–007. Sie läuft beim Betreuer auf dem Pi.
- Augenblick für Firefox: F1 umgesetzt (Taste „Lesen“, Textgewinnung, Leseansicht mit Standardwerten, Auftrag 008). Angehalten: Als Nächstes installiert der Betreuer F1 am Tablet und testet mit der Nutzerin.

- Spezifikation: [`SPEC.md`](SPEC.md)
- Stand und Absprachen: [`docs/stand-und-absprachen.md`](docs/stand-und-absprachen.md)
- Recherche und Belege: [`docs/recherche.md`](docs/recherche.md)
- Entscheidungen: [`docs/entscheidungen/`](docs/entscheidungen/)
- Aufträge: [`docs/auftraege/`](docs/auftraege/)
- Betrieb auf dem Raspberry Pi: [`deploy/README.md`](deploy/README.md)

## Starten

Voraussetzung: Node.js 22 LTS.

```bash
npm install
cp .env.example .env      # optional: Feed, Farbschema, Schriftgröße
npm run dev
```

`npm run dev` startet drei Prozesse:

- **API** auf <http://127.0.0.1:7341> (`/api/edition`, `/api/articles/:id`, `/api/settings`, `/health`)
- **Worker**: holt beim Start einmal ab, danach 5:00–22:00 alle 30 Minuten (tagesschau, BR24)
- **Web-App** (Vite) auf <http://localhost:5173> – im Browser im Querformat öffnen, z. B. mit den Entwicklerwerkzeugen auf 1280×800
- **Technik-Bereich** auf <http://localhost:5173/technik> (ohne PIN, nur Heimnetz/Tailscale)
- **KI-Zusammenfassungen** nur mit `OPENROUTER_API_KEY` in `.env`; ohne Schlüssel zeigen die Karten den Anreißer der Quelle bzw. die ersten Sätze

Beim ersten Öffnen erscheint die **Einführung** (Schrift, Farben, Blättern üben). Wer sie überspringen will: im Technik-Bereich ist sie jederzeit neu startbar, und jeder Schritt hat „Überspringen“.

Ohne Internetzugang bleibt die Übersicht leer („wird gerade zusammengestellt“). Dann helfen die selbst geschriebenen Beispieltexte:

```bash
npm run demo              # füllt data/augenblick.sqlite mit Beispielartikeln
```

**Erlaubte Adressen:** Zum Schutz gegen DNS-Rebinding antwortet die API nur auf die IP-Adressen des Rechners, seinen Hostnamen (auch mit `.local`) und `localhost`. Wer die App über einen anderen Namen öffnet (z. B. `pi.fritz.box` oder den Tailscale-Namen), trägt ihn in `AUGENBLICK_ALLOWED_HOSTS` ein (ADR 013).

**Unter Windows** geht das genauso (PowerShell, Node.js 22 LTS von nodejs.org). Für die E2E-Tests einmal `npx playwright install chromium`. Nur die Skripte in `deploy/` sind für den Raspberry Pi bzw. Linux gedacht. Um die App vom Tablet im selben WLAN zu öffnen: `http://<IP-des-PCs>:5173` – beim ersten Start fragt die Windows-Firewall nach, ob Node.js im privaten Netz erreichbar sein darf.

Weitere Befehle:

| Befehl | Zweck |
|---|---|
| `npm run lint` | ESLint, Prettier-Prüfung, TypeScript |
| `npm test` | Unit-Tests (Vitest) |
| `npm run test:e2e` | E2E-Tests (Playwright) inkl. Kontrast-, Tippziel- und Scrollbalken-Prüfung, für Web-App und Erweiterung |
| `npm run build` | Web-App, Server und Erweiterung bauen (`web/dist`, `server/dist`, `extension/dist`) |
| `npm run lint:ext -w extension` | Erweiterung mit Mozillas `web-ext lint` prüfen (nach dem Build) |
| `npm run package` | Release-Paket `release/augenblick-<version>.tar.gz` |
| `npm start` | gebauten Server starten (liefert auch die Web-App aus) |

Die E2E-Tests laufen im Querformat-Viewport 1280×800 CSS-px. Die Schriftgröße stellt die Leserin in der Einführung selbst ein; die Umrechnung Millimeter → CSS-Pixel für die Tippziele in `shared/src/geometry.ts` ist ein vorsichtiger Schätzwert (eher zu große Tasten).

**Augenblick für Firefox:** `npm run build -w extension` baut die Erweiterung nach `extension/dist`. Wie man sie in Firefox am PC lädt, per USB am Tablet startet oder signiert und dauerhaft installiert, steht Schritt für Schritt in [`extension/README.md`](extension/README.md).

Auf dem Raspberry Pi: `sudo ./deploy/install.sh` (Details in [`deploy/README.md`](deploy/README.md)). Wer schon eine ältere Fassung installiert hat, führt es nach Auftrag 004 einmal erneut aus: Das nächtliche Update läuft jetzt als eigener Benutzer ohne Root-Rechte (ADR 012). Releases entstehen automatisch bei jedem Merge nach `main` (und bei einem Tag `v*`); der Pi spielt sie nachts selbst ein (ADR 019).

## Öffentliches Repo – Hinweise

- Keine personenbezogenen Daten, keine Secrets, keine fremden Artikeltexte als Testdaten (SPEC §12). Testdaten sind selbst geschrieben.
- `.env` wird nie committet; neue Variablen kommen mit Platzhalter in `.env.example`.
- **Secret-Scanning:** Die CI prüft jeden Push mit gitleaks. Zusätzlich in den Repo-Einstellungen unter *Settings → Code security* „Secret scanning“ und „Push protection“ einschalten.

## Lizenz

Code: MIT ([`LICENSE`](LICENSE)). Schrift Atkinson Hyperlegible: SIL Open Font License 1.1 ([`web/public/fonts/OFL.txt`](web/public/fonts/OFL.txt)).
