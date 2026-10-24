# SPEC – Augenblick

> Spezifikation für den Coding-Agenten. Version 0.1, Stand 24.10.2026.
> Hintergrund und Belege: [`docs/recherche.md`](docs/recherche.md). Regelnummern wie **[R13]** verweisen auf die „Design-Regeln für den Reader" dort.

## 1. Worum es geht

Ein Zeitungs-Reader im Browser für **eine einzige Nutzerin**: hochaltrig (85+), altersbedingte Makuladegeneration (AMD), wenig Technikerfahrung. Sie soll ihre Tageszeitung wieder **selbst lesen** können. Vorlesen ist Begleitung, kein Ersatz.

Das Produkt besteht aus zwei Teilen:

- **Server** (läuft auf einem Raspberry Pi im Heimnetz der Nutzerin): holt Artikel ab, bereinigt sie, erzeugt Kurzfassungen per KI, speichert alles und liefert die Web-App aus.
- **Web-App / PWA** (läuft im Vollbild auf einem Samsung Galaxy Tab S11, 11", AMOLED, Android): Übersicht → Artikel. Sonst fast nichts.

Ein Angehöriger („Betreuer") richtet alles ein und wartet es aus der Ferne. Die Nutzerin stellt nie etwas ein.

### Leitsätze (gelten für jede Entscheidung)

1. **Weniger ist das Feature.** Jede zusätzliche Taste ist ein Risiko. Im Zweifel weglassen.
2. **Größe, Abstand, Kontrast vor allem anderen.** [R1–R7]
3. **Nur Einzeltipps.** Keine versteckten Gesten. [R16]
4. **Nichts kann kaputtgehen.** Keine Dialoge, keine Modi, keine Sackgassen. [R23, R24]
5. **Würde.** Sieht aus wie eine hochwertige Zeitung, nicht wie ein „Senioren-Modus". [R25]
6. **Originaltext ist heilig.** KI erzeugt nur Kurzfassungen, nie den Lesetext.

## 2. Nicht-Ziele (Version 1)

- Keine Mehrbenutzerfähigkeit, keine Konten, kein Login für die Nutzerin.
- Keine Kommentare, Teilen-Funktionen, Werbung, Push-Benachrichtigungen.
- Kein Nachbau des ePaper-Seitenlayouts. Text wird immer als einspaltiger Fließtext dargestellt. [R5]
- Keine native Android-App (PWA reicht; Kiosk-Betrieb über Android-Bordmittel bzw. Launcher, siehe §9).
- Keine Übersetzung, kein RSVP [R11].

## 3. Architektur

```
┌────────────── Heimnetz der Nutzerin ──────────────┐
│                                                   │
│  Tablet (Chrome, PWA, Vollbild)                   │
│      │ HTTPS (Tailscale-Zertifikat)               │
│      ▼                                            │
│  Raspberry Pi (Docker)                            │
│   ├─ api      Fastify, liefert Web-App + JSON-API │
│   ├─ worker   Abholen → Bereinigen → KI → SQLite  │
│   └─ data/    SQLite, Konfiguration, Cache        │
│      │                                            │
└──────┼────────────────────────────────────────────┘
       │ ausgehend: Quellen (tagesschau, später Regionalzeitung), KI-API
       ▼
   Internet          Betreuer ──Tailscale──▶ Admin-Bereich
```

### Technik-Stack (Vorgabe, begründete Abweichung erlaubt)

| Teil | Wahl | Grund |
|---|---|---|
| Sprache | TypeScript (Node.js 22 LTS) | Ein Stack für Server und Client |
| Server | Fastify, `better-sqlite3` | Leicht, läuft gut auf ARM64 |
| Jobs | `node-cron` im Worker-Prozess | Kein externer Scheduler nötig |
| Client | Vite + Preact (oder Vanilla TS), **kein** UI-Framework | Volle Kontrolle über Typografie, kleines Bundle |
| Schrift | Atkinson Hyperlegible, selbst gehostet (OFL) | Keine externen Requests [R4] |
| Vorlesen | Web Speech API (`speechSynthesis`), Systemstimme de-DE | Offline, ohne Kosten, ohne Latenz |
| Tests | Vitest (Unit), Playwright (E2E, Tablet-Viewport) | |
| Betrieb | Docker Compose, Image für `linux/arm64` und `linux/amd64` | Umzug auf Cloud-Server ohne Umbau |

### Repo-Struktur

```
/server          api + worker (gemeinsamer Code in /server/src/core)
/web             PWA
/shared          Typen (Article, Settings, …), Locale-Dateien
/deploy          docker-compose.yml, Pi-Setup-Skript, Tailscale-Anleitung
/docs            recherche.md, entscheidungen/ (ADRs)
SPEC.md, README.md, LICENSE (MIT)
```

## 4. Datenmodell (Kern)

```ts
type Article = {
  id: string;              // stabil, aus Quelle + Original-ID
  source: string;          // "tagesschau", später "regional"
  sourceUrl: string;
  lang: string;            // BCP-47, z. B. "de"
  section?: string;        // Rubrik, normalisiert: "inland", "region", "sport", …
  title: string;
  publishedAt: string;     // ISO
  fetchedAt: string;
  blocks: Block[];         // bereinigter Text, siehe unten
  summary?: Summary;
  wordCount: number;
  readingMinutes: number;  // grob, Basis 70 Wörter/min (AMD-Lesetempo)
  status: "new" | "ready" | "failed";
};

type Block =
  | { type: "heading"; text: string }
  | { type: "paragraph"; sentences: string[] }; // Satzgrenzen vorberechnet (für Vorlesen)

type Summary = {
  text: string;            // 2–3 Sätze, einfache Sprache
  model: string;           // z. B. "claude-haiku-…"
  createdAt: string;
};
```

Zusätzlich: `ReadingState` (zuletzt geöffneter Artikel, Seite) und `Settings` (siehe §7).

## 5. Inhalte (Server)

### 5.1 Quellen-Adapter

Jede Quelle ist ein Adapter mit derselben Schnittstelle:

```ts
interface SourceAdapter {
  id: string;
  fetchList(): Promise<RawItem[]>;
  fetchArticle(item: RawItem): Promise<RawArticle>;
}
```

- **Phase 1: tagesschau.** Öffentliche JSON-Schnittstelle der tagesschau (vor Umsetzung Endpunkte und Nutzungsbedingungen prüfen und in `docs/entscheidungen/` festhalten). Zusätzlich prüfen, ob sich „tagesschau in Einfacher Sprache" als eigene Rubrik einbinden lässt.
- **Phase 2: Regionale Tageszeitung (ePaper, Abo).** Nur Schnittstelle und Konfigurationsplatz vorsehen, **keinen Scraper bauen**, bevor der Betreuer die rechtliche Klärung (Nutzungsbedingungen, privater Gebrauch, KI-Kurzfassungen) freigegeben hat. Zugangsdaten nie im Repo, nur in `.env` auf dem Pi.

### 5.2 Verarbeitungs-Pipeline (Worker)

1. **Abholen:** alle 30 Minuten zwischen 5:00 und 22:00, danach Ruhe. Bis 6:30 muss die Morgenausgabe vollständig verarbeitet sein.
2. **Bereinigen:** Werbung, Bildunterschriften, „Mehr zum Thema", Links, Social-Embeds, Bildnachweise entfernen. Zwischenüberschriften behalten. Ergebnis als `Block[]`.
3. **Sätze trennen:** deutscher Satztrenner mit Abkürzungsliste (z. B., Dr., Nr., …). Satzgrenzen sind Grundlage für das Vorlesen.
4. **KI-Kurzfassung** (§6).
5. **Auswahl für die Ausgabe:** maximal 12 Artikel pro Tag in der Übersicht, Mischung nach konfigurierbaren Rubriken (z. B. 4× Region, 4× Deutschland/Welt, 2× Vermischtes, 2× Sport). Dubletten (gleiches Thema) zusammenfassen.
6. **Aufräumen:** Artikel älter als 7 Tage löschen.

Fehler einer Quelle dürfen die anderen nicht blockieren. Wenn nichts Neues kommt, bleibt die letzte Ausgabe sichtbar.

## 6. KI-Einsatz

| Aufgabe | KI | Phase |
|---|---|---|
| Kurzfassung 2–3 Sätze, einfache Sprache | Ja | 1 |
| Rubrik normalisieren, Dubletten erkennen | Ja (günstiges Modell) | 1 |
| Bereinigung schwieriger Quellen | Optional | 2 |
| Vereinfachte Fassung (Einfache Sprache) des ganzen Artikels | Option, Feature-Flag | später |
| Übersetzung | Nein | später |
| Vorlesen | Nein (Systemstimme) | – |
| Lesetext selbst | **Nie** | – |

Regeln:

- Läuft **nur auf dem Server**, einmal pro Artikel, Ergebnis wird gespeichert. Das Tablet ruft nie eine KI auf.
- **Provider-Abstraktion** (`SummaryProvider`), Standard: Anthropic Claude API. Modell und API-Schlüssel per `.env`. Ohne Schlüssel: Fallback auf die ersten zwei Sätze des Artikels.
- **Prompt** im Repo unter `/server/prompts/summary.de.md`, versioniert. Vorgaben: sachlich, keine Wertung, keine Informationen, die nicht im Text stehen, kurze Sätze, keine Fremdwörter ohne Not, max. 45 Wörter.
- Ausgabe validieren (Länge, Sprache); bei Verstoß einmal neu, sonst Fallback.
- Kosten begrenzen: Tageslimit an Aufrufen in der Konfiguration.
- In der Oberfläche ist die Kurzfassung als solche erkennbar (eigene Gestaltung, Hinweis im Admin-Bereich dokumentiert). Der Originalartikel ist immer einen Tipp entfernt.

## 7. Einstellungen

Alle Einstellungen liegen auf dem Server (`Settings`), werden vom Betreuer im Admin-Bereich gesetzt und vom Tablet beim Start und alle 15 Minuten geladen.

| Einstellung | Standard | Herkunft |
|---|---|---|
| `fontSizePx` | aus Kalibrierung (§8.4), min. entspricht 18 pt | [R1] |
| `lineHeight` | 2.0 | [R2] |
| `wordSpacingEm` | 0.25 | [R3] |
| `letterSpacingEm` | 0 (max. 0.05) | [R3] |
| `fontFamily` | Atkinson Hyperlegible, Alternative: eine Monospace | [R4] |
| `theme` | `dark` oder `light`, aus Kalibrierung | [R7] |
| `maxCharsPerLine` | 45 | [R5] |
| `ttsEnabled` | false (Phase 3 an) | [R29] |
| `ttsRate` | 0.85 | [R13] |
| `ttsVoice` | beste verfügbare `de-DE` | |
| `tickerMode` | false (Experiment) | [R10] |
| `lineFocus` | false (Experiment) | [R12] |
| `fingerFollow` | false (Experiment) | [R14] |
| `locale` | `de` | §11 |
| `sections` | Rubriken-Mix (§5.2) | |

## 8. Web-App (Tablet)

### 8.1 Allgemein

- **Querformat, Drehung gesperrt** (Manifest `orientation: landscape`). [R21]
- **Vollbild-PWA**, `display: fullscreen`. Kein Browser-Chrome sichtbar.
- **Pinch-Zoom und Textauswahl aus**, kein Kontextmenü bei langem Druck.
- **Wake Lock** im Artikel (Bildschirm bleibt an). In der Übersicht nicht. [R23]
- **Nur Einzeltipps.** Auslösen beim Loslassen. Berührungen unter 80 ms und zweiter Tipp innerhalb von 300 ms auf dasselbe Ziel ignorieren. Bewegt sich der Finger mehr als 10 mm, ist es kein Tipp. [R22]
- **Tippziele mindestens 15 mm, Ziel 20 mm**, Abstand ≥ 6 mm, mindestens 15 mm Abstand zum Bildschirmrand. In CSS-Pixel für das Tab S11 am Gerät mit Lineal verifizieren und als Konstante festhalten. [R17]
- **Höchstens 6 Tippziele pro Bildschirm.** [R18]
- **Jede Taste: Symbol + Wort**, immer an derselben Stelle. [R20]
- **Visuelles Feedback** beim Tippen (deutliche Umrandung/Invertierung, 150 ms), optional leiser Klick.
- **Keine** Dialoge, Toasts, Pop-ups, Cookie-Banner, Ladespinner über 1 s ohne Text, Zeitlimits. [R23]
- **AMOLED:** keine dauerhaft hellen, statischen Flächen. Kopf- und Fußleiste im Dunkelschema gedämpft, Logo/Uhr nicht dauerhaft weiß.
- **Barrierefreiheit:** semantisches HTML, WCAG 2.2 AA als Untergrenze, Kontrast ≥ 7:1 für allen Text (AAA). [R6]

### 8.2 Bildschirm „Übersicht"

- Kopf: Datum groß („Samstag, 24. Oktober"), kein Uhrzeit-Ticker.
- **Je Seite 3 Artikelkarten** untereinander (bei sehr großer Schrift 2), jede Karte ist als Ganzes eine Tippfläche:
  - Rubrik (klein, aber ≥ 0,7× Fließtextgröße)
  - Titel
  - Kurzfassung
  - „ca. 4 Minuten"
  - bereits gelesen: dezentes Häkchen, kein Ausgrauen des Textes
- Unten feste Leiste: **„◂ Zurück"** · „Seite 1 von 4" · **„Weiter ▸"**. Inaktive Taste bleibt sichtbar, aber gedämpft.
- Kein Scrollen. Seiten werden aus der Schriftgröße berechnet, sodass nichts abgeschnitten wird.

### 8.3 Bildschirm „Artikel"

- Kopf: **„◂ Übersicht"** (immer sichtbar, Notausgang). [R20]
- Titel, danach Fließtext in **einer Spalte**, linksbündig, kein Blocksatz, **keine Silbentrennung**, `max-width` nach `maxCharsPerLine`. [R5]
- **Seitenweise**, kein Scrollen. Umbruch nie mitten im Satz am Seitenende, wenn vermeidbar (lieber eine Zeile weniger). Unten: **„◂ Zurück"** · „Seite 2 von 5" · **„Weiter ▸"**. [R19]
- Am Artikelende statt „Weiter": **„Nächster Artikel ▸"** mit dessen Titel.
- Beim Öffnen der App: letzter Artikel und letzte Seite werden wiederhergestellt. [R24]
- Ab Phase 3 zusätzlich Taste **„🔊 Vorlesen"** (siehe §8.5).

### 8.4 Kalibrierung (nur Betreuer, gemeinsam mit der Nutzerin)

Geführter Ablauf im Admin-Bereich, auf dem Tablet ausgeführt:

1. **Schriftgröße:** Ein kurzer Beispielsatz in Stufen von je ca. +26 % (beginnend bei 18 pt). Betreuer tippt „angenehm" bei der ersten Stufe, die sie flüssig liest. Gespeichert wird diese Stufe oder eine darüber (Schalter). [R1]
2. **Farbschema:** derselbe Absatz einmal hell (≈ #111 auf #FAF7F0), einmal dunkel (≈ #F2EAD3 auf #000). Optional Lesezeit stoppen. Auswahl speichern. [R7]
3. **Vorschau** einer echten Artikelseite mit den gewählten Werten.

Abstand Auge–Tablet bei der Kalibrierung und im Alltag gleich halten (Ständer). [R9]

### 8.5 Vorlesen (Phase 3)

- **Tipp auf ein Wort** startet das Vorlesen **ab dem Satz, der dieses Wort enthält**. Erneuter Tipp irgendwo im Text: Pause. Taste „Vorlesen" startet am Seitenanfang. [R13]
- **Hervorhebung des aktuellen Satzes** (Hintergrund deutlich, kein Wort-für-Wort-Springen). Seite blättert automatisch weiter, wenn der Satz auf der nächsten Seite liegt.
- Tempo `ttsRate`, Lautstärke über Gerät.
- Vorlesen stoppt beim Verlassen des Artikels.
- **Fehlerfall:** keine de-DE-Stimme → Taste ausblenden, im Admin-Status melden.
- **Audioausgabe über Hörgeräte:** Die Ausgabe muss direkt über per Bluetooth gekoppelte Hörgeräte funktionieren (Android-Hörgeräteunterstützung, ASHA; LE Audio, sobald Gerät und Hörgeräte es können) oder kabelgebunden über einen USB-C-Klinkenadapter (z. B. zu einem Hörgeräte-Streamer oder Kopfhörer). Die App spielt nur über die Standard-Audioausgabe des Systems ab und darf kein Ausgabegerät erzwingen. Am Gerät testen: Verzögerung bis zum ersten Wort, Abbruch und Wiederaufnahme bei getrennter Verbindung (Vorlesen pausiert, nicht über den Tablet-Lautsprecher weiter), Lautstärke. Im Admin-Status anzeigen, ob gerade über Hörgeräte oder Lautsprecher ausgegeben wird, soweit der Browser das erkennen lässt.

### 8.6 Experimente (Feature-Flags, standardmäßig aus)

- **`tickerMode`:** Absatz als einzeilige Laufschrift, ca. 150–180 Zeichen/min, Tasten „Langsamer / Pause / Schneller", verschiebbare Fixiermarke (über/unter der Zeile, Einstellung des Betreuers). [R10]
- **`lineFocus`:** aktuelle Zeile voll, übrige Zeilen auf 40 % abgedunkelt; Weiter per Tipp unten. [R12]
- **`fingerFollow`:** Finger über den Text ziehen, das Wort unter dem Finger wird leise gesprochen und der Satz hervorgehoben. Nur zusätzlich zu §8.5, nie als einziger Weg. [R14]

Jedes Experiment protokolliert lokal anonyme Nutzung (siehe §10), damit der Betreuer bewerten kann, ob es hilft.

## 9. Betrieb

- **Raspberry Pi 5** (4 GB reicht), **SSD statt SD-Karte**, Docker Compose, Neustart-Policy `unless-stopped`, Hardware-Watchdog an.
- **Tailscale** auf dem Pi und den Geräten des Betreuers. Das Tablet erreicht den Pi über dessen Tailscale-Namen; HTTPS-Zertifikat per `tailscale cert`. Ohne gültiges HTTPS keine Service Worker → Pflicht.
- **Admin-Bereich** nur über Tailscale erreichbar **und** zusätzlich PIN-geschützt.
- **Updates:** Images werden aus GitHub Container Registry gezogen; Update nachts (03:00) per Watchtower oder Cron, mit Rollback auf das vorherige Image bei fehlgeschlagenem Healthcheck.
- **Offline:** Service Worker speichert die aktuelle Ausgabe (Übersicht + alle Artikel) auf dem Tablet. Fällt Pi oder Internet aus, bleibt die letzte Ausgabe lesbar, mit dezentem Hinweis „Stand: heute 6:30 Uhr" statt Fehlermeldung.
- **Tablet:** Chrome, PWA installiert, Bildschirmfixierung oder Kiosk-Launcher (Entscheidung beim Einrichten, in README dokumentieren), Benachrichtigungen aus, Systemschrift groß, Helligkeit hoch.
- **Backup:** SQLite und Settings täglich auf einen konfigurierbaren WebDAV-Pfad (z. B. Nextcloud).

## 10. Admin-Bereich (Betreuer)

Erreichbar unter `/admin`, für Smartphone/PC des Betreuers gestaltet (normale Größen).

- Einstellungen aus §7 bearbeiten, mit Live-Vorschau.
- Kalibrierung starten (§8.4).
- Quellen und Rubriken-Mix.
- Status: letzter Abruf je Quelle, Fehler, KI-Verbrauch heute, verfügbare TTS-Stimmen (vom Tablet gemeldet), Speicher, Version.
- **Nutzungsprotokoll** (nur lokal auf dem Pi, keine Weitergabe): geöffnete Artikel, Seiten, Lesedauer, Taste „Vorlesen" benutzt. Dient nur dazu, das Produkt für die Nutzerin zu verbessern. Abschaltbar.
- Text des gedruckten Spickzettels als druckbare Seite (A4, Großdruck) generieren. [R28]

## 11. Sprache und Erweiterbarkeit

- **Version 1 liefert nur Deutsch**, ist aber von Anfang an mehrsprachig gebaut.
- Alle UI-Texte in `/shared/locales/de.json`, keine festen Strings im Code. Formatierung von Datum/Zahlen über `Intl` mit `locale`.
- Jeder Artikel hat `lang`. Daraus folgen: `lang`-Attribut im HTML, TTS-Stimme, Satztrenner, Prompt-Datei (`summary.<lang>.md`).
- Neue Sprache = neue Locale-Datei + Prompt + ggf. Satztrenner-Regeln. Kein Umbau.
- Die Sprache stellt nur der Betreuer ein.

## 12. Öffentliches Repo – Regeln

- **Keine personenbezogenen Daten** der Nutzerin oder des Betreuers im Repo (Namen, Adressen, Augenbefunde, Fotos, Logs).
- **Keine Secrets:** `.env.example` mit Platzhaltern; `.env`, `data/` und Logs in `.gitignore`. Secret-Scanning in CI aktivieren.
- **Keine Inhalte Dritter** (Artikeltexte, Screenshots von ePaper-Seiten) als Testdaten im Repo. Testdaten sind selbst geschriebene Beispieltexte.
- Lizenz: MIT (Code). Schrift Atkinson Hyperlegible: OFL, Lizenzdatei mitliefern.

## 13. Meilensteine

| # | Ziel | Abnahme |
|---|---|---|
| M0 | Repo-Gerüst, CI (Lint, Tests, arm64-Build), Docker Compose läuft lokal | `docker compose up` liefert leere Übersicht |
| M1 | tagesschau-Adapter, Bereinigung, Satztrennung, Übersicht + Artikel statisch, ohne KI | Artikel lesbar, Regeln §8.1–8.3 erfüllt, Playwright-Tests grün |
| M2 | Admin-Bereich, Settings, Kalibrierung | Größe/Schema per Kalibrierung gesetzt und auf dem Tablet wirksam |
| M3 | KI-Kurzfassungen inkl. Fallback und Tageslimit | Jede Karte hat Kurzfassung ≤ 45 Wörter |
| M4 | PWA offline, Tailscale-HTTPS, Pi-Deployment-Skript, nächtliche Updates | Pi neu gestartet → Tablet zeigt wieder aktuelle Ausgabe ohne Eingriff |
| M5 | Vorlesen (§8.5) | Tipp auf Wort startet ab Satz, Hervorhebung, Pause |
| M6 | Experimente (§8.6) hinter Flags | Je Flag einzeln an-/abschaltbar |
| M7 | Regionalzeitungs-Adapter | **Erst nach schriftlicher Freigabe durch den Betreuer** |

Nach M1, M2 und M5 testet der Betreuer mit der Nutzerin am Gerät; Rückmeldungen gehen als Issues ins Repo.

## 14. Qualitätsanforderungen

- **E2E-Tests** im Viewport des Tab S11 (Querformat; tatsächliche CSS-Auflösung am Gerät ermitteln und eintragen) für: Übersicht blättern, Artikel öffnen, blättern, zurück, Zustand nach Neuladen, Offline-Modus.
- **Automatischer Check** in CI: Kontrast ≥ 7:1 für beide Schemata, Tippziele ≥ Minimalgröße, maximal 6 Tippziele pro Bildschirm, keine Scrollbalken in Übersicht/Artikel.
- **Performance:** Übersicht in < 1 s aus dem Cache, Seitenwechsel < 100 ms.
- **Robustheit:** Ein kaputter Artikel darf die Übersicht nicht verhindern; Quelle down → letzte Ausgabe bleibt.

## 15. Offene Punkte (vom Betreuer zu klären)

1. Rechtliche Klärung Regionalzeitungs-ePaper (Zugang, Nutzungsbedingungen, KI-Kurzfassungen) → Voraussetzung für M7.
2. Augenbefund (Linsentrübung? Ausfall links/rechts?) – beeinflusst Farbschema und Laufschrift-Marke. Empfehlung: Low-Vision-Beratung.
3. Hörgeräte der Nutzerin: Unterstützen sie ASHA oder LE Audio (nicht nur „Made for iPhone")? Kopplung mit dem Tab S11 vor M5 testen.
4. Kiosk-Lösung auf dem Tab S11: Bildschirmfixierung vs. Kiosk-Launcher.

