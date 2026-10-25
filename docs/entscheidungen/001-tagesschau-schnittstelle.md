# 001 – tagesschau: öffentliche JSON-Schnittstelle

**Status:** angenommen (M1) · **Datum:** 24.10.2026

## Kontext

SPEC §5.1 verlangt, vor der Umsetzung Endpunkte und Nutzungsbedingungen der tagesschau-Schnittstelle zu prüfen.

Geprüft wurde die Dokumentation des Projekts bundDev ([github.com/bundesAPI/tagesschau-api](https://github.com/bundesAPI/tagesschau-api), OpenAPI-Beschreibung im selben Repo). Ein Live-Abruf war aus der Entwicklungsumgebung nicht möglich (Netzwerk gesperrt), siehe „Folgen“.

**Endpunkte** (Basis `https://www.tagesschau.de/api2u`):

| Endpunkt | Inhalt |
|---|---|
| `/homepage/` | ausgewählte Meldungen der Startseite der tagesschau-App |
| `/news/?ressort=…&regions=…` | aktuelle Meldungen; Ressorts `inland`, `ausland`, `wirtschaft`, `sport`, `video`, `investigativ`, `wissen`; Regionen 1–16 = Bundesländer (2 = Bayern) |
| `/channels/` | Sendungen (für uns nicht nötig) |
| `/search/?searchText=…` | Suche (für uns nicht nötig) |

Meldungen haben u. a. `sophoraId`, `externalId`, `title`, `topline`, `date`, `ressort`, `type` (`story`, `video`, …), `details` (URL des Detail-JSON), `shareURL`. Der Artikeltext steht als Liste `content` mit typisierten Elementen (`text`, `headline`, `box`, `quotation`, `image_gallery`, `video`, `related`, …); Text-Elemente enthalten HTML in `value`.

**Nutzungsbedingungen** (laut Dokumentation): Nutzung für den **privaten, nicht-kommerziellen Gebrauch** gestattet; Veröffentlichung nicht, außer bei Inhalten unter Creative-Commons-Lizenz; **höchstens 60 Abrufe pro Stunde**.

## Entscheidung

- Augenblick nutzt `/homepage/`, `/news/?ressort=sport` und `/news/?ressort=wissen` als Listen. Liefert die Liste den Inhalt (`content`) mit, wird kein Detail-Abruf gemacht; sonst wird `details` abgerufen.
- Nur `type: story` wird übernommen; aus `content` nur `text` und `headline`. Kästen, Zitat-Kästen, Medien und Linklisten entfallen. Der Hinweis „Über dieses Thema berichtete …“ und „Mehr zum Thema“ werden als Beiwerk entfernt.
- Ein Ratenbegrenzer im Worker erlaubt **höchstens 50 Abrufe pro Stunde** (einstellbar bis 55, nie 60). Bei 34 Läufen am Tag und 3 Listen-Abrufen pro Lauf bleibt genug Spielraum für Detail-Abrufe neuer Meldungen.
- Rubriken werden normalisiert: `inland`, `ausland`, `wirtschaft`, `sport`, `wissen` bleiben, `investigativ` → `inland`. Regionalmeldungen werden seit ADR 020 nicht mehr übernommen.
- Augenblick ist eine private Einzelinstallation für eine Person; Inhalte werden nicht veröffentlicht. Das deckt sich mit den Bedingungen. Für den White-Label-Betrieb (SPEC §12a) ist das **nicht** ausreichend – dort muss jeder Betreiber seine Quellen selbst klären.

## Folgen

- Die Struktur von `content` ist aus der Dokumentation übernommen und mit selbst geschriebenen Testdaten abgesichert. **Am Pi mit echtem Abruf prüfen** (siehe Offene Fragen im Auftrag 001).
- „tagesschau in Einfacher Sprache“ als eigene Rubrik: In der dokumentierten Schnittstelle gibt es dafür kein eigenes Ressort. Ob es über Suche/Tags erreichbar ist, bleibt offen (Auftrag 001, Offene Fragen); vor M3 klären, weil es Stilvorbild für die Kurzfassungen ist [R30].
