# 016 – Standardport 7341 statt 8080

**Status:** angenommen · **Datum:** 25.10.2026 · **Bezug:** SPEC §9, ADR 015, Wunsch des Betreuers

## Kontext

8080 ist der bekannteste Ausweichport für Web-Dienste. Viele Programme und Docker-Container belegen ihn; auf dem vorhandenen Pi war er schon vergeben (ADR 015). Außerdem probieren Scanner im Netz 8080 als einen der ersten Ports aus.

## Entscheidung

Standardport ist **7341** (`PORT` in `.env` bzw. `/etc/augenblick/augenblick.env`, `DEFAULT_PORT` in `server/src/core/config.ts`, Vorgaben in `install.sh`, `update.sh` und `web/vite.config.ts`). Gründe für diesen Port:

- Er liegt unter dem Bereich, aus dem Linux Ports für ausgehende Verbindungen vergibt (ab 32768). Er kann also nicht zufällig von einer ausgehenden Verbindung belegt sein.
- Er ist nicht als Standard eines verbreiteten Dienstes bekannt.

## Folgen

- Adresse für Tablet und Technik-Bereich: `http://<pi>:7341/` bzw. `/technik`.
- Ein anderer Port bleibt über `PORT` einstellbar. `install.sh` bricht ab, wenn der Port belegt ist.
- Bestehende Installationen behalten den Port aus ihrer `augenblick.env`; `install.sh` überschreibt die Datei nicht. Wer umstellen will, ändert dort `PORT` und startet die Dienste neu (Lesezeichen am Tablet anpassen).
- Ein Port ist kein Schutz. Den Schutz liefern die Netzprüfung (ADR 007, 011) und die Host-Prüfung (ADR 013); der unauffälligere Port vermeidet vor allem Konflikte.
