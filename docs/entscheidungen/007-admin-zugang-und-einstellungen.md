# 007 – Admin-Bereich: Zugang, Einstellungen, Kalibrierung

**Status:** angenommen (M2) · **Datum:** 24.10.2026

## Kontext

SPEC §9/§10: Der Admin-Bereich ist nur über Tailscale erreichbar **und** zusätzlich PIN-geschützt. Alle Einstellungen macht der Betreuer; das Tablet lädt sie beim Start und alle 15 Minuten. Die Kalibrierung (§8.4) läuft auf dem Tablet. Später sollen mehrere Geräte pro Server möglich sein (§12a).

## Entscheidung

- **Netz:** Der Server prüft die Absenderadresse jeder Anfrage an `/admin` und `/api/admin/*`. Standard sind Loopback und die Tailscale-Bereiche `100.64.0.0/10` und `fd7a:115c:a1e0::/48`; änderbar über `AUGENBLICK_ADMIN_NETWORKS`. Aus dem Heimnetz (z. B. `192.168.…`) ist der Admin-Bereich gesperrt, auch mit PIN. Das Tablet muss für die Kalibrierung also im Tailnet sein (so sieht es SPEC §9 ohnehin vor).
- **PIN** aus `AUGENBLICK_ADMIN_PIN` (4–12 Ziffern). Ohne gültige PIN bleibt der Admin-Bereich zu. Nach 5 falschen Eingaben in 15 Minuten ist die Anmeldung 15 Minuten gesperrt. Vergleich in konstanter Zeit.
- **Sitzung:** HMAC-signiertes Cookie (30 Tage, `HttpOnly`, `SameSite=Strict`, mit HTTPS ab M4 zusätzlich `Secure`). Der Schlüssel wird beim ersten Start zufällig erzeugt und in der Datenbank abgelegt. `SameSite=Strict` und JSON-Anfragen schützen vor CSRF.
- **Einstellungen** liegen in der Tabelle `settings` mit Spalte `device` (heute nur `standard`), damit später Einstellungen pro Gerät möglich sind. `.env` liefert nur die Anfangswerte. Der Server begrenzt jede Eingabe auf erlaubte Bereiche (`sanitizeSettings` in `shared`, z. B. Schrift ≥ 18 pt, Buchstabenabstand ≤ 0,05 em [R1]–[R5]).
- **Quellen:** Die BR24-Feed-Adresse ist im Admin-Bereich änderbar (Tabelle `config`), der Rubriken-Mix ist Teil der Einstellungen. Der Worker liest beides bei jedem Lauf neu.
- **Kalibrierung:** Stufen 24, 30, 38, 48, 60, 76, 96 px (18 pt × 1,26ⁿ). Begonnen wird immer bei 18 pt, nicht bei der aktuellen Größe, damit die erste flüssig lesbare Stufe gefunden wird [R1]. Optional „eine Stufe größer speichern“. Das Schema wird mit demselben Absatz hell und dunkel gezeigt, optional mit Stoppuhr. Danach Vorschau einer echten Artikelseite in der Lese-App selbst (Vorschau-Modus), dann Speichern.
- **Live-Vorschau:** Die Lese-App läuft im Admin-Bereich in einem `iframe` mit `?vorschau=…`. Änderungen gehen per `postMessage` hinein. Im Vorschau-Modus speichert die App keinen Lesezustand und protokolliert nichts.
- **Wirksam auf dem Tablet:** Die Lese-App lädt die Einstellungen beim Start, alle 15 Minuten **und** sobald sie wieder in den Vordergrund kommt (z. B. nach der Kalibrierung in Chrome).
- **Nutzungsprotokoll:** Je gelesenem Artikel meldet das Tablet höchste Seite, Seitenzahl und sichtbare Lesezeit (unter 3 Sekunden zählt nicht, über 2 Stunden wird gekappt). Nur auf dem Pi gespeichert, im Admin-Bereich abschaltbar und löschbar, nach 180 Tagen automatisch gelöscht. „Vorlesen benutzt“ kommt mit M5.
- Bestätigungsdialoge (`confirm`) sind im Admin-Bereich erlaubt; die Regel „keine Dialoge“ gilt für die Oberfläche der Nutzerin.

## Folgen

- In der Entwicklung leitet Vite `/api` weiter; der Server sieht dann `127.0.0.1` und erlaubt den Zugriff. Im Betrieb gibt es diesen Umweg nicht.
- Die Vorschau im Admin-Bereich ist auf 1280×800 skaliert; die Kalibrierungsvorschau nutzt die tatsächliche Bildschirmfläche minus der Bedienleisten. Maßgeblich bleibt die Lese-App auf dem Tablet.
