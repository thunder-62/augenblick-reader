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
  /** Themen für das Interessen-Lernen (SPEC §5.3): Rubrik plus Schlagworte der KI. */
  topics?: string[];
};

/** Kurzform eines Artikels für die Übersicht. */
export type ArticleCard = {
  id: string;
  source: string;
  section?: string;
  lang: string;
  title: string;
  summary?: string;
  /** Kurzfassung von der KI (sonst Anreißer der Quelle bzw. erste Sätze) – mit Funkelstern (SPEC §6). */
  summaryAi?: boolean;
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
  /** Anrede in der Oberfläche der Nutzerin, wird beim Einrichten gewählt (SPEC §8.7). */
  salutation: Salutation;
  /** Einverständnis zum Interessen-Lernen (SPEC §5.3); null = noch nicht gefragt. */
  interestLearning: boolean | null;
  sections: SectionQuota[];
};

export type Salutation = 'sie' | 'du';

/** Woher eine gespeicherte Fassung der Einstellungen stammt. */
export type SettingsSource =
  'nutzerin' | 'einfuehrung' | 'kalibrierung' | 'wie-am-anfang' | 'technik';

export type SettingsVersion = {
  id: number;
  savedAt: string;
  source: SettingsSource;
  settings: Settings;
};

/** Fortschritt der Einführung (SPEC §8.8), pro Gerät auf dem Pi. */
export type IntroState = {
  state: 'neu' | 'pausiert' | 'fertig';
  /** Zuletzt erreichter Schritt (1-basiert). */
  step: number;
};

/** Gelerntes Interesse an einem Thema (SPEC §5.3). */
export type Interest = {
  topic: string;
  /** Gewicht nach Vergessen (Halbwertszeit 30 Tage). */
  weight: number;
};

/** Signal beim Verlassen eines Artikels – daraus werden nur Themen-Punkte, kein Leseprotokoll. */
export type ReadingSignal = {
  articleId: string;
  /** Bis zur letzten Seite gelesen. */
  reachedEnd: boolean;
  /** Sichtbare Zeit im Artikel in Sekunden. */
  seconds: number;
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

/** Konfiguration der Quellen, im Technik-Bereich änderbar. */
export type SourcesConfig = {
  br24FeedUrl: string;
};

export type AiUsage = {
  day: string;
  calls: number;
  failures: number;
  inputTokens: number;
  outputTokens: number;
  /** Kosten in US-Dollar, soweit OpenRouter sie meldet. */
  costUsd: number;
};

export type TechnikStatus = {
  version: string;
  now: string;
  edition: { day: string | null; updatedAt: string | null; articles: number };
  sources: SourceStatus[];
  articles: { total: number; ready: number; failed: number };
  storage: { dbBytes: number; freeBytes: number | null };
  calibratedAt: string | null;
  intro: IntroState;
  ai: {
    /** null: kein API-Schlüssel – Kurzfassungen sind Anreißer bzw. erste Sätze. */
    provider: string | null;
    model: string | null;
    fallbackModel: string | null;
    dailyLimit: number;
    today: AiUsage;
    /** Artikel der aktuellen Ausgabe mit KI-Kurzfassung. */
    editionWithAi: number;
  };
};
