# 005 – Layout im Querformat und Maße der Tippziele

**Status:** angenommen · **Datum:** 24.10.2026 (Ergänzung zur Messung am Gerät siehe unten)

## Kontext

SPEC §8.1–8.3 verlangt Tippziele ≥ 15 mm (Ziel 20 mm), ≥ 6 mm Abstand, ≥ 15 mm zum Bildschirmrand, eine feste Leiste unten, „◂ Übersicht“ im Kopf und Fließtext mit höchstens 45 Zeichen je Zeile. Die echte CSS-Auflösung und Pixeldichte des Galaxy Tab S11 ist noch nicht gemessen. Im vorläufigen Viewport 1280×800 kostet jede Leiste mit 20-mm-Tasten und 15-mm-Randabstand rund ein Viertel der Höhe.

## Entscheidung

- **Maße** stehen als Konstanten in `shared/src/geometry.ts`. Es gilt 6,3 CSS-px/mm (aus der Recherche: 15–20 mm ≈ 95–125 CSS-px). Rechnerisch hätte das Tab S11 (11″, 2560×1600, Pixelverhältnis 2) eher ~5,4 CSS-px/mm; der höhere Wert ist die sichere Seite (Tasten werden eher größer). **Eine Messung am Gerät entfällt** (Entscheidung des Betreuers): Die Schriftgröße stellt die Leserin in der Einführung selbst ein.
- Tasten sind 20 mm hoch; alle Tippziele halten 15 mm Abstand zum Rand, Text darf näher an den Rand.
- **Artikel:** „◂ Übersicht“ sitzt oben links in einer schmalen Randspalte, der Text beginnt rechts daneben ganz oben. So steht die Taste im Kopfbereich, kostet aber keine eigene Zeile. Unten die feste Leiste „◂ Zurück · Seite x von y · Weiter ▸“.
- **Zeilenlänge:** `maxCharsPerLine` meint echte Zeichen. Die App misst die mittlere Zeichenbreite eines deutschen Mustertextes in der aktuellen Schrift (inkl. Wortabstand), statt die CSS-Einheit `ch` (Breite der Ziffer 0) zu nehmen, die rund 20 % zu lange Zeilen ergab.
- **Übersicht:** bis zu 3 Karten je Seite, so viele wie ganz passen. Passt eine Karte bei sehr großer Schrift allein nicht, wird ihre Kurzfassung auf den ersten Satz gekürzt, notfalls bleibt nur der Titel – nie wird etwas abgeschnitten.
- **Doppeltipp-Sperre** gilt zielübergreifend: Innerhalb von 300 ms nach einem ausgelösten Tipp löst kein weiterer aus, auch wenn inzwischen ein neuer Bildschirm erscheint (sonst träfe der zweite Tipp eines Doppeltipps oft eine andere Taste).
- „z. B.“, „u. a.“ usw. werden beim Anzeigen mit geschütztem Leerzeichen zusammengehalten (reine Typografie, der Text bleibt unverändert).

## Folgen

- Bei der Standardschrift (30 px) passt in 1280×800 meist **eine Karte** pro Übersichtsseite, die Übersicht hat dann bis zu 12 Seiten. Ob das für die Nutzerin gut ist oder ob Kurzfassungen kürzer bzw. enger gesetzt werden sollen, klärt der Test am Gerät (Auftrag 001, Offene Fragen).
- Die E2E-Tests prüfen die Regeln mit denselben Konstanten; ändern sich die Konstanten, prüfen die Tests automatisch mit.
