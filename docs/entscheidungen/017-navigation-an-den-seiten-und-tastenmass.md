# 017 – Navigation an den Seiten, Tastenmaß aus dem Datenblatt

**Status:** angenommen; für den Artikel ersetzt durch ADR 018 · **Datum:** 25.10.2026 · **Bezug:** Auftrag 005, SPEC §8.1–8.3, §14; Freigabe des Betreuers („ja, A und B umsetzen“)

## Kontext

Beim ersten Test am Tab S11 (Foto vom 25.10.2026) wirkte der Bildschirm verschenkt:
- Die Tasten waren etwa 23–25 mm hoch statt der 20 mm aus der Spec, weil der Schätzwert 6,3 CSS-px/mm zu groß war.
- Die Leiste unten nahm mit dem Randabstand rund 220 px Höhe.
- Im Querformat ist die Höhe knapp, die Breite reichlich: Rechts neben dem Text, der höchstens 45 Zeichen pro Zeile hat, blieb Platz frei.

## Entscheidung

- **Tastenmaß (B):** `PX_PER_MM = 5.4` aus dem Datenblatt. Das Tab S11 hat 11 Zoll und 2560 × 1600 px, Chrome zeigt es als 1280 × 800 CSS-px; die Breite ist etwa 237 mm. Tasten bleiben bei 20 mm, Mindestgröße, Abstände und Randabstand der Spec gelten weiter.
- **Navigation an den Seiten (A):** In Übersicht, Artikel, Einstellungen und Einführung sitzen die Tasten in zwei seitlichen Spalten:
  - links oben „◂ Übersicht“ (in der Übersicht „Einstellungen“);
  - links unten „◂ Zurück“ bzw. „Überspringen“;
  - rechts unten die Seitenangabe und „Weiter ▸“.

  Text und Karten bekommen die volle Höhe. Die Spalten sind so breit wie die breiteste Taste, höchstens 22 % der Breite; Beschriftungen dürfen zweizeilig werden, nie mitten im Wort. Die Breite wird einmal je Bildschirm gemessen und ändert sich beim Blättern nicht, sonst stimmte der Seitenumbruch nicht.
- **Bei großer Schrift Leiste unten:** Seitenspalten kosten Breite. Bei großer Schrift ist die Breite der Engpass, dann ist die Leiste unten besser. Gemessen bei 1280 × 800 wurden die Seiten für drei Artikel gezählt:

  | Schrift | Seitenspalten | Leiste unten |
  |---|---|---|
  | 24 px | 8 | 8 |
  | 30 px | **9** | 11 |
  | 38 px | 16 | **14** |
  | 48 px | 31 | **26** |
  | 60 px | 50 | **40** |
  | 76 px | 85 | **64** |
  | 96 px | 124 | **109** |

  Regel (`chooseNav`): Seitenspalten, wenn in der Mitte noch mindestens 80 % der Höchstzeilenlänge Platz haben. Bei 1280 × 800 heißt das: bis 30 px Seitenspalten, ab 38 px Leiste unten. „◂ Übersicht“ bleibt in beiden Fällen links oben.
- **Randabstand:** Bereiche mit Tippzielen (Karten, Tasten in Einstellungen und Einführung) halten unten bzw. rechts 15 mm Abstand zum Rand. Lesetext darf näher heran, er ist kein Tippziel.

## Folgen

- Bei normaler Schrift (≤ 30 px) zeigt eine Seite mehr Text, und die Karten der Übersicht zeigen die ganze Kurzfassung.
- Je nach Schriftgröße sitzen „Zurück“ und „Weiter“ an zwei verschiedenen Stellen. Für die Leserin bleibt es eine Stelle, solange sie ihre Schrift nicht über die Grenze hinweg ändert. Ob sie beides gleich gut findet, klärt der Test am Gerät.
- SPEC §8.1–8.3 und §14 sind entsprechend angepasst.
