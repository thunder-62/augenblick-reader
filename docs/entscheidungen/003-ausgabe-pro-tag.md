# 003 – Eine Ausgabe pro Tag, die sich nicht umsortiert

**Status:** angenommen (M1) · **Datum:** 24.10.2026

## Kontext

SPEC §5.2 verlangt „maximal 12 Artikel pro Tag in der Übersicht“ und dass die letzte Ausgabe sichtbar bleibt, wenn nichts Neues kommt. Offen ist, wie sich die Übersicht verhält, wenn der Worker tagsüber alle 30 Minuten neue Artikel findet: Würde die Auswahl jedes Mal neu berechnet, wanderten Karten zwischen den Seiten – genau die Art Überraschung, die die Nutzerin verunsichert [R24].

## Entscheidung

- Es gibt **eine Ausgabe je Kalendertag** (Berliner Zeit), gespeichert als geordnete Liste von Artikel-IDs.
- Was einmal in der Ausgabe des Tages steht, **bleibt drin und behält seinen Platz**. Neue Artikel füllen nur freie Plätze und werden hinten angehängt.
- Die erste Befüllung (meist die Morgenausgabe bis 6:30) sortiert nach Rubriken-Mix (Reihenfolge der Rubriken in `sections`), innerhalb der Rubrik neueste zuerst. Quoten werden zuerst erfüllt, freie Plätze danach mit den neuesten übrigen Artikeln gefüllt.
- Kandidaten sind fertige Artikel der letzten 24 Stunden. Dubletten – untereinander und gegenüber bereits gewählten Artikeln – werden zusammengefasst; behalten wird die Fassung mit mehr Text.
- Gibt es an einem neuen Tag noch keine Artikel, bleibt die Ausgabe des Vortags sichtbar. Artikel der neuesten Ausgabe werden beim Aufräumen nie gelöscht, auch wenn sie älter als 7 Tage sind.

## Folgen

- Sind morgens schon 12 Artikel da, kommen tagsüber keine neuen Meldungen hinzu. Das entspricht einer gedruckten Zeitung. Ob die Nutzerin lieber eine zweite Ausgabe am Nachmittag hätte, klärt der Test am Gerät (Auftrag 001, Offene Fragen).
- Die Dublettenerkennung ist vorerst wortbasiert (bedeutungstragende Wörter aus Titel und erstem Satz). In M3 kann die KI das verbessern (SPEC §6).
