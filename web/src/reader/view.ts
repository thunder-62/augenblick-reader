/**
 * Gemeinsamer Lese-Baustein (ADR 023): Fließtext zum Scrollen mit rundem Knopf oben links
 * (ADR 018), Bilder ohne Unterschrift (ADR 021). Genutzt von der Pi-Web-App und von Augenblick
 * für Firefox (SPEC §16.4). Gebaut wird nur über DOM-Aufrufe, nie über `innerHTML`.
 */
import type { Block } from '@augenblick/shared';
import { h, roundButton } from '../dom.ts';

/** Was die Leseansicht braucht – ein Artikel vom Pi oder eine Seite aus dem Browser. */
export type ReadingDoc = {
  title: string;
  lang: string;
  blocks: Block[];
  /** Kleine Zeile über dem Titel (Rubrik und Quelle bzw. Website). */
  meta?: string;
};

export type ReadingOptions = {
  /** Wort unter dem runden Knopf („Übersicht“, „Zur Seite“). */
  backLabel: string;
  /** Zusätzliche Klasse des runden Knopfs (für Tests und Gestaltung). */
  backClass?: string;
  /** Inhalt am Ende des Textes (z. B. „Nächster Artikel“). */
  end?: HTMLElement;
  /** Welche Bildadressen gezeigt werden; andere Bilder entfallen still. */
  imageAllowed: (src: string) => boolean;
};

export type ReadingView = {
  screen: HTMLElement;
  scroller: HTMLElement;
  text: HTMLElement;
  back: HTMLButtonElement;
  /** Oberster Satz, dessen Anfang zu sehen ist; -1 ganz oben. */
  firstVisibleSentence: () => number;
  /** Ist das Ende des Textes erreicht? */
  atEnd: () => boolean;
  /** Bringt einen Satz an den oberen Rand (nach dem Einhängen aufrufen). */
  scrollToSentence: (index: number) => void;
};

/** Typografie ohne Textänderung: „z. B.“, „u. a.“ nicht über Zeilen trennen. */
export function glue(text: string): string {
  return text.replace(/(?<=(?:^|[\s(„"])\p{L}\.) (?=\p{L}\.)/gu, ' ');
}

/** Titel, Zwischenüberschriften, Absätze (Sätze einzeln mit `data-s`) und Bilder. */
export function renderProse(doc: ReadingDoc, imageAllowed: (src: string) => boolean): HTMLElement {
  const out: HTMLElement[] = [];
  if (doc.meta) out.push(h('p', { class: 'meta' }, doc.meta));
  out.push(h('h1', { class: 'title' }, doc.title));
  let count = 0;
  for (const block of doc.blocks) {
    if (block.type === 'image') {
      // Ohne Unterschrift; Maße reservieren den Platz, damit die Lesestelle beim Laden nicht springt.
      if (!imageAllowed(block.src)) continue;
      const img = h('img', {
        src: block.src,
        alt: block.alt ?? '',
        width: block.width,
        height: block.height,
        decoding: 'async',
      });
      out.push(h('figure', { class: 'article-image' }, img));
    } else if (block.type === 'heading') {
      out.push(h('h2', {}, block.text));
    } else {
      const p = h('p');
      block.sentences.forEach((s, i) => {
        if (i > 0) p.append(' ');
        p.append(h('span', { class: 's', 'data-s': count + i }, glue(s)));
      });
      count += block.sentences.length;
      out.push(p);
    }
  }
  return h('article', { class: 'prose flowtext', lang: doc.lang }, ...out);
}

export function readingView(doc: ReadingDoc, opts: ReadingOptions): ReadingView {
  const text = renderProse(doc, opts.imageAllowed);
  const scroller = h('div', { class: 'article-scroll' }, text);
  if (opts.end) scroller.append(h('div', { class: 'article-end' }, opts.end));
  const back = roundButton(opts.backLabel, opts.backClass);
  const screen = h('main', { class: 'screen reading' }, scroller, back);

  const firstVisibleSentence = (): number => {
    if (scroller.scrollTop <= 0) return -1;
    const top = scroller.getBoundingClientRect().top;
    // Die erste Zeile eines Satzes kann mit dem Ende des vorigen geteilt sein: Anfang zählt.
    for (const el of text.querySelectorAll<HTMLElement>('.s')) {
      const start = el.getClientRects()[0];
      if (start && start.top >= top - 1) return Number(el.dataset.s);
    }
    return -1;
  };
  const atEnd = (): boolean =>
    scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
  const scrollToSentence = (index: number): void => {
    const target = index >= 0 ? text.querySelector<HTMLElement>(`[data-s="${index}"]`) : null;
    if (target) scroller.scrollTop = target.offsetTop - text.offsetTop;
  };
  return { screen, scroller, text, back, firstVisibleSentence, atEnd, scrollToSentence };
}
