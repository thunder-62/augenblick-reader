# Auftrag 004 – Korrekturen aus der Durchsicht M0–M3

**Status:** erledigt
**Bezug:** SPEC §5.3, §8.1–8.2, §8.7–8.8, §9, §10, §14; Durchsicht vom 24.10.2026 (Stand `dbcbe16` plus Feed-Liste aus ADR 010)

## Ziel

Die Befunde der Durchsicht beheben, **bevor** der Betreuer mit der Leserin am Gerät testet. Keine neuen Funktionen. Reihenfolge nach Priorität; jede Gruppe ist für sich commitbar.

## A – Muss vor dem Test am Gerät (hoch)

1. **Übersicht bei großer Schrift.** Ab 48 px (Kalibrierungsstufen bis 96 px) schrumpft der Kartenbereich auf 0 px, Karte und untere Leiste überlappen, „Seite 1 von 8“ bricht buchstabenweise um, Tipps auf Karten landen auf der Leiste (`web/src/app.ts` ca. 271–286, `web/src/styles.css` `.bar-overview`).
   - Kopf- und Fußleiste dürfen mit der Schrift wachsen, aber nur begrenzt (Obergrenze relativ zur Bildschirmhöhe); der Kartenbereich behält immer mindestens eine vollständige Karte.
   - Seitenangabe nie buchstabenweise umbrechen; notfalls Kurzform „2 / 8“.
   - Ist eine einzelne Karte höher als der Kartenbereich: Kurzfassung auf der Karte kürzen (Ellipse nach ganzen Sätzen), nie den Titel abschneiden.
   - Dasselbe für Artikelansicht, Einstellungen und Einführung prüfen.
   - **E2E-Tests für alle Kalibrierungsstufen** (`CALIBRATION_SIZES_PX`, mindestens 24, 48, 60, 96 px) für Übersicht, Artikel, Einstellungen und Einführung, jeweils mit den Prüfungen aus §14 (keine Überlappung, kein Scrollbalken, Tippziele ≥ Mindestgröße, ≤ 6 Ziele) und einem echten Tipp auf die erste Karte.
2. **Netzprüfung des Technik-Bereichs umgehbar.** `isTechnikUrl` prüft die rohe URL; `GET /api/%74echnik/status` von außen liefert 200 (`server/src/technik.ts` ca. 46–67).
   - Prüfung auf den **dekodierten, normalisierten** Pfad bzw. die Route (z. B. Fastify-`onRequest` mit `routeOptions.url` oder Prefix-Plugin mit eigenem Hook) umstellen, sodass jede Schreibweise erfasst wird.
   - Tests: prozentkodierte Varianten, doppelte Schrägstriche, Groß-/Kleinschreibung, angehängte Query, jeweils von einer öffentlichen Adresse → 403.
3. **SSRF über Feed- und Artikel-Adressen.** Feeds und Artikel-Links werden ohne Zielprüfung abgerufen, Weiterleitungen werden verfolgt (`server/src/core/http.ts`, Feeds aus ADR 010).
   - Vor jedem Abruf und **nach jeder Weiterleitung** (Weiterleitungen selbst verfolgen, höchstens 5) die aufgelöste IP prüfen: keine Loopback-, Link-local-, privaten (RFC 1918, ULA), CGNAT- (100.64/10) oder Multicast-Ziele, kein `localhost`.
   - Nur http/https, Standard-Ports 80/443 (Konfiguration für Ausnahmen nicht nötig).
   - Tests mit gefälschter DNS-Auflösung.
4. **Größenbegrenzung bei Abrufen.** `res.text()` liest unbegrenzt. Antworten über 5 MB abbrechen (Stream lesen und zählen), Fehler wie ein fehlgeschlagener Abruf behandeln. Test vorhanden.

## B – Einwilligung und Selbstbestimmung (mittel)

