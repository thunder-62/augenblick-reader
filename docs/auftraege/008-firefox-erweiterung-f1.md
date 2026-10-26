# Auftrag 008 – Augenblick für Firefox: Taste „Lesen“ und Leseansicht (F1)

**Status:** offen
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

_(vom Agenten zu ergänzen)_

## Abschlussbericht

_(vom Agenten zu ergänzen)_
