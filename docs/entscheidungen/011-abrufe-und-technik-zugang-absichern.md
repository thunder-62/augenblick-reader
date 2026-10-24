# 011 – Abrufe und Zugang zum Technik-Bereich absichern

**Status:** angenommen · **Datum:** 24.10.2026 · **Bezug:** Auftrag 004 (A2–A4)

## Kontext

Die Durchsicht nach M3 fand drei Lücken:

1. Die Netzprüfung des Technik-Bereichs verglich die **rohe** URL. `GET /api/%74echnik/status` kam aus dem Internet durch, weil der Router den Pfad dekodiert, die Prüfung aber nicht.
2. Feed- und Artikeladressen kommen von außen (Feeds, eigene Adressen im Technik-Bereich, ADR 010). Der Abruf folgte Weiterleitungen ungeprüft. Ein Feed hätte den Pi so dazu bringen können, Geräte im Heimnetz oder den Pi selbst abzufragen (SSRF).
3. Antworten wurden unbegrenzt gelesen.

## Entscheidung

- **Technik-Bereich:** Geprüft wird der normalisierte Pfad: mehrfach dekodiert, ohne Query und Fragment, `\` als `/`, doppelte Schrägstriche sowie `.` und `..` aufgelöst, klein geschrieben. Zusätzlich wird die tatsächlich getroffene Route (`routeOptions.url`) geprüft. Passt eines von beiden zu `/technik…` oder `/api/technik…`, gilt die Netzprüfung.
- **Abrufe** (`server/src/core/http.ts`):
  - Nur `http` und `https`, nur die Ports 80 und 443, keine Zugangsdaten in der Adresse, kein `localhost`.
  - Der Hostname wird aufgelöst. **Alle** Adressen müssen öffentlich sein. Ausgeschlossen sind Loopback, RFC 1918, CGNAT/Tailscale (100.64/10), Link-local (u. a. 169.254.169.254), Multicast, reservierte Bereiche, ULA (`fc00::/7`), IPv6-Link-local, NAT64 und auf IPv4 abgebildete IPv6-Adressen solcher Ziele.
  - Weiterleitungen verfolgt Augenblick selbst (`redirect: 'manual'`), höchstens 5. Vor jedem Schritt wird erneut geprüft.
  - Antworten über **5 MB** werden abgebrochen, auch wenn keine `Content-Length` mitkommt (der Stream wird gezählt). Das zählt wie ein fehlgeschlagener Abruf; die übrigen Artikel und Quellen laufen weiter.

## Folgen

- Eigene Feed-Adressen im Heimnetz (z. B. ein lokaler Feed-Dienst) sind nicht möglich. Ausnahmen sind laut Auftrag nicht nötig.
- **Restrisiko:** Zwischen der Prüfung und dem Abruf löst `fetch` den Namen noch einmal auf. Ein Angreifer mit eigenem DNS könnte die Antwort in diesem Moment ändern (DNS-Rebinding gegen den Abruf). Ganz schließen lässt sich das nur, wenn die Verbindung an die geprüfte Adresse gebunden wird (eigener `undici`-Dispatcher mit `lookup`). Das ist für die Einzelinstallation vorerst unverhältnismäßig und kann mit M4 nachgezogen werden.
- Die OpenRouter-Anbindung nutzt eine feste Adresse und ist nicht betroffen.
