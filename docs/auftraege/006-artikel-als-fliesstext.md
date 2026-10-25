# Auftrag 006 – Artikel als Fließtext mit rundem Knopf

**Status:** erledigt
**Bezug:** SPEC §8.3; ADR 018
**Auftraggeber:** Betreuer im Chat am 25.10.2026 („Wir machen das ganz anders. Fließtext und scrolling und ein runder Knopf oben links zum zurück“, Rückfragen beantwortet)

## Ziel

Der Artikel liest sich als zusammenhängender Text, den die Leserin mit dem Finger weiterschiebt. Zurück zur Übersicht geht es über einen runden Knopf oben links, der immer sichtbar bleibt.

## Offene Fragen

1. **Wischen:** Kommt die Leserin mit dem Wischen zurecht, oder verliert sie die Zeile? Falls ja, wären Tasten ▲/▼ am Rand eine Ergänzung (wurde für jetzt abgewählt).
2. **Einführung:** Der Schritt „Blättern üben“ übt das Blättern der Übersicht. Braucht es zusätzlich einen Schritt „Wischen üben“?
3. **Vollbild:** Im Browser-Tab kostet die Adresszeile Höhe; siehe Auftrag 005, Frage 2.

## Abschlussbericht

**Gebaut**

- Artikel als ein Scrollbereich (nur senkrecht, kein Scrollbalken).
- Runder Knopf „◂ Übersicht“ fest oben links; der Text liegt nie darunter.
- „Nächster Artikel ▸“ am Ende.
- Lesestelle (erster sichtbarer Satz) wird gemerkt und wiederhergestellt; „bis zum Ende gelesen“ fürs Interessen-Lernen.
- Seitenumbruch des Artikels entfernt (`paginate`, `pageForAnchor` samt Tests).
- SPEC §1, §8.3, `CLAUDE.md`, ADR 018.

**Getestet**

- `npm run lint`, Unit-Tests und 60 E2E-Tests grün. Neue bzw. umgeschriebene Tests prüfen:
  - Öffnen, Scrollen, Knopf bleibt fest, zurück zur Übersicht;
  - jeder Satz genau einmal im Text;
  - der Text liegt nie unter dem Knopf;
  - „Nächster Artikel“ am Ende mit 15 mm Randabstand;
  - nach dem Neuladen dieselbe Stelle;
  - die Prüfungen nach §14 in allen Schriftstufen auch nach dem Scrollen.
- Am Tablet noch nicht geprüft.
