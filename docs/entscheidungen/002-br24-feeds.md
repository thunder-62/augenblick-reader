# 002 – BR24: RSS-Feed und Volltext von der Artikelseite

**Status:** angenommen (M1), Feed für Franken offen · **Datum:** 24.10.2026

## Kontext

SPEC §5.1: BR24 bietet RSS-Feeds (allgemein `https://feeds.br24.de/rss/nachrichten`, außerdem je Region/Ressort unter `nachrichtenfeeds.br.de/...`). Feeds liefern meist nur Anreißer; der Volltext muss von der Artikelseite geholt werden. Zu prüfen waren aktuelle Feed-URLs, insbesondere für Franken/Mittelfranken, und die Nutzungsbedingungen.

Aus der Entwicklungsumgebung waren br.de und br24.de nicht erreichbar (Netzwerk gesperrt). Die Websuche ergab:

- `https://feeds.br24.de/rss/nachrichten` – allgemeiner Feed (in SPEC genannt, in Feed-Verzeichnissen gelistet)
- `https://www.br.de/nachrichten/meldungen/nachrichten-bayerischer-rundfunk100~newsRss.xml` – Bayern-weite Kurzmeldungen
- `https://nachrichtenfeeds.br.de/rss/nachrichten/seiten/<id>` – seitenbezogene Feeds; eine bestätigte ID für Franken/Mittelfranken wurde **nicht** gefunden.

Zu den Nutzungsbedingungen der BR24-Feeds wurde keine eigene Regelung gefunden. Üblich ist, dass RSS-Feeds zum Abonnieren für den privaten Gebrauch gedacht sind; eine Veröffentlichung oder Weitergabe der Texte ist es nicht.

## Entscheidung

- Die Feed-URL ist Konfiguration (`BR24_FEED_URL` in `.env` bzw. `/etc/augenblick/augenblick.env`), Standard ist der allgemeine Feed. Ein Wechsel auf einen Regional-Feed braucht keinen Code.
- Der Adapter liest Titel, Link, GUID, Datum und Kategorie aus dem Feed, lädt die Artikelseite und extrahiert den Hauptinhalt mit Mozillas Readability (über `linkedom`, ohne Browser). Danach dieselbe Bereinigung wie bei allen Quellen (Bildunterschriften, Linklisten, „Mehr zum Thema“, Teilen-Knöpfe usw. entfallen).
- BR24-Meldungen erhalten die Rubrik `region`, Sport-Kategorien `sport`.
- Höchstens 20 Artikelseiten pro Lauf (einstellbar), bereits bekannte Artikel werden nicht erneut geladen. Der Abruf meldet sich mit einem eigenen User-Agent („Augenblick … privater Zeitungs-Reader“).
- Nutzung nur privat in der Einzelinstallation. Für White-Label-Betreiber gilt dasselbe wie in ADR 001.

## Folgen

- **Am Pi prüfen:** Ob der allgemeine Feed und die Extraktion mit echten BR24-Seiten saubere Texte liefern, und welche Feed-URL für Franken/Mittelfranken passt (z. B. RSS-Symbol auf der Franken-Seite von BR24 bzw. im Seitenquelltext nach „rss“ suchen). Eingetragen in Auftrag 001 unter „Offene Fragen“.
- Ändert BR24 das Seitenlayout, kann die Extraktion schlechter werden. Readability ist dafür robust; schlägt sie fehl, wird der Artikel als `failed` gespeichert und nicht gezeigt.
