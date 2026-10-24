# 008 – KI-Kurzfassungen

**Status:** angenommen (M3) · **Datum:** 24.10.2026

## Kontext

SPEC §6: Kurzfassung in 2–3 Sätzen, einfache Sprache, höchstens 45 Wörter; nur auf dem Server, einmal pro Artikel, gespeichert; Provider-Abstraktion mit Anthropic als Standard; Prompt versioniert im Repo; Ausgabe prüfen, bei Verstoß einmal neu, sonst Fallback; Tageslimit; Kurzfassung in der Oberfläche erkennbar. Abnahme M3: jede Karte hat eine Kurzfassung ≤ 45 Wörter.

## Entscheidung

- **Nur was gezeigt wird:** Kurzfassungen entstehen nach jedem Lauf für die Artikel der aktuellen Ausgabe (höchstens 12 am Tag), nicht für alle abgeholten Artikel. Das hält Kosten und Aufrufe klein.
- **Provider** `SummaryProvider` (`server/src/core/summary.ts`), Standard `AnthropicSummaryProvider` mit dem offiziellen SDK `@anthropic-ai/sdk`. Ohne `ANTHROPIC_API_KEY` gibt es keinen Provider; dann bleiben die ersten Sätze.
- **Modell:** Standard `claude-opus-5-5` (aktuelles Standardmodell), änderbar über `AUGENBLICK_SUMMARY_MODEL`. Aufwand `effort: low`, weil Kurzfassen eine einfache Aufgabe ist. Lehnt das Modell eine Anfrage ab, übernimmt serverseitig ein passendes anderes Modell (`fallbacks: "default"`). Gespeichert wird das tatsächlich antwortende Modell samt Prompt-Version, z. B. `claude-opus-5-5 (Prompt v1)`.
- **Kosten** (Richtwert): ein Artikel ≈ 1.000–2.000 Eingabe- und ≈ 100–300 Ausgabe-Tokens. Bei 12 Artikeln am Tag sind das mit `claude-opus-5-5` (4 $/20 $ je Mio. Tokens) etwa 0,10–0,20 $ am Tag, also wenige Dollar im Monat. Mit `claude-haiku-5-5` (0,10 $/0,50 $) wäre es etwa ein Vierzigstel – die Wahl trifft der Betreuer (Offene Fragen in Auftrag 003).
- **Prompt** `server/prompts/summary.de.md` mit Versionsnummer im Kopfkommentar. Der Artikel steht in `<artikel>…</artikel>` und ist ausdrücklich nur Material (Schutz gegen Anweisungen im Artikeltext).
- **Prüfung** jeder Antwort (`validateSummary`): höchstens 45 Wörter und 3 Sätze, mindestens 6 Wörter, vollständiger Satz am Ende, keine Aufzählung/Formatierung, erkennbar Deutsch, und **jede Zahl muss im Artikel vorkommen** (einfacher Schutz gegen erfundene Fakten). Vorspann wie „Kurzfassung:“ und umschließende Anführungszeichen werden entfernt.
- **Neuversuch:** Bei Verstoß genau ein neuer Aufruf mit dem Grund als Hinweis; danach Fallback. Höchstens zwei Läufe pro Artikel; dann bleibt der Fallback dauerhaft.
- **Fehler, die nicht am Artikel liegen** (falscher Schlüssel, fehlende Rechte, unbekanntes Modell, Rate-Limit, Serverfehler, keine Verbindung) brechen den Lauf ab, **ohne** Versuche zu verbrauchen. Nach dem Beheben bekommt jeder Artikel der Ausgabe noch seine Kurzfassung.
- **Tageslimit** `AUGENBLICK_SUMMARY_DAILY_LIMIT` (Standard 40); jeder Aufruf zählt, auch Neuversuche. Verbrauch je Tag (Aufrufe, Fehlschläge, Tokens) steht in der Tabelle `ai_usage` und im Admin-Status.
- **Fallback:** die ersten zwei Sätze, wenn sie zusammen höchstens 45 Wörter haben, sonst nur der erste; ist schon der erste Satz länger, wird er nach 45 Wörtern mit „…“ gekürzt. So hält auch der Fallback die Abnahme ein. Die Kürzung betrifft nur die Karte, nie den Lesetext.
- **Gestaltung:** Eine KI-Kurzfassung hat auf der Karte einen senkrechten Strich am linken Rand (in der gedämpften Textfarbe); die ersten Sätze des Artikels selbst haben keinen. Kein zusätzlicher Text, damit die Karte nicht größer wird. Erklärt im Admin-Status. Der Originalartikel ist einen Tipp entfernt.

## Folgen

- Ein echter Aufruf mit gültigem Schlüssel konnte während der Entwicklung nicht gemacht werden (kein Schlüssel). Mit einem ungültigen Schlüssel ist geprüft, dass die API erreichbar ist, der Fehler erkannt wird und alles mit Fallback weiterläuft. Ob Ton und Länge der Kurzfassungen passen, zeigt der erste Betrieb (Admin-Status, Karten ansehen).
- Rubriken und Dubletten per KI (SPEC §6, „günstiges Modell“) sind nicht Teil von M3; die wortbasierte Erkennung aus M1 bleibt.
