# Stand und Absprachen

Hier steht, wie weit Augenblick ist und was mit dem Betreuer abgesprochen wurde. Die Einzelheiten stehen in den Aufträgen (`docs/auftraege/`) und Entscheidungen (`docs/entscheidungen/`). Verbindlich bleibt `SPEC.md`.

Stand: 24.10.2026

## Stand der Meilensteine

| Meilenstein | Inhalt | Stand | Auftrag |
| --- | --- | --- | --- |
| M0 | Grundgerüst, Workspaces, CI, systemd-Betrieb, Update mit Rückfall | erledigt | [001](auftraege/001-m0-m1-grundgeruest-und-lesen.md) |
| M1 | tagesschau und BR24, Tagesausgabe, Übersicht und Artikel, Blättern per Taste | erledigt | [001](auftraege/001-m0-m1-grundgeruest-und-lesen.md) |
| M2 | Leserin stellt selbst ein (mit Rückfrage), Einführung in 6 Schritten, Technik-Bereich `/technik` | erledigt | [002](auftraege/002-m2-einstellungen-einfuehrung-technik.md) |
| M3 | KI-Kurzfassungen über OpenRouter mit Funkelstern und Fallback, Interessen lernen mit Einverständnis | erledigt | [003](auftraege/003-m3-ki-und-interessen.md) |
| M4 ff. | HTTPS, Vorlesen, weitere Quellen … | nicht begonnen | – |

Geprüft wurde alles in der Entwicklungsumgebung: Lint, 140 Unit-Tests und 33 E2E-Tests (Chromium, 1280 × 800) sind grün. **Am echten Tablet und am Raspberry Pi wurde noch nichts getestet.**

## Absprachen mit dem Betreuer

1. **Über M1 hinaus weitergebaut.** In `CLAUDE.md` steht „Nach M1 anhalten“. Der Betreuer hatte das Gerät nicht zur Hand und hat M2 und M3 ausdrücklich angefordert („Mach mal bis M3“). Der Test mit der Leserin am Gerät deckt deshalb M1–M3 zusammen ab. **Nach M3 wird angehalten.** Mit M4 geht es erst nach diesem Test weiter.
2. **Kein Messen am Gerät.** CSS-Auflösung und Millimeter des Tablets werden nicht gemessen. Die Schriftgröße stellt die Leserin in der Einführung selbst ein, und die Tippziele behalten den vorsichtigen Schätzwert (Auftrag 001, offene Frage 4).
3. **Neue Spec von `main` übernommen.** Die Spec wurde während der Arbeit geändert. Die erste Fassung von M2 und M3 wurde danach umgebaut (ADR 007–009):
   - Die Leserin ändert ihre Leseeinstellungen selbst. Vor dem Speichern kommt die Rückfrage „Soll das ab jetzt immer so bleiben?“.
   - Den PIN-geschützten Admin-Bereich ersetzt der Technik-Bereich `/technik`. Er hat keine PIN und ist nur aus dem Heimnetz oder über Tailscale erreichbar.
   - Die KI läuft über OpenRouter statt über das Anthropic-SDK. Vor KI-Kurzfassungen steht der Funkelstern statt eines Strichs.
   - Interessen lernen ersetzt das Nutzungsprotokoll. Es läuft nur mit Einverständnis.
   - Es gibt keinen Kiosk- und keinen Offline-Modus.
4. **Betrieb auf dem Windows-PC zum Ausprobieren.** Server und Web-App laufen auch unter Windows (Node.js 22, PowerShell), siehe README „Starten“. Die Skripte in `deploy/` gelten nur für Pi und Linux.
5. **KI-Modell:** Standard ist das im Prototyp erprobte kostenlose Modell. Für den Dauerbetrieb trägt der Betreuer ein günstiges bezahltes Modell ein (Auftrag 003, offene Frage 1).
6. **Kein Release ohne Freigabe.** Das Tag `v0.1.0`, das das Release-Paket für `install.sh`/`update.sh` erzeugt, setzt nur der Betreuer.
7. **Arbeitsweise:** Entwickelt wird auf dem Branch `claude/claude-md-offene-auftraege-h1iuc3`. Pull Requests gibt es nur auf Wunsch. Commits sind klein und deutsch, und vor jedem Commit laufen Lint und Tests grün.

## Abgleich mit der Spec

Am 24.10.2026 nochmals gegen `SPEC.md` (Version 0.1) geprüft. Auf `main` gab es seit der Übernahme keine Änderung.

**Erfüllt** (M0–M3):