5. **Zurücksetzen im Technik-Bereich überschreibt das Einverständnis.** `restoreVersion` stellt auch `interestLearning` (und Anrede, Rubriken) wieder her (`server/src/core/store.ts` ca. 97–109). Beim Zurücksetzen durch den Betreuer bleiben `interestLearning` **immer** auf dem aktuellen Wert der Leserin; Anrede und Rubriken sind Technik und dürfen zurückgesetzt werden. Test.
6. **„Wie am Anfang“ trifft die falsche Fassung.** Auch „Schrift einstellen“ allein speichert mit Herkunft `kalibrierung` (`web/src/user-settings.ts` ca. 177, `store.ts` ca. 115–125). Herkunft unterscheiden: `kalibrierung` nur aus der Einführung bzw. wenn ausdrücklich „gemeinsam eingestellt“ gewählt wurde; Einzeländerungen der Leserin als `leserin`. „Wie am Anfang“ nimmt die letzte `kalibrierung`/`einfuehrung`. Test.
7. **„Nein, lieber nicht“ ohne Rückfrage.** Auch das Ablehnen des Interessen-Lernens läuft über den zweistufigen Bestätigungsschritt (§5.3, §8.7) (`user-settings.ts` ca. 308–313).

## C – Wirkung des Interessen-Lernens (mittel)

8. **Schlagworte entstehen zu spät.** `buildEdition` läuft vor `summarizeEdition`; neue Kandidaten haben bei der Auswahl keine KI-Themen (`worker.ts` ca. 48–60, `pipeline.ts` ca. 90–107 und 137 ff.).
   - Kurzfassung und Schlagworte für die **Kandidaten** erzeugen (Tageslimit beachten, z. B. die nach Aktualität besten 20 je Lauf), danach die Ausgabe bauen.
   - Ohne KI-Schlüssel bleibt es beim Ranking nach Rubrik.
   - Test: Ein Kandidat mit Lieblings-Schlagwort rückt in die Ausgabe vor.

## D – Kleinere Punkte (niedrig)

9. **Pi nicht erreichbar:** Beim Start ohne Server darf nicht „Dieser Artikel ist nicht mehr da“ erscheinen, sondern der ruhige Hinweis aus §9 (`web/src/app.ts` ca. 356–364).
10. **Einführung:** Fertig-Schritt bekommt ebenfalls „Überspringen“ (§8.8). Schrittzahl dynamisch (6 ohne, 7 mit Vorlesen), Texte entsprechend.
11. **Tipp-Logik:** Bewegung über 10 mm während der Berührung (nicht nur beim Loslassen) bricht den Tipp ab (`web/src/tap.ts`). Test.
12. **Datum in der Übersicht** nach Mitternacht aktualisieren (`app.ts` ca. 231).
13. **i18n:** `Intl` mit `locale` statt fest `'de-DE'` (Technik-Bereich); feste deutsche Server-Meldungen in die Locale bzw. als Fehlercodes, die der Client übersetzt.
14. **Kommentar** in `store.ts` ca. 293 („+1/−1“) an die tatsächlichen ±3 Punkte anpassen.
15. **Update-Dienst** (`deploy/systemd/augenblick-update.service`) nicht als root: eigener Benutzer mit Schreibrecht nur auf `/opt/augenblick`, Neustart der Dienste über eine eng gefasste sudoers-Regel oder `systemctl --user`-freie Lösung (z. B. Pfad-Unit). Kurz als ADR dokumentieren.
16. **Host-Header prüfen** (Schutz gegen DNS-Rebinding): nur IP-Adressen des Pi, sein Hostname, `localhost` und Tailscale-Namen (konfigurierbar) zulassen. `POST`-Endpunkte nur mit `Content-Type: application/json` annehmen (CSRF ohne Preflight verhindern).

## Nicht in diesem Auftrag

