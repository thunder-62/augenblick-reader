# Auftrag 008 – Augenblick für Firefox: Taste „Lesen“ und Leseansicht (F1)

**Status:** erledigt
**Bezug:** SPEC §16 (vor allem 16.1–16.4, 16.7–16.10), §8.1, §8.3 mit ADR 018, §7, §11, §12; ADR 021, ADR 022

## Ziel

Eine Firefox-Erweiterung, die auf lesbaren Seiten eine große Taste „Lesen“ einblendet. Ein Tipp öffnet die Augenblick-Leseansicht über der Seite; „◂ Zur Seite“ oder die Zurück-Geste schließen sie wieder. Noch **mit festen Standardwerten** (Schrift, Farben aus `DEFAULT_SETTINGS`), ohne Einstellungen, Einführung und Vorlesen.

## Umfang

1. **Gemeinsame Bausteine herauslösen** (ohne Verhaltensänderung für die Pi-Web-App):
   - Bereinigung (HTML → `Block[]`, heute `server/src/core/clean.ts`) und Satztrennung (`server/src/core/sentences.ts`) nach `shared`, mit einer DOM-Schnittstelle, die im Browser und mit linkedom läuft.
   - Die Artikeldarstellung der Web-App (Fließtext, runder Knopf, Bilder, Schrift-/Farb-Variablen aus `settings.ts`, Tipp-Logik aus `tap.ts`, `dom.ts`, Styles) als gemeinsamer Lese-Baustein, den Web-App und Erweiterung nutzen. Wie genau (eigener Workspace, Unterordner in `web/` o. Ä.), als ADR festhalten.
   - Alle bestehenden Unit- und E2E-Tests der Web-App bleiben grün.
2. **Workspace `extension/`:** Manifest V3, `browser_specific_settings.gecko.id` (z. B. `augenblick@thunder-62.github.io`), Mindestversion Firefox für Android angeben. Berechtigungen nur nach §16.7. `action` mit Klick → Leseansicht (Ersatzweg über das Menü). Build-Skript, `web-ext lint` in CI.
3. **Inhaltsskript und Taste** nach §16.2: nur bei `isProbablyReaderable` und ohne Passwortfeld; geschlossenes Shadow DOM; 20 mm, Symbol + Wort, rechts unten; Tipp-Logik nach §8.1. Reagiert auch auf Seiten, die Inhalte nachladen (z. B. erneut prüfen, wenn sich die Seite ändert, gedrosselt).
4. **Textgewinnung** nach §16.3: Readability auf Kopie des Dokuments, danach gemeinsame Bereinigung und Satztrennung, Bilder nach ADR 021 (aus der Seite, keine eigenen Abrufe). Fehlerfall mit ruhigem Hinweis.
5. **Leseansicht** nach §16.4: Vollbild-iframe (Erweiterungsseite) über der Seite; Artikel per Nachricht übergeben; Darstellung mit dem gemeinsamen Lese-Baustein; runder Knopf „◂ Zur Seite“ oben links; Zurück-Geste schließt (History-Eintrag beim Öffnen, beim Schließen wieder entfernt); Seite darunter behält ihre Scrollposition; Wake Lock solange offen; Darstellung nur über DOM-Bau, nie `innerHTML`.
6. **Texte** aus `shared/locales/de.json` (Abschnitt `extension`).
7. **Tests:**
   - Unit: Extraktion und Bereinigung mit mindestens 5 **selbst geschriebenen** Testseiten (Nachrichtenartikel mit Zwischenüberschriften und Bildern, Seite mit Cookie-Banner und Teilen-Knöpfen, Startseite/Übersicht ohne Artikel → keine Taste, Login-Seite mit Passwortfeld → keine Taste, Seite mit nachgeladenem Artikel).
   - Playwright mit Testseiten: Taste erscheint bzw. nicht, Tipp öffnet die Leseansicht, Knopf und Zurück schließen, Scrollposition der Seite bleibt; §14-Prüfungen der Leseansicht bei allen Schriftstufen. Wenn Playwright die Erweiterung in Firefox nicht laden kann: Inhaltsskript und Leseansicht als Testseiten direkt einbinden und das in einer ADR begründen.
8. **Doku:** `extension/README.md` mit Schritt-für-Schritt-Anleitung für den Betreuer:
   - Entwicklung am Tablet per USB (`web-ext run --target=firefox-android`, adb, USB-Debugging einschalten);
   - unlisted signieren (`web-ext sign --channel=unlisted`, AMO-Schlüssel nur lokal oder als GitHub-Secret) und am Tablet über „Erweiterung aus Datei installieren“ (Über Firefox → 5× aufs Logo) installieren.
   - README im Repo-Wurzelverzeichnis und `CLAUDE.md` (Abschnitt Technik: Workspaces) anpassen; `docs/stand-und-absprachen.md` ergänzen.

