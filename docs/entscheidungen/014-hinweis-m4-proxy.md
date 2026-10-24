# 014 – Hinweis für M4: echte Client-Adresse hinter einem Proxy

**Status:** vorgemerkt für M4 · **Datum:** 24.10.2026 · **Bezug:** Auftrag 004 („Nicht in diesem Auftrag“), SPEC §9

## Kontext

Für HTTPS (M4) ist der einfachste Weg, dass Tailscale das Zertifikat hält und auf `localhost:8080` weiterleitet (`tailscale serve`, alternativ Caddy o. ä.). Dann kommt **jede** Anfrage für Augenblick von `127.0.0.1`. Die Netzprüfung des Technik-Bereichs (ADR 007, 011) erlaubt `127.0.0.0/8`, also wäre der Technik-Bereich für jede Anfrage über den Proxy offen.

## Entscheidung (umzusetzen mit M4)

- Eine Einstellung legt die **vertrauenswürdige Proxy-Adresse** fest, z. B. `AUGENBLICK_TRUSTED_PROXY=127.0.0.1`. Nur wenn eine Anfrage von dort kommt, gilt die Client-Adresse aus dem Header des Proxys (`X-Forwarded-For`, beim Tailscale-Proxy zusätzlich `Tailscale-User-Login`). Sonst gilt die Adresse der Verbindung.
- Ohne diese Einstellung wird `X-Forwarded-For` ignoriert (wie heute).
- Mit Proxy wird `127.0.0.0/8` aus den Standardnetzen des Technik-Bereichs genommen, oder die Netzprüfung verlangt eine Proxy-Adresse aus dem Heimnetz bzw. Tailscale.
- Der Host-Header (ADR 013) enthält dann den Tailscale-Namen; er kommt in `AUGENBLICK_ALLOWED_HOSTS`.
- Tests: Anfrage über den Proxy mit Internet-Adresse im Header → 403; dieselbe Anfrage direkt mit gefälschtem Header → Header wird ignoriert.

## Folgen

Bis M4 ändert sich nichts. Wer vorher selbst einen Proxy vor Augenblick setzt, öffnet den Technik-Bereich für alle, die den Proxy erreichen.
