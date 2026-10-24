/**
 * KI-Kurzfassungen (SPEC §6): nur auf dem Server, einmal pro Artikel, mit Prüfung der Ausgabe,
 * einem Neuversuch und Fallback auf die ersten Sätze. Das Tablet ruft nie eine KI auf.
 */
import { readFileSync } from 'node:fs';
import type { Block } from '@augenblick/shared';
import { countWords } from './text.ts';
import { splitSentences } from './sentences.ts';

export const MAX_SUMMARY_WORDS = 45;

export type SummaryInput = { title: string; text: string; lang: string };
export type SummaryResult = {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

/** Provider-Abstraktion (SPEC §6); Standard ist die Anthropic Claude API. */
export interface SummaryProvider {
  readonly name: string;
  readonly model: string;
  /** `hint`: Grund, warum der vorige Versuch nicht gepasst hat. */
  summarize(input: SummaryInput, hint?: string): Promise<SummaryResult>;
}

export type Prompt = { text: string; version: string };

/**
 * Fehler, der nicht am Artikel liegt (falscher Schlüssel, unbekanntes Modell, Netz, Überlastung).
 * Der Lauf bricht ab, ohne einen Versuch für den Artikel zu zählen; der nächste Lauf versucht es neu.
 */
export class ProviderUnavailableError extends Error {}

/** Lädt `summary.<lang>.md`; der Kommentarkopf mit der Versionsnummer wird nicht mitgeschickt. */
export function loadPrompt(dir: string, lang: string): Prompt {
  const raw = readFileSync(`${dir}/summary.${lang}.md`, 'utf8');
  const version = /Version:\s*([\w.-]+)/.exec(raw)?.[1] ?? '0';
  return { text: raw.replace(/<!--[\s\S]*?-->/g, '').trim(), version };
}

export function articleText(blocks: Block[]): string {
  return blocks.map((b) => (b.type === 'heading' ? b.text : b.sentences.join(' '))).join('\n\n');
}

// prettier-ignore
const GERMAN_WORDS = new Set([
  'der', 'die', 'das', 'und', 'ist', 'in', 'im', 'zu', 'zum', 'zur', 'den', 'dem', 'des', 'mit', 'von',
  'für', 'auf', 'ein', 'eine', 'einen', 'einer', 'nicht', 'sich', 'es', 'auch', 'an', 'am', 'als',
  'nach', 'wird', 'werden', 'wurde', 'hat', 'haben', 'sind', 'bei', 'aus', 'sie', 'er', 'vor', 'über',
  'soll', 'sollen', 'kann', 'können', 'noch', 'nur', 'oder', 'aber', 'wie', 'um', 'mehr', 'seit', 'bis',
]);

export type Validation = { ok: true; text: string } | { ok: false; reason: string };

/** Prüft Länge, Form, Sprache und dass keine Zahlen vorkommen, die nicht im Artikel stehen. */
export function validateSummary(raw: string, source: string): Validation {
  let text = raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(kurzfassung|zusammenfassung)\s*:\s*/i, '')
    .replace(/^["„“»«]+|["“”«»]+$/g, '')
    .trim();
  if (!text) return { ok: false, reason: 'leer' };
  if (
    /(^|\s)(#{1,6}|\*\*|[-*•]\s)/.test(raw.trim().split('\n')[0] ?? '') ||
    /\n\s*[-*•]\s/.test(raw)
  ) {
    return { ok: false, reason: 'Aufzählung oder Formatierung' };
  }
  const words = countWords(text);
  if (words > MAX_SUMMARY_WORDS)
    return { ok: false, reason: `zu lang (${words} Wörter, höchstens ${MAX_SUMMARY_WORDS})` };
  if (words < 6) return { ok: false, reason: 'zu kurz' };
  const sentences = splitSentences(text).length;
  if (sentences > 3) return { ok: false, reason: `zu viele Sätze (${sentences}, höchstens 3)` };
  if (!/[.!?]$/.test(text)) return { ok: false, reason: 'kein vollständiger Satz am Ende' };
  const tokens = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  const german = tokens.filter((t) => GERMAN_WORDS.has(t)).length;
  if (tokens.length && german / tokens.length < 0.12)
    return { ok: false, reason: 'nicht erkennbar Deutsch' };
  const numbers = text.match(/\d+(?:[.,]\d+)*/g) ?? [];
  const sourceDigits = source.replace(/\s/g, '');
  for (const n of numbers) {
    if (!sourceDigits.includes(n))
      return { ok: false, reason: `Zahl „${n}“ steht nicht im Artikel` };
  }
  text = text.replace(/\s+([.,!?])/g, '$1');
  return { ok: true, text };
}

export type SummaryOutcome =
  | {
      ok: true;
      text: string;
      model: string;
      calls: number;
      inputTokens: number;
      outputTokens: number;
    }
  | {
      ok: false;
      reason: string;
      /** Fehler liegt nicht am Artikel (siehe ProviderUnavailableError). */
      unavailable?: boolean;
      calls: number;
      inputTokens: number;
      outputTokens: number;
    };

/** Ein Versuch, bei ungültiger Ausgabe ein Neuversuch mit Hinweis (SPEC §6), sonst Fehlschlag. */
export async function createSummary(
  provider: SummaryProvider,
  input: SummaryInput,
  mayCall: () => boolean,
): Promise<SummaryOutcome> {
  let calls = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let hint: string | undefined;
  let reason = 'Tageslimit erreicht';
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!mayCall()) break;
    calls++;
    let result: SummaryResult;
    try {
      result = await provider.summarize(input, hint);
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
        unavailable: err instanceof ProviderUnavailableError,
        calls,
        inputTokens,
        outputTokens,
      };
    }
    inputTokens += result.inputTokens;
    outputTokens += result.outputTokens;
    const v = validateSummary(result.text, `${input.title} ${input.text}`);
    if (v.ok)
      return { ok: true, text: v.text, model: result.model, calls, inputTokens, outputTokens };
    reason = v.reason;
    hint = v.reason;
  }
  return { ok: false, reason, calls, inputTokens, outputTokens };
}
