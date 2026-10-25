# Auftrag 005 – Bildschirm besser nutzen

**Status:** erledigt
**Bezug:** SPEC §8.1–8.3, §14; ADR 017
**Auftraggeber:** Betreuer im Chat am 25.10.2026 nach dem ersten Test am Tablet („der screen space muss besser genutzt werden“, „ja, A und B umsetzen“)

## Ziel

Mehr Text und größere Karten auf derselben Fläche, ohne die Regeln für Tippziele zu verletzen.

## Umfang

- A: Navigation an den Seiten statt in einer Leiste unten.
- B: Umrechnung Millimeter → CSS-Pixel aus dem Datenblatt des Tab S11.

## Offene Fragen

1. Ab 38 px Schrift wechselt die Navigation wieder nach unten (ADR 017). Stört es die Leserin, wenn „Weiter“ beim Wechsel der Schriftgröße den Platz wechselt? Alternativ: eine Anordnung fest wählen, mit Nachteil bei großer Schrift.
2. Vollbild: Im Browser-Tab kosten Tab- und Adressleiste viel Höhe. Bis HTTPS (M4) hilft am Tablet `chrome://flags` → „Insecure origins treated as secure“ mit der Adresse des Pi, danach „App installieren“.
3. Der Satz wird weiterhin nie über eine Seite geteilt; dadurch bleibt am Seitenende manchmal Platz frei. Stört das die Leserin?

## Abschlussbericht

**Gebaut**

- `PX_PER_MM` von 6,3 auf 5,4: Tasten und Abstände etwa 15 % kleiner, weiterhin 20 mm am Gerät.
- Neue Anordnung für Übersicht, Artikel, Einstellungen und Einführung:
  - Seitenspalten mit gemessener, beim Blättern fester Breite (höchstens 22 %), Beschriftung bei Bedarf zweizeilig;
  - Seitenangabe rechts über „Weiter“ (bei Platzmangel Kurzform);
  - Datum und Karten in der Mitte über die volle Höhe.
- Automatische Wahl Seitenspalten/Leiste unten nach Schriftgröße (`chooseNav`), mit Messung belegt (ADR 017).
- Übungskarten der Einführung in Tastengröße.
- SPEC §8.1–8.3, §14 angepasst.

**Getestet**

- `npm run lint`, 166 Unit-Tests, 59 E2E-Tests grün, darunter alle 7 Schriftstufen mit Prüfung von Tippzielen, Randabständen, Überlappungen, Kontrast und abgeschnittenem Inhalt.
- Seitenzahlen beider Anordnungen über alle Stufen gemessen (Tabelle in ADR 017).
- Am Tablet noch nicht geprüft.
