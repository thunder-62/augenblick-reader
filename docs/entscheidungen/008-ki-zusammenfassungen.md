# 008 – KI-Zusammenfassungen über OpenRouter

**Status:** angenommen (M3, nach geänderter SPEC) · **Datum:** 24.10.2026

## Kontext

SPEC §6 (geändert): Anbindung über OpenRouter (OpenAI-kompatible Chat-Completions-API) hinter einer schmalen Provider-Abstraktion; `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, optional `OPENROUTER_FALLBACK_MODEL`; Kennzeichnung mit `HTTP-Referer`/`X-Title`; ohne Schlüssel oder bei Fehler Anreißer der Quelle bzw. die ersten zwei Sätze; Kurzfassung ohne Beschriftung, KI-Kurzfassungen mit einem Funkelstern; Themen-Schlagworte zusammen mit der Kurzfassung (§5.3). Eine erste M3-Fassung mit dem Anthropic-SDK wurde deshalb ersetzt.

## Entscheidung

- **Provider** `OpenRouterSummaryProvider` (`server/src/core/openrouter.ts`) mit `fetch`, ohne zusätzliche Bibliothek. `temperature 0.2`, `max_tokens 600`, `usage: { include: true }` für die Kosten. Fehler werden unterschieden: Schlüssel, Guthaben (402), Modell nicht gefunden, Limit/Überlastung, Serverfehler und keine Verbindung gelten als „nicht verfügbar“ – dann versucht er das **Ausweich-Modell**; ist es auch nicht verfügbar, bricht der Lauf ab, **ohne** Versuche für die Artikel zu verbrauchen.
- **Standardmodell** `qwen/qwen3-next-80b-a3b-instruct:free` – das Modell, das der Betreuer im Klick-Prototyp erprobt hat. Kostenlose Modelle haben enge Tageslimits und keine Zusage zur Verfügbarkeit; für den Dauerbetrieb lieber ein günstiges bezahltes Modell eintragen. Die aktuelle Modellliste von OpenRouter war aus der Entwicklungsumgebung nicht erreichbar, deshalb steht kein bezahltes Modell als Standard im Code (Offene Fragen in Auftrag 003).
- **Prompt** `server/prompts/summary.de.md`, Version 2: Kurzfassung nach §6 plus 1–3 alltagsnahe Themen-Schlagworte, Antwort als JSON `{"kurzfassung": …, "themen": […]}`. Der Artikel steht in `<artikel>…</artikel>` und ist nur Material.
- **Prüfung** der Kurzfassung wie bisher: höchstens 45 Wörter und 3 Sätze, mindestens 6 Wörter, vollständiger Satz, keine Aufzählung, erkennbar Deutsch, jede Zahl muss im Artikel stehen. Schlagworte: höchstens 3, je ein bis zwei Wörter aus Buchstaben. Bei Verstoß ein Neuversuch mit dem Grund, sonst Fallback. Höchstens zwei Läufe pro Artikel.
- **Nur was gezeigt wird:** Zusammenfassungen entstehen für die Artikel der aktuellen Ausgabe, innerhalb des Tageslimits (`AUGENBLICK_SUMMARY_DAILY_LIMIT`, Standard 40 Aufrufe). Verbrauch je Tag (Aufrufe, Fehlschläge, Tokens, Kosten) steht in `ai_usage` und im Technik-Status.
- **Fallback:** der Anreißer der Quelle (BR24: RSS-Beschreibung, tagesschau: `firstSentence`), sonst die ersten zwei Sätze, immer höchstens 45 Wörter (zur Not nach 45 Wörtern mit „…“ gekürzt – nur auf der Karte, nie im Lesetext).
- **Gestaltung:** keine Beschriftung. KI-Zusammenfassungen tragen einen **Funkelstern** als eigenes SVG in Textfarbe, ca. 0,8 × Schriftgröße, ohne Animation, kein eigenes Tippziel; für Screenreader ein unsichtbarer Hinweis. Anreißer und erste Sätze haben keinen Stern. Die Bedeutung steht in den Einstellungen („Was bedeutet dieses Zeichen?“) und auf dem Spickzettel.

## Folgen

- Mit echtem Schlüssel ist noch nicht gelaufen; geprüft sind Anfrage-Aufbau, Antwort, Fehlerarten, Ausweich-Modell und Kosten mit einer nachgebildeten API. Ob Ton, Länge und Schlagworte passen, zeigt der erste Betrieb.
- Die Texte öffentlich abrufbarer Artikel gehen zur Zusammenfassung an OpenRouter und das gewählte Modell; persönliche Daten der Leserin nicht. Kostenlose Modelle können Eingaben zum Training nutzen – auch das spricht im Dauerbetrieb für ein bezahltes Modell.
