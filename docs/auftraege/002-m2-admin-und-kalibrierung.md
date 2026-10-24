# Auftrag 002 – Admin-Bereich, Einstellungen, Kalibrierung (M2)

**Status:** erledigt
**Bezug:** SPEC §7, §8.4, §9 (Admin nur über Tailscale + PIN), §10, §13 (M2)
**Auftraggeber:** Betreuer im Chat am 24.10.2026 („Mach mal bis M3“). Abweichend von CLAUDE.md („Nach M1 anhalten“) geht es ohne vorherigen Test am Gerät weiter; die offenen Fragen aus Auftrag 001 bleiben offen.

## Ziel

Der Betreuer stellt alles aus der Ferne ein. Schriftgröße und Farbschema werden gemeinsam mit der Nutzerin am Tablet kalibriert und wirken danach in der Lese-App.

## Umfang

- Einstellungen (SPEC §7) liegen in der Datenbank statt nur in `.env`; `.env` liefert nur die Anfangswerte. Struktur so, dass später Einstellungen pro Gerät möglich sind (SPEC §12a).
- `/admin`: für Smartphone/PC des Betreuers gestaltet (normale Größen), PIN-geschützt, nur aus erlaubten Netzen (Standard: dieses Gerät und Tailscale).
  - Einstellungen aus §7 bearbeiten, mit Live-Vorschau der echten Lese-App.
  - Kalibrierung nach §8.4: Schriftgröße in Stufen von +26 % ab 18 pt, Farbschema hell/dunkel mit optionaler Lesezeit, Vorschau einer echten Artikelseite, Speichern.
  - Quellen (BR24-Feed) und Rubriken-Mix.
  - Status: letzter Abruf je Quelle, Fehler, Speicher, Version, Ausgabe.
  - Nutzungsprotokoll (nur lokal): geöffnete Artikel, Seiten, Lesedauer; abschaltbar.
  - Spickzettel als druckbare Seite (A4, Großdruck) [R28].
- Lese-App: Einstellungen auch beim Zurückholen in den Vordergrund laden; Vorschau-Modus für den Admin-Bereich.

## Nicht in diesem Auftrag

KI-Verbrauch (kommt mit M3), TTS-Stimmen und Vorlesen (M5), Experimente (M6), HTTPS (M4).

## Abnahme

1. Größe/Schema per Kalibrierung gesetzt und auf dem Tablet wirksam (SPEC §13).
2. Ohne PIN bzw. aus nicht erlaubtem Netz kein Zugriff auf `/admin` und `/api/admin/*`.
3. Ungültige Werte werden abgewiesen bzw. auf erlaubte Grenzen gesetzt (z. B. Schrift ≥ 18 pt, Buchstabenabstand ≤ 0,05 em).
4. Lint, Unit- und E2E-Tests grün; die Prüfungen aus SPEC §14 laufen weiter.

## Offene Fragen

1. **Tablet im Tailnet?** Der Admin-Bereich ist nur über Tailscale (und vom Pi selbst) erreichbar (ADR 007). Für die Kalibrierung am Tablet muss das Tablet also im Tailnet sein. Alternative: das Heimnetz in `AUGENBLICK_ADMIN_NETWORKS` freigeben – dann schützt nur noch die PIN. Bitte entscheiden.
2. **Nutzungsprotokoll und Einverständnis:** Das Protokoll ist standardmäßig an (nur lokal, abschaltbar, nach 180 Tagen gelöscht). Bitte mit der Nutzerin besprechen, dass mitgezählt wird, was sie liest – sonst im Admin-Bereich abschalten.
3. **Kalibrierung nicht mit der Nutzerin erprobt:** Stufen 24–96 px, Start immer bei 18 pt. Ob die Abstufung und der Beispielsatz passen, zeigt erst der Test am Gerät. Die Vorschau in Schritt 3 ist etwas kleiner als der echte Bildschirm (Bedienleisten oben und unten).
4. **Spickzettel:** Text und Gestaltung bitte vor dem Ausdrucken prüfen (vier Zeilen: Karte, Weiter, Zurück, Übersicht).
5. Die offenen Fragen aus Auftrag 001 bestehen weiter (Gerät nicht getestet).

## Abschlussbericht

**Gebaut**

- Einstellungen in der Datenbank (Tabelle `settings`, pro Gerät vorbereitet), `.env` nur noch als Anfangswerte; Server-seitige Begrenzung aller Werte (`sanitizeSettings` in `shared`).
- Admin-Bereich `/admin` (Vanilla TS, normale Größen, eigenes CSS): Anmeldung mit PIN, Netzprüfung (Loopback + Tailscale), signiertes Sitzungs-Cookie, Sperre nach 5 Fehlversuchen.
  - *Status:* Version, Ausgabe, letzter Abruf/Erfolg/Fehler je Quelle, Artikelzahlen, Speicher (Datenbank, frei), Datum der letzten Kalibrierung, Hinweis zur Gestaltung der Kurzfassungen.
  - *Einstellungen* aus §7 mit Live-Vorschau der echten Lese-App (auf 1280×800 skaliert, wahlweise Übersicht oder ein Artikel). Vorlesen und Experimente sichtbar, aber bis M5/M6 nicht änderbar.
  - *Kalibrierung* nach §8.4 im Vollbild: Schriftstufen ab 18 pt (+26 %), „eine Stufe größer“, Schema hell/dunkel mit Stoppuhr, Vorschau einer echten Artikelseite, Speichern.
  - *Quellen und Rubriken:* BR24-Feed-Adresse, Rubriken-Mix mit Summenanzeige.
  - *Nutzung:* Protokoll an/aus, letzte 14 Tage (Artikel, Seiten, Minuten), löschen.
  - *Spickzettel:* Großdruck für A4 mit den drei Tasten [R28].
- Lese-App: Vorschau-Modus (`?vorschau=…`, speichert nichts), Einstellungen auch beim Zurückholen in den Vordergrund laden, Nutzungsmeldung beim Verlassen eines Artikels.
- Worker liest Feed-Adresse und Rubriken-Mix bei jedem Lauf aus der Datenbank, räumt das Nutzungsprotokoll auf.
- ADR 007; `.env.example`, README und `deploy/README.md` ergänzt.

**Getestet**

- `npm run lint` sauber, `npm test`: 104 Unit-Tests grün (neu u. a. Netzprüfung, Sitzungs-Token, Sperre, PIN-Format, Admin-API mit/ohne Anmeldung und aus dem Heimnetz, Begrenzung der Einstellungen, Kalibrierung, Feed-Adresse, Rubriken-Mix, Nutzungsprotokoll an/aus/aufräumen, Kalibrierungsstufen).
- `npm run test:e2e`: 28 Playwright-Tests grün – die 20 aus M1 und 8 neue: Anmeldung, gesperrte API, Einstellungen speichern → in der Lese-App wirksam (inkl. Prüfungen nach §14 bei 36 px hell), kompletter Kalibrierungsablauf → in der Lese-App wirksam, Vorschau ohne Lesezustand, Quellen/Rubriken, Nutzungsprotokoll, Spickzettel.
- Abnahme 1 (Größe/Schema per Kalibrierung gesetzt und wirksam) im Browser nachgewiesen; am echten Tablet noch nicht.

**Offen:** siehe „Offene Fragen“.