M4 (HTTPS) und alles danach. Hinweis für M4 aber schon jetzt als ADR notieren: Läuft HTTPS über einen Proxy auf localhost (`tailscale serve` o. ä.), muss die Netzprüfung die echte Client-Adresse aus dem Proxy übernehmen (vertrauenswürdige Proxy-Adresse festlegen), sonst ist jede Anfrage „lokal“.

## Abnahme

1. Alle Punkte aus A und B umgesetzt, mit Tests; C und D umgesetzt oder als begründete offene Frage im Auftrag vermerkt.
2. E2E-Tests für alle Kalibrierungsstufen grün; Screenshots der Übersicht bei 24, 48 und 96 px im Abschlussbericht beschrieben.
3. `GET /api/%74echnik/status` (und weitere Varianten) von einer öffentlichen Adresse → 403.
4. Feed- oder Artikel-Abruf auf 127.0.0.1, 192.168.x.x, 169.254.169.254 und per Weiterleitung dorthin → abgewiesen.
5. `npm run lint && npm test && npm run test:e2e` grün.
6. `docs/stand-und-absprachen.md` aktualisiert. Danach anhalten; weiter erst nach dem Test am Gerät.

## Offene Fragen

1. **Große Schrift, Gestaltung (A1):** Tasten, Kopfzeile, Seitenangabe und Titel der Einstellungsseiten wachsen nur bis 5 % der Bildschirmhöhe (40 px bei 800 px). Anleitungen in Einstellungen und Einführung höchstens 6,5 % (52 px); passt eine Seite nicht, werden sie kleiner, nie unter 24 px (18 pt). Reine Bedienhinweise („Tippen Sie auf Größer oder Kleiner …“) entfallen als letzte Stufe; die Einverständnisfrage nie. Ob die Leserin bei 60–96 px damit zurechtkommt, zeigt erst der Test am Gerät.
2. **Karten bei sehr großer Schrift:** Reihenfolge der Abstufung: Kurzfassung satzweise mit „…“ kürzen → Kurzfassung weglassen → Lesezeit weglassen → Titelschrift verkleinern (bis zur Schrift der Tasten; Rubrik dann 0,7 × Lesegröße wie in SPEC §8.2) → Rubrik weglassen. Bei 96 px steht je Seite eine Karte nur mit Rubrik und Titel. Ist das so gewünscht?
3. **Artikel bei 96 px:** Auf eine Seite passen etwa zwei Zeilen Text; ein Artikel hat dann über 60 Seiten. Die Seite 1 zeigt nur den Titel (bei Bedarf kleiner gesetzt). Das ist die Folge der gewählten Schrift, nicht abgeschnitten – aber ob das Lesen so noch sinnvoll ist, sollte der Test zeigen (ggf. mit Zeilenabstand 1,5).
4. **„Wie am Anfang“ (B6):** Gemeinsam kalibriert ist jetzt nur, was in der Einführung gespeichert wurde. Eine eigene Taste „gemeinsam eingestellt“ in „Schrift einstellen“ habe ich nicht gebaut (neue Funktion). Wenn der Betreuer mit der Leserin die Schrift neu einstellt, setzt er sie am besten über „Einführung noch einmal“.
5. **Einführung mit 7 Schritten (D10):** Die Schrittzahl ergibt sich aus der Liste der Schritte; der Schritt „Vorlesen“ kommt mit M5 dazu, wenn Vorlesen aktiv ist. Bis dahin sind es immer 6. Ein gespeicherter Stand „pausiert bei Schritt 6“ zeigt nach M5 ggf. auf einen anderen Schritt – mit M5 prüfen.
6. **Abrufe (A3):** Zwischen Zielprüfung und Abruf löst `fetch` den Namen erneut auf (DNS-Rebinding gegen den Abruf möglich). Ganz schließen lässt sich das nur mit einem eigenen `undici`-Dispatcher; vorerst unverhältnismäßig, Vorschlag M4 (ADR 011).
7. **Update-Dienst (D15):** systemd übergibt dem Update-Benutzer die ganze `augenblick.env` (inkl. OpenRouter-Schlüssel). Eine eigene, kleinere Datei wäre sauberer (ADR 012, Vorschlag M4). Bestehende Installationen brauchen einmal `sudo ./deploy/install.sh`; auf echtem systemd ist der neue Ablauf noch nicht geprüft.
8. **Server-Meldungen (D13):** Die Fehlertexte im Technik-Status (`lastError` je Quelle, z. B. „HTTP 404 für …“) bleiben technische Protokolltexte auf Deutsch. Übersetzt bzw. als Codes geschickt werden die Meldungen, die der Betreuer bei einer Eingabe sieht.
9. **Host-Namen (D16):** Wer den Pi über einen Router-Namen (`pi.fritz.box`) oder MagicDNS aufruft, muss diesen in `AUGENBLICK_ALLOWED_HOSTS` eintragen; sonst kommt ein Hinweis statt der App.

