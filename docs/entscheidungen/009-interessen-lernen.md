# 009 – Interessen lernen

**Status:** angenommen (M3) · **Datum:** 24.10.2026

## Kontext

SPEC §5.3: Themen, die die Leserin gern liest, rücken nach vorn – Lernen für sie, keine Überwachung. Signale: geöffnet, bis zum Ende gelesen, schnell wieder verlassen. Gespeichert werden nur Themen-Gewichte mit langsamem Vergessen, keine Liste gelesener Artikel. Zwei feste Plätze vorn, danach nach Interesse, mindestens 3 von 12 Plätzen für andere Themen, kein Filtern. Transparenz („Was ich gern lese“) und Einverständnis.

## Entscheidung

- **Themen** eines Artikels: die Rubrik als lesbares Wort (z. B. „Region“, „Sport“) plus die Schlagworte der KI (ADR 008). Ohne KI-Schlüssel lernt Augenblick also nur Rubriken.
- **Signal** beim Verlassen eines Artikels (Übersicht, nächster Artikel, App schließen): nur Artikel-ID, „bis zum Ende gelesen“ und sichtbare Sekunden. Der Pi nutzt die ID nur, um die Themen nachzuschlagen, und speichert sie nicht. Punkte: geöffnet +1, bis zum Ende +3 dazu, unter 20 Sekunden und nicht bis zum Ende −1. Das Tablet sendet nur mit Einverständnis; der Pi prüft es noch einmal.
- **Vergessen:** Gewichte halbieren sich alle 30 Tage (Halbwertszeit, beim Lesen und Schreiben berechnet). Gespeichert ist nur `(Thema, Gewicht, Zeitpunkt)` in `topic_weights`.
- **Auswahl und Reihenfolge** (`selectEdition` mit `InterestRanker`): Innerhalb jeder Rubrik des Rubriken-Mix kommen bevorzugte Themen zuerst (sonst das Neueste). Lieblingsthemen sind die bis zu 5 Themen mit dem höchsten positiven Gewicht; sind weniger als 3 Artikel außerhalb davon dabei, werden die schwächsten Favoriten durch andere Artikel ersetzt. Die ersten 2 Plätze des Tages bleiben redaktionell (Reihenfolge des Rubriken-Mix), danach nach Interesse. Was schon in der Ausgabe des Tages steht, behält seinen Platz (ADR 003).
- **Einverständnis** einmal in der Einführung („Ja“ / „Nein, lieber nicht“) und jederzeit unter „Was ich gern lese“. Ohne Einverständnis bleibt die Reihenfolge redaktionell. **Zieht sie es zurück, wird alles Gelernte gelöscht.**
- **Was ich gern lese:** ein Thema pro Seite, groß, mit „Das lesen Sie oft/manchmal“ bzw. „Davon lieber weniger“, Tasten „Mehr davon“ / „Weniger davon“ (je ±3 Punkte), am Ende „Speichern“, „Alles vergessen“, „Nicht mehr merken“ – alles mit Rückfrage. Der Technik-Bereich zeigt nur die Gewichte.

## Folgen

- Die Gewichtung (Punkte, Lieblingsthemen, Schrittweite) ist eine Annahme; ob sie sich gut anfühlt, zeigt der Alltag. Alle Werte stehen als Konstanten in `server/src/core/store.ts` bzw. `selection.ts`.
- Die Reihenfolge wirkt beim nächsten Zusammenstellen der Ausgabe (Worker-Lauf), nicht sofort.
