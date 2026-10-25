# 021 – Bilder im Artikel

**Status:** angenommen · **Datum:** 25.10.2026 · **Bezug:** Auftrag 007, SPEC §4, §5.2; CLAUDE.md (keine externen Requests aus der Web-App)

## Kontext

Der Betreuer wünscht die Bilder der Quelle im Artikel. Rückfragen am 25.10.2026 ergaben:
- **Nur im Artikel,** an der Stelle wie in der Quelle; die Übersicht bleibt bei Text.
- **Ohne Bildunterschrift.**
- **So breit wie die Textspalte.**

Bisher entfernte die Bereinigung alle Bilder (SPEC §5.2).

## Entscheidung

- **Erkennen:**
  - BR24 und andere Feeds: `<img>` im bereinigten Artikel-HTML. Aus `srcset` wird die größte Variante bis 1600 px genommen, relative Adressen werden aufgelöst.
  - tagesschau: Aufmacherbild (`teaserImage`) und Bilder aus `image_gallery`, jeweils die Querformat-Variante bis 1280 px.
  - Entfallen: Bildunterschriften (`figcaption`, Bildnachweise), SVG, eingebettete Daten, Bilder unter 200 px (Symbole, Logos, Zählpixel). Höchstens 6 Bilder je Artikel.
- **Herunterladen** beim Abholen durch den Worker, mit denselben Schutzregeln wie für Texte (nur öffentliche Ziele, Weiterleitungen geprüft, ADR 011), höchstens 3 MB je Bild. Format und Maße liest der Pi aus den ersten Bytes (JPEG, PNG, WebP, GIF). Abgelegt wird unter `<Datenverzeichnis>/media/<SHA-1>.<endung>`.
- **Ausliefern** durch die API unter `/media/<name>`. Erlaubt sind nur Namen aus Prüfsumme und Endung, mit langem Cache. Im gespeicherten Artikel steht nie eine fremde Bildadresse; was sich nicht laden lässt, entfällt still, der Text bleibt.
- **Anzeige:** so breit wie die Textspalte, höchstens die halbe Bildschirmhöhe, ohne Unterschrift, keine Tippfläche. Breite und Höhe stehen im Artikel, damit die Lesestelle beim Laden nicht springt. Der Alternativtext der Quelle bleibt für Screenreader erhalten.
- **Aufräumen:** Bilder, auf die kein Artikel mehr verweist, löscht der Worker nach dem Aufräumen der Artikel (nach 7 Tagen).

## Folgen

- Speicher: grob 100–300 KB je Bild, bei 6 Bildern, rund 40 neuen Artikeln am Tag und 7 Tagen höchstens einige hundert MB.
- Rechte: Fotos haben oft eigene Rechteinhaber (z. B. Agenturen). Für die private Einzelinstallation wie die Texte vertretbar (ADR 001, 002); für White-Label (SPEC §12a) muss das jeder Betreiber klären. Im öffentlichen Repo gibt es nur selbst erzeugte Testbilder.
- Artikel, die vor dieser Änderung abgeholt wurden, bleiben ohne Bilder.
