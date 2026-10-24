# 010 – Liste von RSS-Feeds statt einer BR24-Adresse

**Status:** angenommen · **Datum:** 24.10.2026

## Kontext

Bis M3 kannte der Server genau eine Feed-Adresse (`BR24_FEED_URL`), Standard war der allgemeine BR24-Feed. Der Betreuer hat inzwischen den Regional-Feed **BR24 Mittelfranken** gefunden (`https://nachrichtenfeeds.br.de/rdf/boards/UZlNk5T`); im Klick-Prototyp liefert er Titel, Anreißer und Links, der Volltext kommt von der Artikelseite.

Zwei Dinge fehlten:

1. Die BR-Regionalfeeds unter `nachrichtenfeeds.br.de/rdf/boards/…` sind **RDF-Feeds (RSS 1.0)**: Wurzel `rdf:RDF`, Einträge als `item` direkt darunter, Datum in `dc:date`, Kategorie in `dc:subject`. Der M1-Parser las nur RSS 2.0 (`rss/channel/item`) und hätte für diesen Feed **keine Artikel** geliefert.
2. Mehrere Feeds gleichzeitig (z. B. Region plus Wirtschaft) waren nicht möglich.

## Entscheidung

- **Feed-Katalog** in `shared/src/feeds.ts` (`FEED_CATALOG`): bekannte öffentliche Feeds mit Kurzname, Adresse, Quelle, Rubrik und Prüfdatum. Geprüft ist bisher nur `br24-mittelfranken`; die übrigen stammen aus Feed-Verzeichnissen und sind als „ungeprüft“ markiert.
- **Aktive Feeds** sind eine Liste aus Kurznamen und/oder eigenen Adressen, höchstens 10:
  - Umgebung: `AUGENBLICK_RSS_FEEDS=br24-mittelfranken,https://…` (Komma-getrennt).
  - Standard: `br24-mittelfranken`.
  - Abwärtskompatibel: Ist nur `BR24_FEED_URL` gesetzt, gilt diese Adresse; eine in M1–M3 im Technik-Bereich gespeicherte einzelne Adresse wird als Liste mit einem Eintrag übernommen.
  - Technik-Bereich → Quellen: Katalog zum Ankreuzen plus Textfeld für weitere Adressen. Gilt ab dem nächsten Abruf, ohne Neustart.
- **Parser** liest RSS 2.0, RDF (RSS 1.0) und Atom. Fehlt in RDF das `<link>`, gilt `rdf:about`.
- **Rubrik:** Jeder Katalog-Feed hat eine Rubrik (z. B. `region`, `wirtschaft`); Sport-Kategorien kommen weiterhin in `sport`. Eigene Adressen laufen in `nachrichten`.
- **Quellen:** Katalog-Feeds des BR laufen als Quelle `br24` (Anzeige „BR24“), eigene Adressen als Quelle `rss` (Anzeige „RSS“). Je Quelle ein Adapter; innerhalb einer Quelle stört der Ausfall eines Feeds die übrigen nicht. Erst wenn alle Feeds einer Quelle ausfallen, gilt die Quelle im Status als gestört.
- Volltext wie bisher von der Artikelseite (Readability, ADR 002).

## Folgen

- Die BR-Regionalfeeds funktionieren jetzt. Am Pi prüfen, ob die Volltext-Extraktion bei echten BR24-Seiten sauber ist.
- Weitere Regionen (Ober-/Unterfranken usw.) lassen sich ohne Code ergänzen: Adresse eintragen oder in den Katalog aufnehmen und dort nach erfolgreicher Prüfung `checked` setzen.
- Eigene Feeds anderer Anbieter unterliegen deren Nutzungsbedingungen; privater Gebrauch in der Einzelinstallation wie in ADR 001/002.
