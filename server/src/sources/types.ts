/** Schnittstelle der Quellen-Adapter (SPEC §5.1). */

export type RawItem = {
  /** Original-ID in der Quelle. */
  id: string;
  url: string;
  title: string;
  publishedAt: string;
  section?: string;
  /** Adapter-eigene Daten aus der Liste (z. B. bereits mitgelieferter Inhalt). */
  payload?: unknown;
};

export type RawArticle = {
  originalId: string;
  sourceUrl: string;
  lang: string;
  section?: string;
  title: string;
  publishedAt: string;
  /** Artikelkörper als HTML; die Pipeline bereinigt ihn zu Block[]. */
  html: string;
  /** Anreißer der Quelle als Klartext, falls vorhanden. */
  teaser?: string;
};

export interface SourceAdapter {
  id: string;
  fetchList(): Promise<RawItem[]>;
  fetchArticle(item: RawItem): Promise<RawArticle>;
}
