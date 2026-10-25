# 007 – Einstellungen der Leserin, Einführung und Technik-Bereich

**Status:** angenommen (M2, nach geänderter SPEC) · **Datum:** 24.10.2026

## Kontext

Die SPEC wurde geändert (§1, §8.7, §8.8, §9, §10): Die Leserin ändert ihre Leseeinstellungen selbst – Autonomie vor Schutz, Schutz vor Versehen durch eine Rückfrage statt durch einen PIN. Eine Einführung führt sie durch Einstellen und Üben. Der Betreuer bekommt einen Technik-Bereich ohne PIN. Ein zuerst gebauter Admin-Bereich mit PIN und Kalibrierung durch den Betreuer wurde deshalb ersetzt.

## Entscheidung

- **Taste „Einstellungen“** (Zahnrad + Wort) in der Leiste der Übersicht, zwischen „Zurück“ und der Seitenangabe. Mit drei Karten, „Zurück“ und „Weiter“ sind das genau 6 Tippziele.
- **Menü** als Karten wie in der Übersicht, blätterbar: Schrift einstellen, Farben, Zeilenabstand, Was ich gern lese, Einführung noch einmal bzw. fortsetzen, Wie am Anfang, Was bedeutet dieses Zeichen (✦).
- **Jede Einstellungsseite** zeigt eine Vorschau mit echtem Text (Sätze des ersten Artikels der Ausgabe) in den gewählten Werten – nur der Vorschaukasten ändert sich, nicht die Tasten. „Speichern“ bzw. „Das ist angenehm“ führt zur ganzseitigen **Rückfrage** „Soll das ab jetzt immer so bleiben?“ mit „Ja, so lassen“ / „Nein, wie vorher“. Nur „Ja“ speichert. „◂ Übersicht“ und „Nein“ lassen alles, wie es war.
- **Schrift einstellen** folgt §8.4: beginnt bei 18 pt, Stufen von ca. +26 %. Der Schalter „Eine Stufe größer“ sitzt auf der Rückfrage-Seite – dort sieht man die größere Stufe sofort in der Vorschau; außerdem passt die Seite so auch bei großer Schrift ohne Überlauf.
- **Wie am Anfang** holt die Lese-Werte der letzten Kalibrierung (aus der Einführung oder „Schrift einstellen“) zurück, sonst die Anfangswerte – ebenfalls mit Rückfrage.
- **Server:** Die Leserin darf nur Lese-Werte und ihr Einverständnis ändern (`USER_KEYS`), keine Technik (Quellen, Rubriken, Anrede). Jede gespeicherte Fassung landet mit Zeitpunkt und Herkunft (`nutzerin`, `einfuehrung`, `kalibrierung`, `wie-am-anfang`, `technik`) in `settings_history`.
- **Einführung** (§8.8): beim ersten Start automatisch; danach nie erzwungen. Fortschritt liegt auf dem Pi (`intro:<gerät>`), wer sie verlässt, findet in den Einstellungen „Einführung fortsetzen“ an derselben Stelle. Schritte: Willkommen, Schrift, Farben (nacheinander, „Andere Farben zeigen“ / „So lese ich besser“), Blättern üben (zwei Übungsseiten), Artikel öffnen und zurück (Übungs-Übersicht mit zwei Karten), Fertig (Einverständnis, gewählte Werte, Rückfrage). Der Schritt Vorlesen kommt mit M5; bis dahin sind es 6 Schritte. Übungstexte sind eigene, freundliche Texte.
- **Anrede** Sie/du: Texte mit Anrede stehen in der Locale als `{ "sie": …, "du": … }`, der Übersetzer wählt die Variante. Gewählt wird sie beim Einrichten im Technik-Bereich.
- **Technik-Bereich** `/technik`: ohne PIN, aber nur aus Heimnetz, Tailscale und vom Pi selbst (`AUGENBLICK_TECHNIK_NETWORKS`, Standard: private IPv4-Netze, 100.64.0.0/10, lokale IPv6-Adressen). Auf dem Tablet nicht verlinkt. Inhalt: Status, Leseeinstellungen ansehen (mit Vorschau), Verlauf und Zurücksetzen auf eine frühere Fassung, BR24-Feed und Rubriken-Mix, Interessen (nur Gewichte), Anrede, Einführung neu starten, Spickzettel.
- Bestätigungsdialoge (`confirm`) gibt es nur im Technik-Bereich (Betreuer), nie in der Oberfläche der Leserin.

## Folgen

- Das Nutzungsprotokoll aus der ersten M2-Fassung ist entfernt (Migration 4 löscht die Tabelle); an seine Stelle tritt das Interessen-Lernen (ADR 009).
- Die Netzprüfung schützt nur davor, dass der Technik-Bereich versehentlich aus dem Internet erreichbar wird. Wer im Heimnetz ist, kann ihn öffnen – so will es die SPEC.