## Abschlussbericht

**Gebaut**

- **A1 Große Schrift:** eigene, begrenzte Schrift für Bedienelemente (`--ui`, höchstens 5 % der Bildschirmhöhe) und Anleitungen (`--hint`, 6,5 %); Lesetext und Vorschau behalten die gewählte Größe. Seitenangabe nie umbrochen (Kurzform „2 / 8“, notfalls kleiner). Karten werden abgestuft statt abgeschnitten (siehe Offene Fragen 2). Sehr lange Artikeltitel werden auf Seite 1 kleiner gesetzt. Seiten der Einstellungen und Einführung passen Anleitungen an; Übungskarten stehen nebeneinander.
- **A2** Netzprüfung auf den normalisierten Pfad (mehrfach dekodiert, Schrägstriche, `.`/`..`, Groß-/Kleinschreibung) und die getroffene Route (ADR 011).
- **A3/A4** Abrufe nur auf öffentliche Ziele, http/https auf Port 80/443, Weiterleitungen selbst verfolgt (höchstens 5) und jeweils geprüft; Antworten über 5 MB abgebrochen (ADR 011).
- **B5** Zurücksetzen im Technik-Bereich lässt `interestLearning` immer auf dem Wert der Leserin; Anrede und Rubriken kommen zurück.
- **B6** „Schrift einstellen“ speichert als `nutzerin`; „Wie am Anfang“ nimmt nur Einführung bzw. ausdrückliche Kalibrierung.
- **B7** „Nein, lieber nicht“ läuft über die Rückfrage.
- **C8** Der Worker erzeugt Kurzfassungen und Schlagworte für die Kandidaten (zuerst die Ausgabe, dann die neuesten, höchstens 20 je Lauf, Tageslimit gilt) und baut erst danach die Ausgabe.
- **D9** Ohne Pi beim Öffnen des Artikels: „Die Zeitung ist gerade nicht erreichbar …“; der Lesezustand bleibt, nach 30 s neuer Versuch.
- **D10** „Überspringen“ auch im Fertig-Schritt (beendet ohne zu speichern).
- **D11** Verrutschen über 10 mm während der Berührung bricht den Tipp ab, auch wenn der Finger zurückkehrt.
- **D12** Datum der Übersicht nach Mitternacht aktualisiert.
- **D13** Technik-Bereich formatiert mit der Locale; Feed-Fehler als Codes mit Werten, Text aus `de.json`; 403-Hinweis aus der Locale.
- **D14** Kommentar zu ±3 Punkten korrigiert.
- **D15** Update-Dienst als Benutzer `augenblick-update` ohne Root-Rechte; Neustart über `augenblick-restart.path`; kein Selbst-Update von Programm und Units (ADR 012).
- **D16** Host-Header-Prüfung (eigene IPs, Hostname, `localhost`, `AUGENBLICK_ALLOWED_HOSTS`, sonst 421) und Änderungen nur mit `Content-Type: application/json` (sonst 415) (ADR 013).
- **Hinweis für M4** als ADR 014 (echte Client-Adresse hinter einem Proxy).

