# Auftrag 003 – KI-Zusammenfassungen und Interessen lernen (M3)

**Status:** erledigt
**Bezug:** SPEC §5.3, §6, §13 (M3), [R30]
**Auftraggeber:** Betreuer im Chat am 24.10.2026 („Mach mal bis M3“, danach Hinweis auf die geänderte SPEC).

## Ziel

Jede Karte hat eine kurze, sachliche Zusammenfassung; ist sie von der KI, steht ein Funkelstern davor. Themen, die die Leserin gern liest, rücken mit ihrem Einverständnis nach vorn.

## Umfang (nach SPEC §5.3 und §6)

- Anbindung über OpenRouter hinter `SummaryProvider`, Modell und Ausweich-Modell per `.env`, Kennzeichnung per `HTTP-Referer`/`X-Title`.
- Prompt versioniert unter `server/prompts/summary.de.md`; Kurzfassung und Themen-Schlagworte in einem Aufruf.
- Ausgabe prüfen, einmal neu, sonst Fallback (Anreißer der Quelle bzw. erste zwei Sätze); Tageslimit; Verbrauch und Kosten im Technik-Status.
- Kurzfassung ohne Beschriftung, Funkelstern vor KI-Kurzfassungen.
- Interessen lernen mit Einverständnis, Themen-Gewichte mit Vergessen, Reihenfolge mit festen Plätzen und Abwechslung, „Was ich gern lese“.

## Nicht in diesem Auftrag

Rubriken/Dubletten per KI (SPEC §6, optional), Einfache-Sprache-Fassung ganzer Artikel (später), Vorlesen als Signal (M5).

## Abnahme

1. Jede Karte hat eine Kurzfassung ≤ 45 Wörter (auch der Fallback).
2. Ohne Schlüssel, bei Fehlern oder nach dem Tageslimit läuft alles mit Fallback weiter.
3. Lint, Unit- und E2E-Tests grün.

## Offene Fragen

1. **OpenRouter-Schlüssel und Modell:** Ohne `OPENROUTER_API_KEY` gibt es keine KI-Zusammenfassungen. Standard ist das im Prototyp erprobte kostenlose Modell `qwen/qwen3-next-80b-a3b-instruct:free`. Kostenlose Modelle haben enge Tageslimits und können Eingaben weiterverwenden; für den Dauerbetrieb bitte ein günstiges bezahltes Modell eintragen. Eine geprüfte Modell-ID konnte ich nicht nennen, weil openrouter.ai aus der Entwicklungsumgebung gesperrt war.
2. **Kein echter Testlauf mit Schlüssel:** Anfrage, Antwort, Fehlerarten, Ausweich-Modell und Kosten sind mit einer nachgebildeten API geprüft. Bitte nach dem Eintragen einige Karten lesen: Ton, Länge, Inhalt, Schlagworte (Technik → Interessen).
3. **Gewichtung des Lernens** (Punkte, 5 Lieblingsthemen, Schrittweite 3) ist eine Annahme (ADR 009). Ohne KI lernt Augenblick nur Rubriken.
4. **Datenweitergabe:** Texte öffentlich abrufbarer Artikel gehen an OpenRouter und das gewählte Modell; persönliche Daten der Leserin nicht. Für die Regionalzeitung (M7) gehört das zur rechtlichen Klärung (SPEC §15).
5. Die offenen Fragen aus Auftrag 001 und 002 bestehen weiter.

## Abschlussbericht

**Gebaut** (ersetzt eine erste Fassung mit Anthropic-SDK und Strich statt Stern, siehe ADR 008)

- `OpenRouterSummaryProvider` mit `fetch`: Fehlerarten, Ausweich-Modell, Kosten aus der Antwort; Prompt v2 mit JSON-Antwort; Prüfung von Kurzfassung und Schlagworten; Neuversuch; höchstens zwei Läufe pro Artikel; Konfigurations-, Netz- und Serverfehler verbrauchen keine Versuche.
- Fallback: Anreißer der Quelle (BR24-Feed, tagesschau `firstSentence`), sonst erste Sätze, immer ≤ 45 Wörter.
- Funkelstern als eigenes SVG vor KI-Kurzfassungen; keine Beschriftung; Erklärung in den Einstellungen und auf dem Spickzettel.
- Interessen lernen: Lesesignal beim Verlassen eines Artikels (nur mit Einverständnis), Themen-Gewichte mit Halbwertszeit 30 Tage, Auswahl und Reihenfolge mit 2 festen Plätzen und mindestens 3 anderen Themen, „Was ich gern lese“ mit „Mehr davon“/„Weniger davon“/„Alles vergessen“/„Nicht mehr merken“ (jeweils mit Rückfrage); Rückzug des Einverständnisses löscht alles Gelernte.
- Technik-Status: Anbieter, Modell, Ausweich-Modell, Aufrufe, Fehlschläge, Tokens, Kosten, Anteil der Karten mit ✦.
- ADR 008, 009; `.env.example`, README, `deploy/README.md` angepasst.

**Getestet**

- Unit-Tests u. a.: Antwort lesen (JSON und Klartext), Schlagworte bereinigen, Prüfregeln, Anreißer-Fallback, OpenRouter-Anfrage (Kopfzeilen, Modell, Prompt, Artikel), Fehlerarten, Ausweich-Modell, abgeschnittene/leere Antworten, Pipeline mit Themen und Kosten, Tageslimit, Abbruch ohne Versuchsverbrauch, Abnahme „jede Karte ≤ 45 Wörter“, Lernen nur mit Einverständnis, Punkte, „mehr/weniger davon“, „Alles vergessen“, Löschen beim Rückzug, Halbwertszeit, Auswahl mit festen Plätzen und Abwechslung.
- E2E: Funkelstern nur bei KI-Kurzfassungen, ohne sichtbare Beschriftung, Prüfungen nach §14; „Was ich gern lese“ mit Einverständnis, Lernen und „Mehr davon“ mit Rückfrage; Technik-Status ohne Schlüssel.

**Offen:** siehe „Offene Fragen“. Danach ist der Test mit der Leserin am Gerät dran (M1–M3 zusammen).