## Nicht in diesem Auftrag

Einstellungen, Einführung, Position der Taste (F2), Vorlesen (F3), Veröffentlichung auf AMO (F4), eigene Browser-App. Keine Änderungen an Server-Funktionen außer dem Herauslösen der gemeinsamen Bausteine.

## Abnahme

1. `npm run lint && npm test && npm run test:e2e` grün, `web-ext lint` ohne Fehler.
2. Erweiterung lässt sich bauen und in Firefox (Desktop) temporär laden; auf den Testseiten erscheint die Taste nur, wo sie soll.
3. Tipp auf „Lesen“ zeigt Titel, sauberen Fließtext und Bilder in Augenblick-Gestaltung; Knopf und Zurück-Geste führen zur Seite an derselben Stelle zurück.
4. Keine eigenen Netzabrufe der Erweiterung (im Test nachgewiesen, z. B. durch Abfangen aller Anfragen aus Erweiterungsseiten).
5. Pi-Web-App unverändert lauffähig; ihre Tests grün.
6. Anleitung in `extension/README.md` vollständig. Danach **anhalten**: Der Betreuer installiert F1 am Tablet und testet mit der Nutzerin auf ihren Seiten (u. a. nn.de, br24.de, tagesschau.de).

## Offene Fragen

1. **Echter Firefox fehlt in der Entwicklungsumgebung.** Die Download-Server von Mozilla waren gesperrt. Gebaut und mit `web-ext lint` geprüft ist die Erweiterung. Die Tests liefen in Chromium mit dem echten Inhaltsskript (ADR 024). Abnahme 2, also „in Firefox (Desktop) temporär laden“, muss deshalb der Betreuer prüfen (`extension/README.md`, Schritt 2). Firefox-Eigenheiten wie Inhaltsskripte, die Objekte der Seite über „Xray“ sehen, oder Nachrichten zwischen Seite und iframe sind nur dort sichtbar.
2. **Berechtigung am Gerät:** Bei Manifest V3 kann Firefox den Zugriff auf alle Websites bei der Installation abgeschaltet lassen. Dann erscheint keine Taste. Bitte nach der Installation prüfen (README, Schritt 4.6). Ist er abgeschaltet: Soll die Erweiterung beim ersten Start selbst darum bitten (das wäre ein zusätzlicher Bildschirm)?
3. **Mindestversion Firefox 142** (wegen der Angabe „keine Datensammlung“, die addons.mozilla.org verlangt). Ist Firefox am Tablet aktuell?
4. **Bilder hinter dem Abo:** Die Leseansicht zeigt nur Bilder, die die Seite schon geladen hat, mit derselben Adresse. Kommen sie nicht aus dem Zwischenspeicher, kann ein Abo-Bild fehlen (ADR 024). Am Gerät mit nn.de prüfen.
5. **Schrift der Taste:** Atkinson lässt sich im geschlossenen Shadow DOM nicht zuverlässig laden. Die Taste nutzt deshalb Verdana bzw. die Systemschrift. Die Leseansicht hat Atkinson. Reicht das?
6. **Taste beim Heranzoomen:** Zoomt die Nutzerin mit zwei Fingern in die Seite, kann die Taste aus dem Bild wandern, bis sie wieder herauszoomt. Kommt das vor?
7. **Zurück-Geste auf Seiten, die selbst den Verlauf nutzen** (Single-Page-Apps): Die Leseansicht legt einen eigenen Eintrag an und behält den Zustand der Seite darin. Auf den Seiten der Nutzerin prüfen, ob „Zurück“ immer nur die Leseansicht schließt.
8. **Kopfzeile der Leseansicht:** Über dem Titel steht der Name der Website (aus der Seite, sonst die Adresse, z. B. „www.nn.de“). Am Ende steht „Ende des Artikels“. Passt das, oder soll dort „Zur Seite“ als zweite Taste stehen?
9. **Erkennung auf ihren Seiten:** Ob Readability Artikel auf nn.de, br24.de und tagesschau.de sauber erkennt (Rubrikseiten ohne Taste, Artikel mit Taste), zeigt erst der Test am Gerät.
10. **Entwicklungswerkzeug:** `web-ext` zieht ein Paket mit bekannter Sicherheitswarnung mit (`node-forge`, `npm audit`). Das betrifft nur den Entwicklungsrechner, nicht die Erweiterung. Beobachten und aktualisieren, sobald web-ext es ersetzt.

