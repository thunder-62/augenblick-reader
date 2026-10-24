# 004 – Lesezustand liegt auf dem Tablet

**Status:** angenommen (M1) · **Datum:** 24.10.2026

## Kontext

Beim Öffnen der App sollen letzter Artikel und letzte Seite wiederhergestellt werden [R24], und gelesene Artikel bekommen in der Übersicht ein Häkchen (SPEC §8.2). SPEC §4 nennt einen `ReadingState`, legt aber nicht fest, wo er gespeichert wird.

## Entscheidung

- Lesezustand (`view`, `articleId`, Anker, Übersichtsseite) und die Liste gelesener Artikel liegen im `localStorage` des Tablets.
- Gespeichert wird nicht die Seitennummer, sondern der **erste Satz der Seite** („Anker“). Ändert sich der Seitenumbruch (andere Schriftgröße, anderes Schema), landet die Nutzerin trotzdem an der Stelle, an der sie war. Seite 1 wird als `-1` gemerkt, weil sie mit dem Titel beginnt.
- Der Server kennt den Lesezustand in M1 nicht.

## Folgen

- Funktioniert ohne Netz und ohne Server-Roundtrip; passt zu M4 (Offline).
- Wird der Browser-Speicher gelöscht, beginnt die App in der Übersicht – nichts geht kaputt.
- Für das Nutzungsprotokoll im Admin-Bereich (SPEC §10, M2) und für mehrere Geräte pro Server (SPEC §12a) muss der Zustand später zusätzlich an den Server gemeldet werden. Notiert in `docs/ideen.md`.
