# 013 – Host-Header prüfen, Änderungen nur als JSON

**Status:** angenommen · **Datum:** 24.10.2026 · **Bezug:** Auftrag 004 (D16)

## Kontext

Augenblick hat keine Anmeldung. Geschützt wird über das Netz: Die App ist nur im Heimnetz erreichbar, der Technik-Bereich nur aus Heimnetz und Tailscale. Zwei Angriffe umgehen das über den Browser eines Geräts im Heimnetz:

- **DNS-Rebinding:** Eine fremde Seite lässt ihren eigenen Namen kurz auf die Adresse des Pi zeigen. Danach darf ihr Skript Antworten des Pi lesen, weil der Browser die Anfrage für „gleiche Herkunft“ hält.
- **CSRF:** Eine fremde Seite schickt ein Formular oder ein `fetch` mit `text/plain` an `http://pi:7341/api/…`. Solche „einfachen“ Anfragen kommen ohne Vorabprüfung (CORS-Preflight) an. Sie könnten z. B. die Einführung zurücksetzen oder Lesesignale fälschen.

## Entscheidung

- **Host-Header:** Jede Anfrage braucht einen bekannten Host. Erlaubt sind:
  - die eigenen IP-Adressen (alle Netzwerkschnittstellen inkl. Tailscale, alle 30 s neu gelesen);
  - der eigene Hostname, auch mit `.local`;
  - `localhost` und `*.localhost`;
  - die Namen aus `AUGENBLICK_ALLOWED_HOSTS` (kommagetrennt; mit führendem Punkt gilt ein Eintrag für alle Namen darunter, z. B. `.fritz.box`).

  Andere Namen bekommen `421 Misdirected Request`.
- **Änderungen nur als JSON:** `POST`, `PUT`, `DELETE` usw. brauchen `Content-Type: application/json`, sonst `415`. Diesen Typ dürfen fremde Seiten nur nach einem CORS-Preflight senden, und den beantwortet Augenblick nicht.
- Der Healthcheck (`127.0.0.1`) und der Vite-Entwicklungsserver (eigene IP) sind dadurch nicht betroffen.

## Folgen

- Wer den Pi über einen Namen aus dem Router (z. B. `pi.fritz.box`) oder über MagicDNS (`pi.<tailnet>.ts.net`) aufruft, muss diesen Namen in `AUGENBLICK_ALLOWED_HOSTS` eintragen. Sonst erscheint der Hinweis aus `errors.host`. Den Kurznamen (`pi`) erlaubt die Prüfung immer.
- `pi.irgendwas.example` ist **nicht** erlaubt, nur weil der Hostname `pi` lautet. Genau so sähe ein Rebinding-Angriff aus.
- Mit HTTPS (M4) kommt der Tailscale-Name ohnehin in die Konfiguration, siehe ADR 014.
