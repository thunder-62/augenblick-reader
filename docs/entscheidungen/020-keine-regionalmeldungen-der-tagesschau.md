# 020 – Keine Regionalmeldungen von der tagesschau

**Status:** angenommen · **Datum:** 25.10.2026 · **Bezug:** ADR 001, ADR 010, Rückmeldung des Betreuers

## Kontext

Beim ersten Live-Abruf auf dem Pi kamen über die tagesschau Meldungen aus Norddeutschland in die Ausgabe. Die tagesschau-Schnittstelle liefert neben bundesweiten Meldungen auch Beiträge der Landesrundfunkanstalten: die Liste `regional` und Meldungen mit `regionId` 1–16. Bisher wurden sie als Rubrik „Region“ übernommen. Für die Leserin sind sie nicht hilfreich; Regionales kommt aus den BR24-Feeds (ADR 010).

## Entscheidung

- Von der tagesschau nur noch Deutschland und Welt: Die Liste `regional` wird nicht gelesen, und Meldungen mit einer `regionId` ungleich 0 werden übersprungen.
- Die Rubrik „Region“ füllen ausschließlich die Feeds aus `AUGENBLICK_RSS_FEEDS` (Standard: BR24 Mittelfranken).

## Folgen

- Bereits abgeholte Regionalmeldungen bleiben in der heutigen Ausgabe stehen, denn die Ausgabe eines Tages ist stabil (ADR 003). Ab der nächsten Morgenausgabe sind sie weg, nach 7 Tagen auch aus der Datenbank.
- Sollte die Schnittstelle Regionales künftig anders kennzeichnen, fällt das am Pi auf. Prüfen lässt es sich an der Rubrik der Karten.
