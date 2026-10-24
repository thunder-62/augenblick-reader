# SPEC – Augenblick

> Spezifikation für den Coding-Agenten. Version 0.1, Stand 24.10.2026.
> Hintergrund und Belege: [`docs/recherche.md`](docs/recherche.md). Regelnummern wie **[R13]** verweisen auf die „Design-Regeln für den Reader" dort.

## 1. Worum es geht

Ein Zeitungs-Reader im Browser für **eine einzige Nutzerin**: hochaltrig (85+), altersbedingte Makuladegeneration (AMD), wenig Technikerfahrung. Sie soll ihre Tageszeitung wieder **selbst lesen** können. Vorlesen ist Begleitung, kein Ersatz.

Das Produkt besteht aus zwei Teilen:

- **Server** (läuft auf einem Raspberry Pi im Heimnetz der Nutzerin): holt Artikel ab, bereinigt sie, erzeugt Kurzfassungen per KI, speichert alles und liefert die Web-App aus.
- **Web-App / PWA** (läuft im Vollbild auf einem Samsung Galaxy Tab S11, 11", AMOLED, Android): Übersicht → Artikel. Sonst fast nichts.

Ein Angehöriger („Betreuer") richtet alles ein und kümmert sich um die Technik. **Ihre Leseeinstellungen ändert die Nutzerin selbst**, wenn sie möchte (§8.7). Kein abgeschlossener Bereich, kein PIN: Schutz vor Versehen durch eine Rückfrage, nicht durch Bevormundung.

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
- Keine native Android-App (Web-App reicht).
- Kein Kiosk-Modus, kein Offline-Modus, Fernwartung nur optional (Entscheidung des Betreuers).
- Keine Übersetzung, kein RSVP [R11].

## 3. Architektur

```
┌────────────── Heimnetz der Nutzerin ──────────────┐
│                                                   │
│  Tablet (Chrome, PWA, Vollbild)                   │
│      │ HTTPS (Tailscale-Zertifikat)               │
│      ▼                                            │
│  Raspberry Pi (systemd-Dienste)                   │
│   ├─ api      Fastify, liefert Web-App + JSON-API │
│   ├─ worker   Abholen → Bereinigen → KI → SQLite  │
│   └─ data/    SQLite, Konfiguration, Cache        │
│      │                                            │
└──────┼────────────────────────────────────────────┘
       │ ausgehend: Quellen (tagesschau, BR24, später Regionalzeitung), KI-API
       ▼
   Internet          Betreuer ──Tailscale──▶ Technik-Bereich
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
| Betrieb | Node direkt auf dem Pi, zwei systemd-Dienste (`augenblick-api`, `augenblick-worker`), **kein Docker** | Einfach, wenig Last, direkte Fehlersuche; läuft unverändert auch auf jedem Linux-Server |

### Repo-Struktur

```
/server          api + worker (gemeinsamer Code in /server/src/core)
/web             PWA
/shared          Typen (Article, Settings, …), Locale-Dateien
/deploy          systemd-Units, install.sh, update.sh, Tailscale-Anleitung
/docs            recherche.md, entscheidungen/ (ADRs)
SPEC.md, README.md, LICENSE (MIT)
```

## 4. Datenmodell (Kern)

```ts
type Article = {
  id: string;              // stabil, aus Quelle + Original-ID
  source: string;          // "tagesschau", "br24", später "regional"
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
  model: string;           // OpenRouter-Modell-ID, z. B. "anthropic/claude-haiku-…"
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

- **Phase 1a: tagesschau** (Deutschland/Welt). Öffentliche JSON-Schnittstelle der tagesschau (vor Umsetzung Endpunkte und Nutzungsbedingungen prüfen und in `docs/entscheidungen/` festhalten). Zusätzlich prüfen, ob sich „tagesschau in Einfacher Sprache" als eigene Rubrik einbinden lässt.
- **Phase 1b: BR24** (Bayern und Region). BR24 bietet RSS-Feeds, u. a. allgemein (`https://feeds.br24.de/rss/nachrichten`) und je Region bzw. Ressort (`nachrichtenfeeds.br.de/...`). Die Region (Feed-URL) ist eine Einstellung des Betreuers, nicht fest im Code. Feeds liefern meist nur Anreißer: Volltext von der Artikelseite holen und mit einer Readability-artigen Extraktion bereinigen. Vor Umsetzung aktuelle Feed-URLs, insbesondere für Franken/Mittelfranken, und Nutzungsbedingungen prüfen und dokumentieren.
- **Dubletten zwischen Quellen:** Gleiche Meldung bei tagesschau und BR24 nur einmal zeigen, bevorzugt die Fassung mit mehr Text.
- **Phase 2: Regionale Tageszeitung (ePaper, Abo).** Nur Schnittstelle und Konfigurationsplatz vorsehen, **keinen Scraper bauen**, bevor der Betreuer die rechtliche Klärung (Nutzungsbedingungen, privater Gebrauch, KI-Kurzfassungen) freigegeben hat. Zugangsdaten nie im Repo, nur in `.env` auf dem Pi.

### 5.2 Verarbeitungs-Pipeline (Worker)

1. **Abholen:** alle 30 Minuten zwischen 5:00 und 22:00, danach Ruhe. Bis 6:30 muss die Morgenausgabe vollständig verarbeitet sein.
2. **Bereinigen:** Werbung, Bildunterschriften, „Mehr zum Thema", Links, Social-Embeds, Bildnachweise entfernen. Zwischenüberschriften behalten. Ergebnis als `Block[]`.
3. **Sätze trennen:** deutscher Satztrenner mit Abkürzungsliste (z. B., Dr., Nr., …). Satzgrenzen sind Grundlage für das Vorlesen.
4. **KI-Kurzfassung** (§6).
5. **Auswahl für die Ausgabe:** maximal 12 Artikel pro Tag in der Übersicht, Mischung nach konfigurierbaren Rubriken (z. B. 4× Region aus BR24, 4× Deutschland/Welt aus tagesschau, 2× Vermischtes, 2× Sport). Dubletten (gleiches Thema) zusammenfassen.
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
- **Anbindung über OpenRouter** (OpenAI-kompatible Chat-Completions-API). `.env`: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (Modell frei wählbar, Standard ein günstiges, gutes Modell für Deutsch), optional `OPENROUTER_FALLBACK_MODEL`. Header `HTTP-Referer`/`X-Title` mit dem Projektnamen setzen. Trotzdem hinter einer schmalen Provider-Abstraktion (`SummaryProvider`), damit ein Wechsel möglich bleibt. Ohne Schlüssel oder bei Fehler: Fallback auf den Anreißer der Quelle bzw. die ersten zwei Sätze.
- Im Technik-Status: genutztes Modell, Aufrufe und Kosten heute (aus der OpenRouter-Antwort, soweit geliefert).
- **Prompt** im Repo unter `/server/prompts/summary.de.md`, versioniert. Vorgaben: sachlich, keine Wertung, keine Informationen, die nicht im Text stehen, kurze Sätze, keine Fremdwörter ohne Not, max. 45 Wörter.
- Ausgabe validieren (Länge, Sprache); bei Verstoß einmal neu, sonst Fallback.
- Kosten begrenzen: Tageslimit an Aufrufen in der Konfiguration.
- Die Kurzfassung steht **ohne Beschriftung** (kein „Kurz gesagt“, kein „KI“) direkt unter dem Titel; die Position auf der Karte macht sie als Zusammenfassung erkennbar. Der Originalartikel ist immer einen Tipp entfernt. (Entscheidung des Betreuers nach Prototyp-Test.)
- **KI-Symbol:** Stammt die Kurzfassung von der KI (nicht vom Anreißer der Quelle), steht vor ihr ein kleines, ruhiges Symbol statt eines Textes. Gestaltung: eigenes SVG, gleiche Farbe wie der Text der Kurzfassung (Kontrast ≥ 7:1), Höhe ca. 0,8 × Schriftgröße, keine Animation, kein Tippziel. Bedeutung steht auf dem gedruckten Spickzettel und in den Einstellungen. Motiv: **Funkelstern (✦)** als eigenes SVG.

## 7. Einstellungen

Alle Einstellungen liegen auf dem Server (`Settings`). Die Leseeinstellungen ändert die Nutzerin auf dem Tablet (§8.7), der Betreuer kann sie im Technik-Bereich ansehen und auf eine frühere Fassung zurücksetzen (§10). Das Tablet lädt sie beim Start und alle 15 Minuten.

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

### 8.4 Kalibrierung („Schrift einstellen“)

Geführter Ablauf in den Einstellungen der Nutzerin (§8.7), allein oder gemeinsam mit dem Betreuer:

1. **Schriftgröße:** Ein kurzer Beispielsatz in Stufen von je ca. +26 % (beginnend bei 18 pt). Sie (oder der Betreuer mit ihr) tippt „Das ist angenehm“ bei der ersten Stufe, die sie flüssig liest. Gespeichert wird diese Stufe oder eine darüber (Schalter). [R1]
2. **Farbschema:** derselbe Absatz einmal hell (≈ #111 auf #FAF7F0), einmal dunkel (≈ #F2EAD3 auf #000). Optional Lesezeit stoppen. Auswahl speichern. [R7]
3. **Vorschau** einer echten Artikelseite mit den gewählten Werten.

Abstand Auge–Tablet bei der Kalibrierung und im Alltag gleich halten (Ständer). [R9]

### 8.5 Vorlesen (Phase 3)

- **Tipp auf ein Wort** startet das Vorlesen **ab dem Satz, der dieses Wort enthält**. Erneuter Tipp irgendwo im Text: Pause. Taste „Vorlesen" startet am Seitenanfang. [R13]
- **Hervorhebung des aktuellen Satzes** (Hintergrund deutlich, kein Wort-für-Wort-Springen). Seite blättert automatisch weiter, wenn der Satz auf der nächsten Seite liegt.
- Tempo `ttsRate`, Lautstärke über Gerät.
- Vorlesen stoppt beim Verlassen des Artikels.
- **Fehlerfall:** keine de-DE-Stimme → Taste ausblenden, im Technik-Status melden.
- **Audioausgabe über Hörgeräte:** Die Ausgabe muss direkt über per Bluetooth gekoppelte Hörgeräte funktionieren (Android-Hörgeräteunterstützung, ASHA; LE Audio, sobald Gerät und Hörgeräte es können) oder kabelgebunden über einen USB-C-Klinkenadapter (z. B. zu einem Hörgeräte-Streamer oder Kopfhörer). Die App spielt nur über die Standard-Audioausgabe des Systems ab und darf kein Ausgabegerät erzwingen. Am Gerät testen: Verzögerung bis zum ersten Wort, Abbruch und Wiederaufnahme bei getrennter Verbindung (Vorlesen pausiert, nicht über den Tablet-Lautsprecher weiter), Lautstärke. Im Technik-Status anzeigen, ob gerade über Hörgeräte oder Lautsprecher ausgegeben wird, soweit der Browser das erkennen lässt.

### 8.6 Experimente (Feature-Flags, standardmäßig aus)

- **`tickerMode`:** Absatz als einzeilige Laufschrift, ca. 150–180 Zeichen/min, Tasten „Langsamer / Pause / Schneller", verschiebbare Fixiermarke (über/unter der Zeile, in den Einstellungen). [R10]
- **`lineFocus`:** aktuelle Zeile voll, übrige Zeilen auf 40 % abgedunkelt; Weiter per Tipp unten. [R12]
- **`fingerFollow`:** Finger über den Text ziehen, das Wort unter dem Finger wird leise gesprochen und der Satz hervorgehoben. Nur zusätzlich zu §8.5, nie als einziger Weg. [R14]

Ob ein Experiment hilft, klären Betreuer und Nutzerin gemeinsam im Gespräch; Nutzungsprotokoll siehe §10.

### 8.7 Einstellungen der Nutzerin

Bewusste Abweichung von [R26] der Recherche: **Autonomie vor Schutz.** Die Nutzerin darf alles ändern, was ihr Lesen betrifft. Abgesichert wird gegen Versehen, nicht gegen sie.

- **Erreichbar** über eine beschriftete Taste „Einstellungen“ in der Übersicht (zählt zu den max. 6 Tippzielen). Kein PIN, kein versteckter Zugang.
- **Inhalt:** Schrift einstellen (§8.4), Farbschema, Zeilenabstand, Vorlesen an/aus und Tempo, später ggf. Laufschrift. Keine Technik (Quellen, KI, Updates) – die liegt im Technik-Bereich (§10).
- **Gestaltung** nach denselben Regeln wie §8.1: groß, Einzeltipps, Symbol + Wort, max. 6 Tippziele pro Bildschirm, blättern statt scrollen. Jede Änderung wirkt sofort auf eine **Vorschau** mit echtem Text.
- **Zweistufiges Speichern:** Taste „Speichern“ führt zu einem eigenen ganzseitigen Bestätigungsschritt (kein Pop-up): „Soll das ab jetzt immer so bleiben?“ mit den Tasten **„Ja, so lassen“** und **„Nein, wie vorher“**. Erst „Ja“ speichert dauerhaft.
- **Verlassen ohne Bestätigung** (z. B. „◂ Übersicht“) stellt den vorherigen Zustand wieder her. Nichts ändert sich unbemerkt.
- **Taste „Wie am Anfang“** stellt die zuletzt gemeinsam kalibrierten Werte wieder her, ebenfalls mit Bestätigungsschritt.
- Jede gespeicherte Fassung wird mit Zeitpunkt aufbewahrt; der Betreuer kann im Technik-Bereich auf eine frühere zurückgehen (Hilfe bei Versehen, keine Kontrolle).
- Anrede (du/Sie) und Wortlaut kommen aus der Locale-Datei und werden beim Einrichten gewählt.

## 9. Betrieb

- **Raspberry Pi 5** (4 GB reicht), **SSD statt SD-Karte**, Raspberry Pi OS Lite (64 bit), Node.js 22 LTS. Zwei systemd-Dienste mit `Restart=always`, eigener Systembenutzer `augenblick`, Daten unter `/var/lib/augenblick`, Programm unter `/opt/augenblick`. Hardware-Watchdog an.
- **`deploy/install.sh`** richtet alles auf einem frischen Pi ein (Benutzer, Verzeichnisse, Node, Dienste, Tailscale-Hinweise, `.env` aus Vorlage). Idempotent, mehrfach ausführbar.
- **HTTPS** im Heimnetz ist nötig, weil der Browser Bildschirm-wach-Halten (Wake Lock) und die Installation als App nur über HTTPS erlaubt. Einfachster Weg: Tailscale auf Pi und Tablet, Zertifikat per `tailscale cert`. Tailscale ermöglicht nebenbei optional den Fernzugriff des Betreuers.
- **Technik-Bereich** im Heimnetz (bzw. über Tailscale) erreichbar, ohne PIN. Er ist auf dem Tablet nicht verlinkt, weil er nur Technik enthält, nicht weil er versperrt wäre.
- **Updates:** CI erstellt bei jedem Release ein fertiges Paket (gebaute Web-App + Server, ohne `node_modules`) als GitHub-Release-Asset. `deploy/update.sh` läuft nachts (03:00, systemd-Timer): neues Release laden → nach `/opt/augenblick/releases/<version>` entpacken → `npm ci --omit=dev` → Symlink `current` umstellen → Dienste neu starten → Healthcheck (`/health`). Schlägt er fehl, Symlink zurück auf die vorige Version und erneut starten. Die letzten 3 Versionen bleiben liegen. Native Abhängigkeiten (`better-sqlite3`) nutzen die arm64-Prebuilds; falls keine passen, wird auf dem Pi gebaut (`build-essential` in `install.sh`).
- **Kein Offline-Modus.** Ist der Pi nicht erreichbar, zeigt die App einen ruhigen Hinweis in großer Schrift („Die Zeitung ist gerade nicht erreichbar. Bitte später noch einmal öffnen.“) statt einer technischen Fehlermeldung.
- **Tablet:** Chrome, Augenblick als App bzw. Verknüpfung auf dem Startbildschirm, Benachrichtigungen aus, Systemschrift groß, Helligkeit hoch. Kein Kiosk-Modus.
- **Backup:** SQLite und Settings täglich auf einen konfigurierbaren WebDAV-Pfad (z. B. Nextcloud).

## 10. Technik-Bereich (Betreuer)

Erreichbar unter `/technik`, für Smartphone/PC des Betreuers gestaltet (normale Größen). Enthält Technik, keine Bevormundung: Was das Lesen betrifft, entscheidet die Nutzerin in §8.7.

- Aktuelle Leseeinstellungen ansehen, Verlauf der gespeicherten Fassungen, auf eine frühere zurücksetzen.
- Quellen und Rubriken-Mix.
- Status: letzter Abruf je Quelle, Fehler, KI-Verbrauch heute, verfügbare TTS-Stimmen (vom Tablet gemeldet), Speicher, Version.
- **Nutzungsprotokoll** (nur lokal auf dem Pi, keine Weitergabe, **standardmäßig aus**): geöffnete Artikel, Seiten, Lesedauer, Taste „Vorlesen“ benutzt. Nur mit Wissen und Zustimmung der Nutzerin einschalten; ist es an, steht das in ihren Einstellungen.
- Text des gedruckten Spickzettels als druckbare Seite (A4, Großdruck) generieren. [R28]

## 11. Sprache und Erweiterbarkeit

- **Version 1 liefert nur Deutsch**, ist aber von Anfang an mehrsprachig gebaut.
- Alle UI-Texte in `/shared/locales/de.json`, keine festen Strings im Code. Formatierung von Datum/Zahlen über `Intl` mit `locale`.
- Jeder Artikel hat `lang`. Daraus folgen: `lang`-Attribut im HTML, TTS-Stimme, Satztrenner, Prompt-Datei (`summary.<lang>.md`).
- Neue Sprache = neue Locale-Datei + Prompt + ggf. Satztrenner-Regeln. Kein Umbau.
- Die Sprache ist in den Einstellungen der Nutzerin wählbar, sobald es mehr als eine gibt.

## 12. Öffentliches Repo – Regeln

- **Keine personenbezogenen Daten** der Nutzerin oder des Betreuers im Repo (Namen, Adressen, Augenbefunde, Fotos, Logs).
- **Keine Secrets:** `.env.example` mit Platzhaltern; `.env`, `data/` und Logs in `.gitignore`. Secret-Scanning in CI aktivieren.
- **Keine Inhalte Dritter** (Artikeltexte, Screenshots von ePaper-Seiten) als Testdaten im Repo. Testdaten sind selbst geschriebene Beispieltexte.
- Lizenz: MIT (Code). Schrift Atkinson Hyperlegible: OFL, Lizenzdatei mitliefern.
- **Keine fremden Marken** (Logos, Namen, Farben von Verlagen oder Sendern) im Repo, außer als reine Quellenangabe im Text.

### 12a. Branding durch Dritte (White-Label)

Verlage oder Sender sollen Augenblick mit eigenem Branding nutzen können. Deshalb:

- **Branding als Konfiguration**, nicht im Code: Name, Logo (SVG), eine Akzentfarbe, Impressums-/Datenschutz-Links, Standardquellen. Ein Ordner `/branding/<name>/` pro Variante; Standard ist das neutrale Augenblick-Branding.
- **Lesbarkeit geht vor Corporate Design:** Branding darf Schriftgröße, Abstände, Farbschemata und Kontrast (≥ 7:1) nicht verändern. Akzentfarben nur für Rahmen und Symbole, nur wenn sie im jeweiligen Schema den Kontrast einhalten (CI prüft das). Logo nur auf der Übersicht, nicht im Artikel.
- **Quellen-Adapter austauschbar**, damit ein Verlag seine eigene Artikel-Schnittstelle anbinden kann, ohne den Rest zu ändern.
- Betrieb nicht nur als Einzelinstallation auf einem Pi denkbar: Architektur so halten, dass später mehrere Nutzerinnen pro Server möglich wären (Settings pro Gerät statt global), auch wenn Version 1 nur eine unterstützt.

## 13. Meilensteine

| # | Ziel | Abnahme |
|---|---|---|
| M0 | Repo-Gerüst, CI (Lint, Tests, Release-Paket), lokaler Start per `npm run dev` | `npm run dev` liefert leere Übersicht |
| M1 | tagesschau- und BR24-Adapter, Bereinigung, Satztrennung, Übersicht + Artikel statisch, ohne KI | Artikel lesbar, Regeln §8.1–8.3 erfüllt, Playwright-Tests grün |
| M2 | Einstellungen der Nutzerin mit zweistufigem Speichern (§8.7), Kalibrierung, Technik-Bereich | Nutzerin ändert Größe/Schema selbst, Bestätigungsschritt greift, Betreuer kann auf frühere Fassung zurücksetzen |
| M3 | KI-Kurzfassungen inkl. Fallback und Tageslimit | Jede Karte hat Kurzfassung ≤ 45 Wörter |
| M4 | HTTPS, Pi-Deployment-Skript, nächtliche Updates | Pi neu gestartet → Tablet zeigt wieder aktuelle Ausgabe ohne Eingriff |
| M5 | Vorlesen (§8.5) | Tipp auf Wort startet ab Satz, Hervorhebung, Pause |
| M6 | Experimente (§8.6) hinter Flags | Je Flag einzeln an-/abschaltbar |
| M7 | Regionalzeitungs-Adapter | **Erst nach schriftlicher Freigabe durch den Betreuer** |

Nach M1, M2 und M5 testet der Betreuer mit der Nutzerin am Gerät; Rückmeldungen gehen als Issues ins Repo.

## 14. Qualitätsanforderungen

- **E2E-Tests** im Viewport des Tab S11 (Querformat; tatsächliche CSS-Auflösung am Gerät ermitteln und eintragen) für: Übersicht blättern, Artikel öffnen, blättern, zurück, Zustand nach Neuladen, Hinweis bei nicht erreichbarem Server.
- **Automatischer Check** in CI: Kontrast ≥ 7:1 für beide Schemata, Tippziele ≥ Minimalgröße, maximal 6 Tippziele pro Bildschirm, keine Scrollbalken in Übersicht/Artikel.
- **Performance:** Übersicht in < 1 s aus dem Cache, Seitenwechsel < 100 ms.
- **Robustheit:** Ein kaputter Artikel darf die Übersicht nicht verhindern; Quelle down → letzte Ausgabe bleibt.

## 15. Offene Punkte (vom Betreuer zu klären)

1. Rechtliche Klärung Regionalzeitungs-ePaper (Zugang, Nutzungsbedingungen, KI-Kurzfassungen) → Voraussetzung für M7.
2. Augenbefund (Linsentrübung? Ausfall links/rechts?) – beeinflusst Farbschema und Laufschrift-Marke. Empfehlung: Low-Vision-Beratung.
3. Hörgeräte der Nutzerin: Unterstützen sie ASHA oder LE Audio (nicht nur „Made for iPhone")? Kopplung mit dem Tab S11 vor M5 testen.