## Abschlussbericht

**Gebaut:**

- **Gemeinsame Bausteine** (ADR 023):
  - Bereinigung, Satztrennung und Wortzählung liegen jetzt in `shared/src/text/` (`@augenblick/shared/text`). Sie arbeiten auf einem DOM-Element, mit linkedom auf dem Pi und mit dem Browser-DOM in der Erweiterung. Der Server ruft sie unverändert über `htmlToBlocks` auf.
  - Die Leseansicht (Fließtext, runder Knopf, Bilder) und ihre Styles liegen in `web/src/reader/` (`@augenblick/web/reader`). Die Web-App nutzt sie für den Artikel; ihr Verhalten ist gleich geblieben.
- **Workspace `extension/`:**
  - Manifest V3, ID `augenblick@thunder-62.github.io`, Mindestversion Firefox 142 (Desktop und Android).
  - Keine Berechtigung außer dem Inhaltsskript auf `http`/`https`-Seiten.
  - `action` als Ersatzweg über das Menü.
  - Build mit esbuild (`npm run build -w extension`); `web-ext lint` läuft in der CI.
- **Taste „Lesen“:**
  - im geschlossenen Shadow DOM, unten rechts, 20 mm, Buch-Symbol und Wort, über allem;
  - nur bei `isProbablyReaderable` und ohne Passwortfeld;
  - Tipp-Logik der Web-App;
  - prüft nachladende Seiten gedrosselt erneut;
  - gleicht den Zoom herausgezoomter Seiten aus.
- **Textgewinnung:**
  - Readability auf einer Kopie, dann die gemeinsame Bereinigung;
  - Titel ohne Namen der Website;
  - Bilder nur, wie die Seite sie geladen hat (ADR 024);
  - ohne Artikel der Hinweis „Diese Seite lässt sich leider nicht als Text anzeigen.“
- **Leseansicht:**
  - Erweiterungsseite im Vollbild-iframe, Artikel per Nachricht mit Kennwort;
  - runder Knopf „Zur Seite“; die Zurück-Geste schließt (eigener Verlaufseintrag);
  - die Seite behält ihre Scrollposition;
  - Wake Lock solange offen;
  - nur DOM-Bau, kein `innerHTML`.
- **Texte** im Abschnitt `extension` von `shared/locales/de.json`. Auch Name und Beschreibung im Manifest kommen von dort.
- **Doku:**
  - `extension/README.md` mit Anleitung für PC, USB am Tablet, Signieren und Installation;
  - README, CLAUDE.md, Stand und Absprachen angepasst;
  - ADR 023 und 024.

**Getestet** (alles in der Entwicklungsumgebung):

- `npm run lint` und 178 Unit-Tests grün, davon 8 neue für die Erweiterung mit 5 selbst geschriebenen Testseiten:
  - Artikel mit Zwischenüberschriften und Bildern;
  - Cookie-Banner und Teilen-Knöpfe;
  - Startseite ohne Artikel;
  - Anmeldeseite mit Passwortfeld;
  - nachgeladener Artikel.
- `npm run test:e2e`: 61 Tests der Web-App und 18 der Erweiterung grün. Geprüft werden:
  - Taste erscheint bzw. erscheint nicht, auch über dem Cookie-Banner;
  - Tipp öffnet die Leseansicht mit Titel, Text und Bildern;
  - „Zur Seite“ und Zurück schließen, Scrollposition bleibt;
  - Ersatzweg über das Menü;
  - die Seite kann keinen Text unterschieben;
  - keine eigenen Netzabrufe (alle Anfragen abgefangen);
  - §14-Prüfungen bei allen 7 Schriftstufen.
- `web-ext lint`: 0 Fehler, 2 Warnungen (`innerHTML` in Readability auf der inerten Kopie, ADR 024).
- Das Release-Paket für den Pi baut und startet weiter ohne Entwicklungsabhängigkeiten.

**Offen:**

- In echtem Firefox ist die Erweiterung noch nicht gelaufen, weder am PC noch am Tablet (offene Frage 1).
- Der Gerätetest mit der Nutzerin steht aus.
- Einstellungen, Einführung und die Position der Taste folgen in F2.

**Angehalten:** Der Betreuer installiert F1 am Tablet (`extension/README.md`) und testet mit der Nutzerin auf ihren Seiten.