- §5.1–5.3: Quellen, Pipeline, Interessen lernen.
- §6: OpenRouter, Prüfung von Länge und Sprache, Fallback, Tageslimit, Funkelstern.
- §7: Einstellungen auf dem Server; das Tablet lädt sie beim Start und alle 15 Minuten.
- §8.1–8.4: Manifest im Querformat und Vollbild, Tipp-Logik mit 150 ms Feedback, Übersicht, Artikel, Kalibrierung in Stufen von +26 % ab 18 pt mit „Eine Stufe größer“.
- §8.7: Einstellungen der Leserin, Vorschau mit echtem Text, zweistufiges Speichern.
- §8.8: Einführung. Wortlaute wie in der Spec: „Los geht’s“, „So lese ich besser“, „Gut, das war es schon.“, Einverständnisfrage und Rückfrage.
- §10: Technik-Bereich, §11: Locale.
- §14: Prüfungen auf Kontrast, Tippziele und Scrollbalken.

**Bewusst noch nicht gebaut**, weil sie zu späteren Meilensteinen gehören:

- Vorlesen mit Hörgeräten, die Vorlese-Schritte in Einführung und Einstellungen, TTS-Stimmen im Technik-Status (M5).
- Experimente (M6).
- HTTPS (M4).
- Regionalzeitung (M7).
- Die Einführung hat deshalb 6 statt 7 Schritte, denn Schritt 6 „Vorlesen“ gibt es laut Spec nur, wenn Vorlesen aktiv ist.

**Abweichungen und Lücken**, die der Betreuer entscheiden sollte:

1. **Messen am Gerät (§8.1, §14):** Die Spec verlangt weiterhin, die Tippziele in CSS-Pixeln mit dem Lineal am Gerät zu prüfen und die CSS-Auflösung für die E2E-Tests einzutragen. Laut Absprache entfällt das. Weil bei einem Widerspruch die Spec gilt (`CLAUDE.md`), bitte die beiden Stellen in `SPEC.md` anpassen. Bis dahin gelten der Schätzwert und der Viewport 1280 × 800.
2. **Rubriken und Dubletten per KI (§6, Phase 1):** Laut Tabelle soll das ein günstiges Modell übernehmen. Umgesetzt ist es ohne KI: Die Rubriken werden je Quelle zugeordnet, Dubletten über Wortvergleich erkannt (ADR 001, 002). In Auftrag 003 stand dazu fälschlich „optional“. M3 nennt es in der Abnahme nicht. Offen ist, ob es nachgezogen werden soll oder ob der Wortvergleich reicht.
3. **Backup auf WebDAV (§9)** ist keinem Meilenstein zugeordnet und noch nicht gebaut. Vorschlag: mit M4 (Betrieb).
4. **Branding durch Dritte (§12a)** ist keinem Meilenstein zugeordnet und noch nicht gebaut. Es gibt keinen Ordner `branding/` und keine Einstellungen je Gerät. Die Quellen-Adapter sind schon austauschbar.
5. **Testzeitpunkte (§13):** Die Spec sieht einen Gerätetest nach M2 vor. Weil M2 und M3 ohne Gerät gebaut wurden, deckt der nächste Test M1–M3 ab. Rückmeldungen gehen laut Spec als Issues ins Repo.

## Was der Betreuer als Nächstes tun kann

1. **Ausprobieren:** auf dem PC oder Pi `npm install`, `.env` anlegen, `npm run dev` (README „Starten“). Am Tablet `http://<IP>:5173` öffnen.
2. **OpenRouter-Schlüssel** in `.env` als `OPENROUTER_API_KEY` eintragen und einige Karten lesen. Dabei auf Ton, Länge und Schlagworte achten (Technik → Interessen).
3. **Quellen live prüfen.** Aus der Entwicklungsumgebung waren tagesschau, BR24 und OpenRouter gesperrt. Kommen Artikel beider Quellen an, und sind die Texte sauber? Wie lautet die Feed-Adresse für Franken (`BR24_FEED_URL`)?
4. **Test mit der Leserin am Gerät:** Einführung, Einstellungen, Blättern, Lesen, Funkelstern. Die Beobachtungen in die offenen Fragen der Aufträge eintragen.
5. **Pi einrichten:** `sudo ./deploy/install.sh --from-source`, bis es ein Release gibt.
6. **Repo-Einstellungen:** „Secret scanning“ und „Push protection“ einschalten.

## Offene Fragen im Überblick

Die vollständigen Fragen stehen jeweils unter „Offene Fragen“ im Auftrag. Am wichtigsten:

- **Erst am Gerät zu klären:**
  - wie viele Karten auf eine Übersichtsseite passen (meist nur eine bei 30 px);
  - Wortlaut und Ablauf der Einführung;
  - wo die Taste „Einstellungen“ sitzt;
  - ob die Einführung nach einer Pause von selbst wiederkommen soll;
  - was am Ende des letzten Artikels steht;
  - ob die Quellenangabe auf den Karten erwünscht ist;
  - Wake Lock ohne HTTPS.
- **Inhalt:**
  - eine oder zwei Ausgaben pro Tag;
  - Zugang zur tagesschau in Einfacher Sprache;
  - die Gewichtung beim Lernen der Interessen (ADR 009).
- **Rechtliches** (vor M7): Artikeltexte gehen an OpenRouter und an das gewählte Modell.

Ideen für später stehen in [`ideen.md`](ideen.md).
