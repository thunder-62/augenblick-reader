/**
 * Bekannte RSS-Feeds (SPEC §5.1, ADR 010). Im Technik-Bereich auswählbar; zusätzlich
 * können eigene Feed-Adressen eingetragen werden. Nur öffentliche Feeds.
 */
export type FeedCatalogEntry = {
  /** Kurzname, unter dem der Feed in der Konfiguration steht. */
  id: string;
  name: string;
  url: string;
  /** Quelle, wie sie auf Karten und im Status erscheint (Locale `sources.<source>`). */
  source: string;
  /** Rubrik der Meldungen, solange der Feed keine Sport-Kategorie meldet. */
  section: string;
  /** Datum der letzten erfolgreichen Prüfung (YYYY-MM-DD) oder null, wenn ungeprüft. */
  checked: string | null;
  note?: string;
};

export const FEED_CATALOG: readonly FeedCatalogEntry[] = [
  {
    id: 'br24-mittelfranken',
    name: 'BR24 Mittelfranken',
    url: 'https://nachrichtenfeeds.br.de/rdf/boards/UZlNk5T',
    source: 'br24',
    section: 'region',
    checked: '2026-10-24',
    note: 'RDF-Feed mit Anreißern; Volltext wird von der Artikelseite geholt. Im Prototyp erprobt.',
  },
  {
    id: 'br24-oberbayern',
    name: 'BR24 Oberbayern',
    url: 'https://nachrichtenfeeds.br.de/rdf/boards/UZlJdUE',
    source: 'br24',
    section: 'region',
    checked: null,
    note: 'Aus einem Feed-Verzeichnis, nicht selbst geprüft.',
  },
  {
    id: 'br24-nachrichten',
    name: 'BR24 Bayern, Deutschland und die Welt',
    url: 'https://feeds.br24.de/rss/nachrichten',
    source: 'br24',
    section: 'region',
    checked: null,
    note: 'Allgemeiner BR24-Feed, aus Feed-Verzeichnissen.',
  },
  {
    id: 'br-meldungen',
    name: 'BR Nachrichten (Kurzmeldungen Bayern)',
    url: 'https://www.br.de/nachrichten/meldungen/nachrichten-bayerischer-rundfunk100~newsRss.xml',
    source: 'br24',
    section: 'region',
    checked: null,
    note: 'Kurze Meldungen, aus einem Feed-Verzeichnis.',
  },
  {
    id: 'br24-wirtschaft',
    name: 'BR24 Wirtschaft',
    url: 'https://nachrichtenfeeds.br.de/rdf/boards/QXAPwyN',
    source: 'br24',
    section: 'wirtschaft',
    checked: null,
    note: 'Aus einem Feed-Verzeichnis, nicht selbst geprüft.',
  },
  {
    id: 'br24-netzwelt',
    name: 'BR24 Netzwelt',
    url: 'https://nachrichtenfeeds.br.de/rdf/boards/QXAPuSB',
    source: 'br24',
    section: 'wissen',
    checked: null,
    note: 'Aus einem Feed-Verzeichnis, nicht selbst geprüft.',
  },
];

/** Standard, solange nichts anderes eingestellt ist. */
export const DEFAULT_FEEDS: readonly string[] = ['br24-mittelfranken'];

/** Höchstens so viele Feeds gleichzeitig (Abrufzeit, Last bei den Anbietern). */
export const MAX_FEEDS = 10;
