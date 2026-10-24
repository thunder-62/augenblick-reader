/** Datenmodell nach SPEC §4. */

export type Block = { type: 'heading'; text: string } | { type: 'paragraph'; sentences: string[] };

export type Summary = {
  /** 2–3 Sätze, einfache Sprache. */
  text: string;
  /** Modellname oder „fallback-erste-saetze" (SPEC §6). */
  model: string;
  createdAt: string;
};

export type ArticleStatus = 'new' | 'ready' | 'failed';

export type Article = {
  /** Stabil, aus Quelle + Original-ID. */
  id: string;
  source: string;
  sourceUrl: string;
  /** BCP-47, z. B. "de". */
  lang: string;
  /** Normalisierte Rubrik, z. B. "inland", "region", "sport". */
  section?: string;
  title: string;
  publishedAt: string;
  fetchedAt: string;
  blocks: Block[];
  summary?: Summary;
  wordCount: number;
  /** Grob, Basis 70 Wörter pro Minute. */
  readingMinutes: number;
  status: ArticleStatus;
};

/** Kurzform eines Artikels für die Übersicht. */
export type ArticleCard = {
  id: string;
  source: string;
  section?: string;
  lang: string;
  title: string;
  summary?: string;
  readingMinutes: number;
  publishedAt: string;
};

export type Edition = {
  /** Kalendertag der Ausgabe (YYYY-MM-DD, Europe/Berlin) oder null, wenn es noch keine gibt. */
  day: string | null;
  updatedAt: string | null;
  articles: ArticleCard[];
};

/** Rubriken-Mix: so viele Artikel aus diesen Rubriken (SPEC §5.2). */
export type SectionQuota = {
  key: string;
  sections: string[];
  count: number;
};

export type Theme = 'dark' | 'light';

/** Einstellungen nach SPEC §7. */
export type Settings = {
  fontSizePx: number;
  lineHeight: number;
  wordSpacingEm: number;
  letterSpacingEm: number;
  fontFamily: 'atkinson' | 'mono';
  theme: Theme;
  maxCharsPerLine: number;
  ttsEnabled: boolean;
  ttsRate: number;
  ttsVoice: string | null;
  tickerMode: boolean;
  lineFocus: boolean;
  fingerFollow: boolean;
  locale: string;
  sections: SectionQuota[];
};

/** Lesezustand, wird auf dem Tablet gehalten (ADR 004). */
export type ReadingState = {
  view: 'overview' | 'article';
  articleId?: string;
  /** Index des ersten Satzes der zuletzt gezeigten Artikelseite. */
  anchor?: number;
  overviewPage?: number;
};

export type SourceStatus = {
  source: string;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
};

export type Health = {
  status: 'ok';
  version: string;
  edition: { day: string | null; updatedAt: string | null; articles: number };
  sources: SourceStatus[];
};

/** Vom Tablet gemeldet, wenn ein Artikel verlassen wird (Nutzungsprotokoll, SPEC §10). */
export type UsageEvent = {
  articleId: string;
  /** Höchste gesehene Seite (1-basiert) und Seitenzahl insgesamt. */
  pagesSeen: number;
  pagesTotal: number;
  /** Sichtbare Lesezeit in Sekunden. */
  seconds: number;
};

export type UsageDay = {
  day: string;
  articles: number;
  pages: number;
  minutes: number;
};

/** Konfiguration der Quellen, im Admin-Bereich änderbar. */
export type SourcesConfig = {
  br24FeedUrl: string;
  usageLogEnabled: boolean;
};

export type AdminStatus = {
  version: string;
  now: string;
  edition: { day: string | null; updatedAt: string | null; articles: number };
  sources: SourceStatus[];
  articles: { total: number; ready: number; failed: number };
  storage: { dbBytes: number; freeBytes: number | null };
  calibratedAt: string | null;
};
