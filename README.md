# Augenblick

Ein ruhiger, sehr gut lesbarer Zeitungs-Reader für Menschen mit Makuladegeneration. Gebaut für ein Android-Tablet mit AMOLED-Display und einen Raspberry Pi im Heimnetz.

- Große Schrift, doppelter Zeilenabstand, hoher Kontrast, eine Spalte
- Übersicht mit kurzen Zusammenfassungen: „Lohnt sich dieser Artikel?"
- Blättern per Taste statt Scrollen, nur einfache Tipps
- Sanftes Vorlesen ab einem angetippten Wort – Begleitung, kein Ersatz fürs eigene Lesen
- Leseeinstellungen ändert die Leserin selbst, mit Rückfrage vor dem dauerhaften Speichern; um die Technik kümmert sich ein Angehöriger

**Status:** M0–M3 umgesetzt (Grundgerüst, tagesschau und BR24, Übersicht und Artikel, Einstellungen der Leserin mit Einführung, Technik-Bereich, KI-Zusammenfassungen über OpenRouter, Interessen lernen). Nach M3 angehalten: Als Nächstes testet der Betreuer mit der Nutzerin am Gerät.

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

- **API** auf <http://127.0.0.1:8080> (`/api/edition`, `/api/articles/:id`, `/api/settings`, `/health`)
- **Worker**: holt beim Start einmal ab, danach 5:00–22:00 alle 30 Minuten (tagesschau, BR24)
- **Web-App** (Vite) auf <http://localhost:5173> – im Browser im Querformat öffnen, z. B. mit den Entwicklerwerkzeugen auf 1280×800
- **Technik-Bereich** auf <http://localhost:5173/technik> (ohne PIN, nur Heimnetz/Tailscale)
- **KI-Zusammenfassungen** nur mit `OPENROUTER_API_KEY` in `.env`; ohne Schlüssel zeigen die Karten den Anreißer der Quelle bzw. die ersten Sätze

Beim ersten Öffnen erscheint die **Einführung** (Schrift, Farben, Blättern üben). Wer sie überspringen will: im Technik-Bereich ist sie jederzeit neu startbar, und jeder Schritt hat „Überspringen“.

Ohne Internetzugang bleibt die Übersicht leer („wird gerade zusammengestellt“). Dann helfen die selbst geschriebenen Beispieltexte:

```bash
npm run demo              # füllt data/augenblick.sqlite mit Beispielartikeln
```

**Unter Windows** geht das genauso (PowerShell, Node.js 22 LTS von nodejs.org). Für die E2E-Tests einmal `npx playwright install chromium`. Nur die Skripte in `deploy/` sind für den Raspberry Pi bzw. Linux gedacht. Um die App vom Tablet im selben WLAN zu öffnen: `http://<IP-des-PCs>:5173` – beim ersten Start fragt die Windows-Firewall nach, ob Node.js im privaten Netz erreichbar sein darf.

Weitere Befehle:

| Befehl | Zweck |
|---|---|
| `npm run lint` | ESLint, Prettier-Prüfung, TypeScript |
| `npm test` | Unit-Tests (Vitest) |
| `npm run test:e2e` | E2E-Tests (Playwright) inkl. Kontrast-, Tippziel- und Scrollbalken-Prüfung |
| `npm run build` | Web-App und Server bauen (`web/dist`, `server/dist`) |
| `npm run package` | Release-Paket `release/augenblick-<version>.tar.gz` |
| `npm start` | gebauten Server starten (liefert auch die Web-App aus) |

Die E2E-Tests laufen im Querformat-Viewport 1280×800 CSS-px. Die Schriftgröße stellt die Leserin in der Einführung selbst ein; die Umrechnung Millimeter → CSS-Pixel für die Tippziele in `shared/src/geometry.ts` ist ein vorsichtiger Schätzwert (eher zu große Tasten).

Auf dem Raspberry Pi: `sudo ./deploy/install.sh` (Details in [`deploy/README.md`](deploy/README.md)). Releases entstehen automatisch, wenn ein Tag `v*` gepusht wird.

## Öffentliches Repo – Hinweise

- Keine personenbezogenen Daten, keine Secrets, keine fremden Artikeltexte als Testdaten (SPEC §12). Testdaten sind selbst geschrieben.
- `.env` wird nie committet; neue Variablen kommen mit Platzhalter in `.env.example`.
- **Secret-Scanning:** Die CI prüft jeden Push mit gitleaks. Zusätzlich in den Repo-Einstellungen unter *Settings → Code security* „Secret scanning“ und „Push protection“ einschalten.

## Lizenz

Code: MIT ([`LICENSE`](LICENSE)). Schrift Atkinson Hyperlegible: SIL Open Font License 1.1 ([`web/public/fonts/OFL.txt`](web/public/fonts/OFL.txt)).
