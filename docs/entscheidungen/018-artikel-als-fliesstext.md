# 018 – Artikel als Fließtext zum Scrollen, runder Knopf zur Übersicht

**Status:** angenommen · **Datum:** 25.10.2026 · **Bezug:** Auftrag 006, SPEC §1 (Leitsatz 3), §8.3; ersetzt ADR 017 für den Artikel

## Kontext

Nach dem ersten Blick am Tablet hat der Betreuer entschieden: „Fließtext und scrolling und ein runder Knopf oben links zum zurück“. Rückfragen am 25.10.2026 ergaben:
- Gilt **nur für den Artikel**. Übersicht, Einstellungen und Einführung bleiben seitenweise.
- Der **runde Knopf** bekommt Pfeil und Wort, steht **fest** über dem Text und bleibt beim Scrollen sichtbar.
- **Nur Wischen**, keine zusätzlichen Tasten zum Weiterscrollen.

Das weicht bewusst von der Recherche ab: [R16] (nur Einzeltipps) und [R19] (blättern statt scrollen; beim Scrollen verliert man mit Makuladegeneration leicht die Zeile). Der Betreuer kennt die Leserin; der Test am Gerät soll zeigen, wie sie zurechtkommt.

## Entscheidung

- **Artikel:** Titel und Text am Stück in einem Bereich, der senkrecht gewischt wird. Nur dieser Bereich darf gewischt werden (`touch-action: pan-y`), alles andere bleibt bei Einzeltipps. Kein sichtbarer Scrollbalken. Zeilenlänge, Schrift und Abstände wie bisher.
- **Runder Knopf** oben links, fest: Kreis (20 mm) mit „◂“, darunter das Wort „Übersicht“ (Symbol + Wort, SPEC §8.1). Die Textspalte hält links Abstand, damit nie Text unter dem Knopf liegt.
- **Am Ende** „Nächster Artikel ▸“ mit Titel; ganz unten hält die Taste 15 mm Abstand zum Rand.
- **Lesestelle:** Gemerkt wird der erste Satz, dessen Anfang zu sehen ist. Beim Öffnen steht er wieder oben.
- **„Bis zum Ende gelesen“** (Interessen lernen, SPEC §5.3) gilt, wenn das Textende erreicht ist.
- Der Seitenumbruch für den Artikel entfällt. „Zurück“, „Weiter“ und die Seitenangabe gibt es im Artikel nicht mehr.

## Folgen

- Die Prüfung nach §14 erlaubt genau einen Scrollbereich, den Artikeltext. Tasten darin dürfen beim Scrollen über den Rand wandern; am Textende gilt der Randabstand.
- Die Einführung übt weiter das Blättern, das in der Übersicht gilt. Ob ein Übungsschritt zum Wischen nötig ist, zeigt der Test.
- Für das spätere Vorlesen (M5) ist Scrollen sogar einfacher: Der vorgelesene Satz wird einfach in den sichtbaren Bereich gescrollt.
- `CLAUDE.md` und SPEC §1, §8.3 sind angepasst.