**Getestet**

- `npm run lint && npm test && npm run test:e2e` grün: 166 Unit-Tests, 59 E2E-Tests.
- Neue Unit-Tests: Pfad-Varianten von außen → 403 (u. a. `/api/%74echnik/status`, `%2574`, `%2F`, `//`, `./`, `../`, Großschreibung, Query, Fragment) (Abnahme 3); Abrufe auf 127.0.0.1, 192.168.x.x, 169.254.169.254, `[::1]`, `localhost`, Namen mit privater Auflösung, Zahlen-IP und per Weiterleitung dorthin → abgewiesen, das private Ziel wird nie angefragt (Abnahme 4, gefälschte DNS-Auflösung); 5-MB-Grenze mit und ohne `Content-Length`; Einverständnis beim Zurücksetzen in beide Richtungen; „Wie am Anfang“; Kandidat mit Lieblings-Schlagwort rückt auf Platz 3 vor; Obergrenze und Tageslimit; Fehlercode bei ungültigen Feeds; Host-Prüfung und JSON-Pflicht; Tipp mit zwischenzeitlichem Verrutschen.
- Neue E2E-Tests: `web/e2e/sizes.spec.ts` für alle 7 Kalibrierungsstufen (24–96 px) – Übersicht mit Blättern, echter Tipp auf die erste Karte (Mitte trifft die Karte), Artikel, Einstellungen (Menü, Schrift, Rückfrage, Farben, Zeilenabstand, Was ich gern lese, Wie am Anfang) und alle 6 Schritte der Einführung, jeweils mit den Prüfungen aus §14. Die Bildschirmprüfung erkennt jetzt auch Überlappungen, Karten außerhalb des Kartenbereichs sowie umbrochene oder abgeschnittene Seitenangaben. Dazu: „Nein, lieber nicht“ mit Rückfrage, Überspringen im Fertig-Schritt, Pi nicht erreichbar beim Artikel, Datum nach Mitternacht, Verrutschen und Zurückkehren.
- `update.sh` als unprivilegierter Benutzer durchgespielt (Hilfsskript statt Pfad-Unit): Installation, Neustart-Wunsch, Healthcheck in Ordnung. `shellcheck` und `systemd-analyze verify` ohne Befund.

**Bildschirmfotos der Übersicht (Abnahme 2, Viewport 1280 × 800)**

- **24 px:** Kopfzeile mit Datum und „Augenblick“, darunter eine Karte mit Rubrik „Region · Beispieltext“, Titel, vollständiger Kurzfassung und „ca. 4 Minuten“; unten „◂ Zurück“ (gedämpft), „Einstellungen“, „Seite 1 von 8“, „Weiter ▸“. Nichts überlappt.
- **48 px:** Karte mit Rubrik, zweizeiligem Titel und Lesezeit; die Kurzfassung ist weggefallen, weil sie nicht mehr mit auf die Seite passt. Tasten in 40 px, Seitenangabe als „1 / 8“.
- **96 px:** Karte mit Rubrik (0,7 × Lesegröße) und zweizeiligem, verkleinertem Titel; Lesezeit und Kurzfassung entfallen. Leiste wie bei 48 px, „1 / 8“ in kleinerer Schrift. Vorher schrumpfte der Kartenbereich hier auf 0 px, Karte und Leiste überlappten und „Seite 1 von 8“ brach buchstabenweise um.

**Offen:** siehe „Offene Fragen“. Am wichtigsten: Wirkung der Abstufungen bei sehr großer Schrift am Gerät (1–3), Update-Ablauf auf echtem systemd (7), Host-Namen eintragen (9).

**Angehalten.** Weiter erst nach dem Test mit der Leserin am Gerät.
