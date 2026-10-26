# Arbeitsregeln für Coding-Agenten

Dieses Repo baut **Augenblick**, einen Zeitungs-Reader für eine hochaltrige Nutzerin mit Makuladegeneration.

## Pflichtlektüre vor jeder Arbeit

1. `SPEC.md` – verbindliche Spezifikation. Bei Widerspruch gilt die Spec.
2. Der aktuelle Auftrag in `docs/auftraege/` (die Datei mit Status `offen`).
3. Bei Fragen zu Gestaltung: `docs/recherche.md` (Regeln [R1]–[R30]).

## Grundsätze

- **Lesbarkeit und Einfachheit schlagen Features.** Im Zweifel weglassen und als Frage notieren.
- **Nur Einzeltipps** in der Oberfläche der Nutzerin. Keine Gesten, Dialoge, Pop-ups, Scroll-Container. Einzige Ausnahme (Entscheidung des Betreuers, ADR 018): der Artikeltext ist Fließtext zum Scrollen.
- **Originaltext ist heilig.** KI nur für Kurzfassungen (ab M3).
- Nichts bauen, was über den aktuellen Auftrag hinausgeht. Ideen für später → `docs/ideen.md`.

## Technik

- TypeScript strict, Node.js 22 LTS, npm Workspaces (`server`, `web`, `shared`, `extension`).
- Gemeinsam genutzt (ADR 023): Bereinigung und Satztrennung in `shared/src/text/`, Leseansicht in `web/src/reader/`. Die Erweiterung importiert nur über `@augenblick/shared/text` und `@augenblick/web/reader`.
- Kein Docker. Betrieb als systemd-Dienste (siehe SPEC §9).
- Keine externen Requests aus der Web-App und der Erweiterung (Schrift selbst gehostet, keine CDNs, kein Tracking).
- UI-Texte nur aus `shared/locales/de.json`.

## Öffentliches Repo

- Keine personenbezogenen Daten, keine Secrets, keine fremden Artikeltexte oder Marken als Testdaten (SPEC §12).
- `.env` nie committen. Neue Variablen in `.env.example` mit Platzhalter eintragen.

## Arbeitsweise

- Kleine, thematische Commits mit deutscher Commit-Nachricht.
- Vor jedem Commit: `npm run lint && npm test` grün.
- Entscheidungen, die die Spec offenlässt, als kurze ADR in `docs/entscheidungen/NNN-titel.md` festhalten (Kontext, Entscheidung, Folgen).
- Was nicht geklärt werden kann: nicht raten, sondern im Auftrag unter „Offene Fragen" eintragen und weiterarbeiten, soweit möglich.
- Am Ende eines Auftrags: Status auf `erledigt` setzen, kurzen Abschlussbericht unten im Auftrag ergänzen (was gebaut, was getestet, was offen), README-Abschnitt „Starten" aktualisieren.
- **Nach M1 anhalten.** Der Betreuer testet mit der Nutzerin am Gerät, bevor es weitergeht.
