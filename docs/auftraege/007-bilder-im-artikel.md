# Auftrag 007 – Bilder im Artikel

**Status:** erledigt
**Bezug:** SPEC §4, §5.2; ADR 021
**Auftraggeber:** Betreuer im Chat am 25.10.2026 („wenn es Bilder in der Quelle gibt, sollten die bitte noch mit rein“; Rückfragen: nur im Artikel, ohne Unterschrift, so breit wie der Text)

## Offene Fragen

1. Hilft ein Bild der Leserin, oder lenkt es eher ab? Das zeigt der Test am Gerät.
2. Bilder ohne Unterschrift: Weiß sie trotzdem, was ein Bild zeigt? Der Alternativtext ist da, aber nur für Screenreader sichtbar.

## Abschlussbericht

**Gebaut**

- Neuer Blocktyp `image`.
- Erkennung in BR24/RSS-HTML (`srcset`, relative Adressen) und bei der tagesschau (Aufmacher, Galerie).
- Download mit SSRF-Schutz und 3-MB-Grenze, Format und Maße aus den Dateiköpfen, Ablage unter `media/`, Auslieferung unter `/media/<name>`, Aufräumen ungenutzter Bilder.
- Anzeige im Fließtext so breit wie die Spalte, höchstens halbe Bildschirmhöhe.
- SPEC §4, §5.2 angepasst; ADR 021.

**Getestet**

- `npm run lint`, 170 Unit-Tests, 61 E2E-Tests grün. Neue Tests decken ab:
  - Erkennung an der richtigen Stelle, ohne Unterschrift;
  - `srcset`-Auswahl;
  - Ausfiltern von Symbolen, SVG und Daten-URLs, Obergrenze von 6;
  - tagesschau-Varianten und Galerie;
  - Formaterkennung;
  - Download mit fehlenden, zu kleinen, Nicht-Bild- und privaten Zielen;
  - Aufräumen;
  - Auslieferung nur gültiger Namen (auch kein `../`);
  - Anzeige mit Spaltenbreite und Höhengrenze.
- Mit echten Bildern von tagesschau und BR24 noch nicht geprüft (aus der Entwicklungsumgebung gesperrt).
