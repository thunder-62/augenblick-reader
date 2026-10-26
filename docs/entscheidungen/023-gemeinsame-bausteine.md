# 023 – Gemeinsame Bausteine für Pi und Firefox

**Status:** angenommen · **Datum:** 26.10.2026 · **Bezug:** Auftrag 008, SPEC §16.3, §16.4; ADR 018, 021, 022

## Kontext

Augenblick für Firefox (SPEC §16) soll dieselbe Bereinigung, Satztrennung und Leseansicht nutzen wie der Pi-Teil, nicht nachbauen. Bisher lag die Bereinigung im Server (mit linkedom), die Leseansicht in `web/src/app.ts`.

## Entscheidung

- **Text (`shared/src/text/`, Import `@augenblick/shared/text`):** Bereinigung, Satztrennung und Wortzählung. Die Bereinigung arbeitet auf einem DOM-Element (`elementToBlocks`) und nutzt nur die DOM-Schnittstelle, die linkedom und der Browser beide anbieten. Der Server liest HTML wie bisher mit linkedom ein (`server/src/core/clean.ts`, `htmlToBlocks`) und ruft sie auf.
- **Lese-Baustein (`web/src/reader/`, Import `@augenblick/web/reader` und `@augenblick/web/reader.css`):** Leseansicht als Fließtext mit rundem Knopf (`readingView`), Grund-Styles mit Schrift, Farben, Text und Knopf (`reader.css`), dazu der vorhandene DOM-Bau (`dom.ts`), die Tipp-Logik (`tap.ts`), die Lese-Werte (`settings.ts`), die Texte (`i18n.ts`) und der Wake Lock. Die Web-App nutzt den Baustein für den Artikel; `styles.css` bindet `reader.css` ein.
- **Unterordner statt eigenem Workspace:** Der Baustein bleibt in `web/`, weil er die Web-App-Dateien (`dom.ts`, `tap.ts`, `settings.ts`) unverändert mitbenutzt. Ein eigener Workspace hätte diese Dateien verschieben und alle Importe der Web-App ändern müssen, ohne Gewinn für die Nutzerin. Die Erweiterung importiert nur über `@augenblick/web/reader`, nie direkt aus anderen Dateien der Web-App.
- Was der Baustein zeigt, steuert der Aufrufer: welches Wort unter dem Knopf steht, was am Ende steht und welche Bildadressen erlaubt sind (Pi: nur `/media/…`, Firefox: die Bilder der Seite).

## Folgen

- Änderungen an Leseansicht oder Bereinigung wirken auf beide Formen. Beide Testreihen (Pi-Web-App und Erweiterung) müssen grün bleiben.
- Wird der Baustein größer (Einstellungen und Einführung in F2), kann er später in einen eigenen Workspace umziehen. Dann ist eine neue ADR fällig.
