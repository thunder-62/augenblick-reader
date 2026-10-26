# 024 – Augenblick für Firefox (F1): Technik, Bilder, Sicherheit, Tests

**Status:** angenommen · **Datum:** 26.10.2026 · **Bezug:** Auftrag 008, SPEC §16; ADR 021, 022, 023

## Kontext

SPEC §16 legt fest, was die Erweiterung tut. Offen blieben: womit gebaut wird, wie Inhaltsskript und Leseansicht sicher Daten austauschen, wie Bilder ohne eigene Netzabrufe in die Leseansicht kommen und wie getestet wird, wenn Playwright die Erweiterung nicht in Firefox laden kann.

## Entscheidung

- **Build mit esbuild** statt Vite (SPEC §16.9: „oder gleichwertig“). Ein Inhaltsskript muss eine einzelne klassische Skriptdatei sein; esbuild baut Inhaltsskript, Hintergrund und Leseansicht in einem Durchgang (`extension/build.mjs`) und liegt schon im Repo. Namen und Beschreibung im Manifest kommen aus `shared/locales/de.json`.
- **Manifest V3,** ID `augenblick@thunder-62.github.io`. Mindestversion **Firefox 142** (Desktop und Android): Ab dieser Version kennt Firefox die Angabe `data_collection_permissions`, die addons.mozilla.org verlangt („keine Daten“). Inhaltsskript auf allen `http`- und `https`-Seiten, sonst **keine Berechtigung**. `storage` kommt erst mit den Einstellungen (F2).
- **Taste** im geschlossenen Shadow DOM mit höchstem z-index. Auf herausgezoomten Seiten (am Handy ohne viewport-Angabe) werden ihre Maße durch den Zoom geteilt, damit sie 20 mm groß bleibt. Schrift: Atkinson, falls die Seite sie hat, sonst Verdana. Eine eigene Schrift lässt sich im Shadow DOM nicht zuverlässig laden.
- **Leseansicht** als Erweiterungsseite (`reader.html`) in einem Vollbild-iframe, ebenfalls im geschlossenen Shadow DOM.
  - Das Inhaltsskript schickt den Artikel per `postMessage`, nur an die Herkunft der Erweiterung. Die Nachricht trägt ein zufälliges Kennwort, das nur in der Adresse des iframes steht. Die Seite kann es nicht lesen und der Leseansicht deshalb keinen Text unterschieben.
  - Die Leseansicht meldet „bereit“ und „schließen“ ohne Geheimnis. Das Inhaltsskript prüft Absender-Fenster und Herkunft, und die kann die Seite nicht fälschen.
- **Zurück-Geste:** Beim Öffnen kommt ein Eintrag in den Verlauf. `popstate` schließt die Ansicht, und „Zur Seite“ nimmt den Eintrag mit `history.back()` wieder heraus. Der bisherige Zustand der Seite bleibt im Eintrag erhalten, damit Router von Single-Page-Apps nicht durcheinanderkommen.
- **Bilder ohne eigene Abrufe:** Vor Readability bekommt jedes `<img>` der Kopie genau die Adresse, die die Seite geladen hat (`currentSrc`), und seine echte Größe. Bilder, die die Seite (noch) nicht geladen hat, und solche unter 200 px entfallen.
  - Die Leseansicht zeigt dieselben Adressen; der Browser nimmt sie in der Regel aus seinem Zwischenspeicher. Andere Adressen ruft die Erweiterung nie ab.
  - Abgesehen davon gilt ADR 021: höchstens 6 Bilder, ohne Unterschrift, so breit wie der Text.
- **Readability** arbeitet auf `document.cloneNode(true)`, setzt `keepClasses: true` (damit die gemeinsame Bereinigung Teilen-Knöpfe, Bildnachweise usw. an ihren Klassen erkennt) und übernimmt die Hauptüberschrift `<h1>` als Titel, wenn der Fenstertitel sie mit dem Namen der Website enthält.
  - `web-ext lint` meldet zwei Warnungen „innerHTML“, beide in Readability selbst. Sie betreffen nur die Kopie, die keinen Browserkontext hat: Dort laufen keine Skripte, und es werden keine Bilder geladen.
  - Die Leseansicht baut alles über DOM-Aufrufe, nie über `innerHTML`.
- **Tests:**
  - Playwright kann Erweiterungen nur in Chromium laden, nicht in Firefox. Deshalb wie im Auftrag vorgesehen:
    - Ein Testserver liefert die Testseiten mit dem **echten** Inhaltsskript aus, dazu eine kleine Nachbildung von `browser.runtime` (`extension/e2e/server.mjs`).
    - Die Leseansicht kommt von einer **zweiten Herkunft**, wie bei `moz-extension://`.
    - Geprüft wird in Chromium. Für die §14-Prüfungen bei allen Schriftstufen nimmt die Leseansicht `?vorschau=<Einstellungen>` an, wie die Web-App. Das Inhaltsskript setzt diesen Parameter nie.
  - Firefox-Eigenheiten deckt dieser Test nicht ab, etwa wie Inhaltsskripte Objekte der Seite sehen („Xray“) oder Berechtigungen am Gerät. Sie prüft der Betreuer beim Laden in Firefox und am Tablet (`extension/README.md`).

## Folgen

- Zur Entwicklung kommt `web-ext` dazu. Es zieht ein Paket mit bekannter Sicherheitswarnung mit (`node-forge`, laut `npm audit`). Das betrifft nur die Werkzeuge am Entwicklungsrechner, nicht die Erweiterung und nicht den Pi.
- Bilder hinter einem Abo-Login lädt die Leseansicht als fremde Herkunft. Je nach Cookie-Regeln von Firefox kann so ein Bild fehlen, wenn es nicht im Zwischenspeicher liegt. Der Text ist davon nicht betroffen. Am Gerät prüfen.
- Unlisted signierte Fassungen aktualisieren sich nicht von selbst. Bis zur Veröffentlichung auf addons.mozilla.org (F4) installiert der Betreuer neue Fassungen von Hand.
