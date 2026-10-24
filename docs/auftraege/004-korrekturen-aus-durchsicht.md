# Auftrag 004 – Korrekturen aus der Durchsicht M0–M3

**Status:** offen
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

_(vom Agenten zu ergänzen)_

## Abschlussbericht

_(vom Agenten zu ergänzen)_
