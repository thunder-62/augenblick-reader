# Auftrag 002 – Einstellungen der Leserin, Einführung, Technik-Bereich (M2)

**Status:** erledigt
**Bezug:** SPEC §1, §7, §8.4, §8.7, §8.8, §9, §10, §13 (M2)
**Auftraggeber:** Betreuer im Chat am 24.10.2026 („Mach mal bis M3“, danach Hinweis auf die geänderte SPEC). Abweichend von CLAUDE.md („Nach M1 anhalten“) geht es ohne vorherigen Test am Gerät weiter.

## Ziel

Die Leserin ändert ihre Leseeinstellungen selbst und wird durch eine Einführung geführt. Schutz vor Versehen durch eine Rückfrage, nicht durch einen PIN. Der Betreuer kümmert sich im Technik-Bereich um die Technik.

## Umfang

- Taste „Einstellungen“ in der Übersicht; Einstellungen nach §8.7 mit Vorschau und zweistufigem Speichern, „Wie am Anfang“, Verlauf aller Fassungen.
- Schrift einstellen nach §8.4 (ab 18 pt, +26 %, Schalter eine Stufe größer).
- Einführung nach §8.8 (Vorlesen-Schritt erst mit M5).
- Technik-Bereich `/technik` ohne PIN, nur Heimnetz/Tailscale (§9, §10).
- Anrede du/Sie aus der Locale (§8.7).

## Nicht in diesem Auftrag

Vorlesen (M5), Experimente (M6), HTTPS (M4), Backup (§9).

## Abnahme (SPEC §13)

1. Nutzerin ändert Größe/Schema selbst, Bestätigungsschritt greift.
2. Betreuer kann auf eine frühere Fassung zurücksetzen.
3. Lint, Unit- und E2E-Tests grün; die Prüfungen aus SPEC §14 gelten auch für Einstellungen und Einführung.

## Offene Fragen

1. **Einführung erst nach dem Test am Gerät bewertbar:** Wortlaut, Reihenfolge, Übungstexte und ob „Andere Farben zeigen“ (nacheinander) oder ein Nebeneinander besser ist, zeigt erst die Leserin. Texte stehen in `shared/locales/de.json` (Sie/du).
2. **Anrede:** Standard ist „Sie“; im Technik-Bereich unter „Einrichten“ umstellbar.
3. **Wo sitzt „Einstellungen“?** In der unteren Leiste zwischen „Zurück“ und der Seitenangabe. Wenn sie dort versehentlich getippt wird, führt „◂ Übersicht“ sofort zurück, ohne etwas zu ändern. Ob ein anderer Platz besser ist, klärt der Test.
4. **Einführung nach Pause:** Sie wird beim Öffnen nicht erneut erzwungen; „Einstellungen → Einführung fortsetzen“ macht an derselben Stelle weiter. Soll sie stattdessen automatisch wiederkommen?
5. Die offenen Fragen aus Auftrag 001 bestehen weiter (außer der Messung am Gerät, die entfällt).

## Abschlussbericht

**Gebaut** (ersetzt eine erste Fassung mit PIN-geschütztem Admin-Bereich, siehe ADR 007)

- Server: Einstellungen in der Datenbank mit Verlauf (`settings_history`, Herkunft je Fassung), `GET/PUT /api/settings` (nur Lese-Werte und Einverständnis), `GET /api/settings/baseline` („Wie am Anfang“), `GET/PUT /api/intro` (Fortschritt der Einführung), Technik-API unter `/api/technik/*` mit Netzprüfung.
- Tablet: Taste „Einstellungen“ (6 Tippziele in der Übersicht), Menü als blätterbare Karten, Seiten für Schrift, Farben, Zeilenabstand, „Wie am Anfang“ und die Bedeutung des Funkelsterns; Vorschau mit echtem Text; ganzseitige Rückfrage; „◂ Übersicht“ verwirft Ungespeichertes.
- Einführung mit 6 Schritten (Willkommen, Schrift, Farben, Blättern üben, Artikel öffnen und zurück, Fertig mit Einverständnis), überspringbar, pausierbar, zweistufiges Speichern; eigene Übungstexte.
- Anrede Sie/du über Varianten in der Locale.
- Technik-Bereich `/technik`: Status, Leseeinstellungen mit Vorschau und Verlauf/Zurücksetzen, Quellen und Rubriken, Interessen, Einrichten (Anrede, Einführung neu starten), Spickzettel mit „Einstellungen“ und Funkelstern.
- ADR 007; README, `deploy/README.md`, `.env.example` angepasst.

**Getestet**

- Unit-Tests u. a.: Netzprüfung (Heimnetz/Tailscale ja, Internet nein), Technik-API ohne PIN, Begrenzung der Werte, nur Lese-Werte vom Tablet, Herkunft Pflicht, „Wie am Anfang“, Verlauf und Zurücksetzen, Anrede/Rubriken nur im Technik-Bereich, Einführungsstand, Sie/du-Vollständigkeit der Locale.
- E2E: Einführung komplett mit Speichern; „Nein, wie vorher“; Pausieren und Fortsetzen; Schrift einstellen mit Rückfrage; Verlassen ohne Speichern; „Wie am Anfang“; Prüfungen nach §14 auf allen Einstellungsseiten bei 40 px; Anrede „du“; Technik-Bereich mit Zurücksetzen; Spickzettel.
- Abnahme 1 und 2 im Browser nachgewiesen; am echten Tablet noch nicht.
