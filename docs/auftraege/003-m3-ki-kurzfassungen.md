# Auftrag 003 – KI-Kurzfassungen (M3)

**Status:** erledigt
**Bezug:** SPEC §6, §13 (M3), [R30]
**Auftraggeber:** Betreuer im Chat am 24.10.2026 („Mach mal bis M3“).

## Ziel

Jede Karte der Übersicht hat eine kurze, sachliche Kurzfassung in einfacher Sprache, damit die Nutzerin entscheiden kann, ob sich der Artikel lohnt.

## Umfang (nach SPEC §6)

- Läuft nur auf dem Server, einmal pro Artikel, Ergebnis wird gespeichert. Das Tablet ruft nie eine KI auf.
- Provider-Abstraktion `SummaryProvider`, Standard Anthropic Claude API. Modell und API-Schlüssel per `.env`. Ohne Schlüssel: Fallback auf die ersten Sätze des Artikels.
- Prompt versioniert unter `server/prompts/summary.de.md`: sachlich, keine Wertung, keine Informationen, die nicht im Text stehen, kurze Sätze, keine Fremdwörter ohne Not, max. 45 Wörter.
- Ausgabe prüfen (Länge, Sprache); bei Verstoß einmal neu, sonst Fallback.
- Tageslimit an Aufrufen in der Konfiguration.
- Kurzfassung in der Oberfläche als solche erkennbar; Hinweis im Admin-Bereich. Original ist immer einen Tipp entfernt.
- Admin-Status: KI-Verbrauch heute.

## Nicht in diesem Auftrag

Rubriken/Dubletten per KI (SPEC §6, optional), Einfache-Sprache-Fassung ganzer Artikel (später), Übersetzung.

## Abnahme

1. Jede Karte hat eine Kurzfassung ≤ 45 Wörter (auch der Fallback).
2. Ohne Schlüssel, bei Fehlern der KI oder nach Erreichen des Tageslimits läuft alles mit Fallback weiter.
3. Lint, Unit- und E2E-Tests grün.

## Offene Fragen

1. **API-Schlüssel:** Ohne `ANTHROPIC_API_KEY` bleiben die ersten Sätze. Für echte Kurzfassungen bitte einen Schlüssel in der Anthropic Console anlegen (am besten mit eigenem Ausgabenlimit) und in `/etc/augenblick/augenblick.env` bzw. `.env` eintragen.
2. **Modellwahl und Kosten:** Standard ist `claude-opus-5-5` (geschätzt wenige Dollar im Monat bei 12 Artikeln am Tag). `claude-haiku-5-5` kostet etwa ein Vierzigstel. Ob die Qualität dann noch reicht, wäre an echten Kurzfassungen zu vergleichen. Umstellen über `AUGENBLICK_SUMMARY_MODEL`.
3. **Kein echter Testlauf mit Schlüssel:** Geprüft sind Anfrage-Aufbau (mit gefälschter API), Prüfregeln, Neuversuch, Limit, Fallback sowie gegen die echte API der Fehlerfall „ungültiger Schlüssel“. Bitte nach dem Eintragen des Schlüssels einige Karten lesen: Sind Ton und Länge richtig? Stimmen die Inhalte mit dem Artikel überein?
4. **Erkennbarkeit:** KI-Kurzfassungen haben einen senkrechten Strich links (ADR 008). Ob die Nutzerin den Unterschied braucht oder ob ein Wort wie „Kurz gefasst“ besser wäre, klärt der Test am Gerät.
5. **Datenweitergabe:** Die Texte der öffentlich abrufbaren Artikel gehen zur Kurzfassung an die Anthropic-API; persönliche Daten der Nutzerin nicht. Für die spätere Regionalzeitung (M7) gehört die Frage, ob KI-Kurzfassungen erlaubt sind, zur rechtlichen Klärung (SPEC §15).
6. Die offenen Fragen aus Auftrag 001 und 002 bestehen weiter.

## Abschlussbericht

**Gebaut**

- `SummaryProvider`-Abstraktion und `AnthropicSummaryProvider` mit dem offiziellen SDK: `claude-opus-5-5` (änderbar), `effort: low`, serverseitiger Fallback bei Ablehnung, Fehler nach Art unterschieden (typisierte SDK-Fehler).
- Prompt `server/prompts/summary.de.md` (Version 1) mit den Vorgaben aus §6 und Schutz gegen Anweisungen im Artikeltext; im Release-Paket enthalten.
- Prüfung der Ausgabe (Länge, Satzzahl, Form, Sprache, Zahlen nur aus dem Artikel), ein Neuversuch mit Grund, sonst Fallback; höchstens zwei Läufe pro Artikel; Konfigurations-, Netz- und Serverfehler verbrauchen keine Versuche.
- Pipeline-Schritt: Kurzfassungen für die Artikel der aktuellen Ausgabe, Tageslimit (Standard 40 Aufrufe), Verbrauch je Tag in der Datenbank (Migration 3).
- Fallback hält jetzt immer ≤ 45 Wörter ein (erste zwei Sätze, sonst einer, notfalls gekürzt mit „…“).
- Lese-App: KI-Kurzfassung mit senkrechtem Strich links erkennbar. Admin-Status: Anbieter, Modell, Verbrauch heute, Anteil der Karten mit KI-Kurzfassung, Erklärung der Gestaltung.
- ADR 008; `.env.example`, README und `deploy/README.md` ergänzt.

**Getestet**

- `npm run lint` sauber, `npm test`: 130 Unit-Tests grün (neu 26: Prüfregeln, Fallback ≤ 45 Wörter, Neuversuch, API-Fehler, Limit, Prompt, Anfrage-Aufbau an die API, Fehlerarten, Pipeline mit Limit, Abbruch bei falschem Schlüssel ohne Versuchsverbrauch, Aufgeben nach zwei Läufen, Abnahme „jede Karte ≤ 45 Wörter“).
- `npm run test:e2e`: 29 Playwright-Tests grün (neu: Gestaltung der KI-Kurzfassung inkl. Prüfungen nach §14; Admin-Status ohne Schlüssel).
- Gebautes Release-Paket: Worker gegen die echte API mit ungültigem Schlüssel – Fehler erkannt, Lauf pausiert, Karten behalten den Fallback, nichts bricht.

**Offen:** siehe „Offene Fragen“. Danach ist der Test mit der Nutzerin am Gerät dran (M1–M3 zusammen).
