import { describe, expect, it } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_SECTIONS, type Block } from '@augenblick/shared';
import { fallbackSummary, FALLBACK_SUMMARY_MODEL } from '../src/core/article.ts';
import { AnthropicSummaryProvider } from '../src/core/anthropic.ts';
import { aiUsage, getArticle, latestEdition, openDb } from '../src/core/db.ts';
import { runPipeline, summarizeEdition } from '../src/core/pipeline.ts';
import {
  createSummary,
  loadPrompt,
  ProviderUnavailableError,
  MAX_SUMMARY_WORDS,
  validateSummary,
  type SummaryInput,
  type SummaryProvider,
  type SummaryResult,
} from '../src/core/summary.ts';
import { countWords } from '../src/core/text.ts';
import { DemoAdapter } from '../src/sources/demo.ts';

const SOURCE =
  'Die Stadt Lindenau hat am Samstag ihren Wochenmarkt unter einem neuen Glasdach eröffnet. Rund 40 Stände boten Obst und Gemüse an. Der Bau kostete 1,2 Mio. Euro.';

describe('validateSummary', () => {
  it('nimmt eine gute Kurzfassung an', () => {
    const v = validateSummary(
      'Lindenau hat einen neuen Wochenmarkt mit Glasdach. Dort gibt es 40 Stände mit Obst und Gemüse.',
      SOURCE,
    );
    expect(v).toEqual({
      ok: true,
      text: 'Lindenau hat einen neuen Wochenmarkt mit Glasdach. Dort gibt es 40 Stände mit Obst und Gemüse.',
    });
  });

  it('entfernt Vorspann und Anführungszeichen', () => {
    const v = validateSummary(
      'Kurzfassung: „Der Markt in Lindenau hat jetzt ein Dach aus Glas.“',
      SOURCE,
    );
    expect(v.ok && v.text).toBe('Der Markt in Lindenau hat jetzt ein Dach aus Glas.');
  });

  it.each([
    ['zu lang', `${'Der Markt ist neu und schön. '.repeat(9)}`],
    ['zu viele Sätze', 'Der Markt ist neu. Er hat ein Dach. Es ist aus Glas. Es gibt Obst.'],
    ['Zahl', 'Der Markt in Lindenau hat jetzt 55 Stände mit Obst.'],
    ['Deutsch', 'The market in Lindenau now has a new glass roof and many stalls.'],
    ['Aufzählung', '- Neuer Markt in Lindenau\n- Glasdach für den Markt'],
    ['kurz', 'Neuer Markt.'],
    ['Satz', 'Der Markt in Lindenau hat jetzt ein Dach aus Glas und'],
  ])('weist ab: %s', (_label, text) => {
    expect(validateSummary(text, SOURCE).ok).toBe(false);
  });
});

describe('Fallback-Kurzfassung', () => {
  const para = (...sentences: string[]): Block => ({ type: 'paragraph', sentences });

  it('nimmt die ersten zwei Sätze, wenn sie zusammen höchstens 45 Wörter haben', () => {
    expect(
      fallbackSummary([para('Erster Satz hier.', 'Zweiter Satz da.', 'Dritter.')], 'x')?.text,
    ).toBe('Erster Satz hier. Zweiter Satz da.');
  });

  it('nimmt nur den ersten Satz, wenn beide zu lang wären', () => {
    const long = `${'wort '.repeat(30).trim()}.`;
    expect(fallbackSummary([para(long, long)], 'x')?.text).toBe(long);
  });

  it('kürzt einen überlangen ersten Satz auf 45 Wörter mit „…“', () => {
    const s = fallbackSummary([para(`${'wort '.repeat(60).trim()}.`)], 'x');
    expect(countWords(s?.text ?? '')).toBe(MAX_SUMMARY_WORDS);
    expect(s?.text.endsWith(' …')).toBe(true);
    expect(s?.model).toBe(FALLBACK_SUMMARY_MODEL);
  });
});

class FakeProvider implements SummaryProvider {
  readonly name = 'fake';
  readonly model = 'fake-model';
  calls: { input: SummaryInput; hint?: string }[] = [];
  constructor(private readonly answers: (string | Error)[]) {}
  async summarize(input: SummaryInput, hint?: string): Promise<SummaryResult> {
    this.calls.push({ input, hint });
    const a = this.answers[Math.min(this.calls.length - 1, this.answers.length - 1)];
    if (a instanceof Error) throw a;
    return { text: a ?? '', model: this.model, inputTokens: 100, outputTokens: 20 };
  }
}

const GOOD = 'Lindenau hat einen neuen Wochenmarkt mit Glasdach. Dort gibt es Obst und Gemüse.';
const input: SummaryInput = { title: 'Markt', text: SOURCE, lang: 'de' };

describe('createSummary', () => {
  it('übernimmt eine gültige Antwort', async () => {
    const p = new FakeProvider([GOOD]);
    const r = await createSummary(p, input, () => true);
    expect(r).toMatchObject({ ok: true, text: GOOD, calls: 1, inputTokens: 100 });
  });

  it('versucht es bei ungültiger Antwort genau einmal neu, mit Grund', async () => {
    const p = new FakeProvider(['Der Markt hat 99 Stände und ist neu.', GOOD]);
    const r = await createSummary(p, input, () => true);
    expect(r.ok).toBe(true);
    expect(p.calls[1]?.hint).toMatch(/99/);
  });

  it('gibt nach zwei ungültigen Antworten auf', async () => {
    const p = new FakeProvider(['Zu kurz.']);
    const r = await createSummary(p, input, () => true);
    expect(r).toMatchObject({ ok: false, calls: 2 });
  });

  it('Fehler der API führen zum Fallback, ohne Neuversuch', async () => {
    const p = new FakeProvider([new Error('Netzwerk weg')]);
    const r = await createSummary(p, input, () => true);
    expect(r).toMatchObject({ ok: false, reason: 'Netzwerk weg', calls: 1 });
  });

  it('ruft nicht auf, wenn das Tageslimit erreicht ist', async () => {
    const p = new FakeProvider([GOOD]);
    const r = await createSummary(p, input, () => false);
    expect(r).toMatchObject({ ok: false, calls: 0 });
    expect(p.calls).toHaveLength(0);
  });
});

describe('Prompt', () => {
  it('liegt versioniert unter server/prompts und enthält die Vorgaben aus SPEC §6', () => {
    const prompt = loadPrompt('server/prompts', 'de');
    expect(prompt.version).toBe('1');
    expect(prompt.text).not.toContain('<!--');
    expect(prompt.text).toContain('höchstens 45 Wörter');
    expect(prompt.text).toMatch(/Keine Wertung/i);
    expect(prompt.text).toMatch(/Nur Informationen, die im Artikel stehen/);
    expect(prompt.text).toMatch(/Fremdwörter/);
  });
});

describe('AnthropicSummaryProvider', () => {
  type Params = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
  const message = (
    over: Partial<Anthropic.Beta.Messages.BetaMessage>,
  ): Anthropic.Beta.Messages.BetaMessage =>
    ({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-5-5',
      content: [{ type: 'text', text: GOOD, citations: null }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 812, output_tokens: 64 },
      ...over,
    }) as unknown as Anthropic.Beta.Messages.BetaMessage;

  it('schickt Prompt, Artikel und Einstellungen und liest Text und Verbrauch', async () => {
    const seen: Params[] = [];
    const provider = new AnthropicSummaryProvider({
      model: 'claude-opus-5-5',
      prompt: { text: 'SYSTEM', version: '7' },
      create: async (p) => (seen.push(p), message({})),
    });
    const r = await provider.summarize(input, 'zu lang');
    expect(r).toEqual({
      text: GOOD,
      model: 'claude-opus-5-5 (Prompt v7)',
      inputTokens: 812,
      outputTokens: 64,
    });
    const p = seen[0]!;
    expect(p.model).toBe('claude-opus-5-5');
    expect(p.system).toBe('SYSTEM');
    expect(p.output_config).toEqual({ effort: 'low' });
    expect(p.fallbacks).toBe('default');
    expect(p.betas).toEqual(['server-side-fallback-2026-07-01']);
    const content = String(p.messages[0]?.content);
    expect(content).toContain(`<artikel>\n${SOURCE}\n</artikel>`);
    expect(content).toContain('zu lang');
  });

  it('Schlüssel-, Netz- und Serverfehler gelten als „nicht verfügbar“, nicht als Fehler des Artikels', async () => {
    const make = (err: Error) =>
      new AnthropicSummaryProvider({
        model: 'm',
        prompt: { text: 'S', version: '1' },
        create: async () => Promise.reject(err),
      });
    const auth = new Anthropic.AuthenticationError(
      401,
      undefined,
      'invalid x-api-key',
      new Headers(),
    );
    await expect(make(auth).summarize(input)).rejects.toBeInstanceOf(ProviderUnavailableError);
    await expect(
      make(new Anthropic.APIConnectionError({ message: 'weg' })).summarize(input),
    ).rejects.toBeInstanceOf(ProviderUnavailableError);
    const bad = new Anthropic.BadRequestError(400, undefined, 'kaputt', new Headers());
    await expect(make(bad).summarize(input)).rejects.not.toBeInstanceOf(ProviderUnavailableError);
  });

  it('meldet Ablehnung und abgeschnittene Antworten als Fehler', async () => {
    const refused = new AnthropicSummaryProvider({
      model: 'm',
      prompt: { text: 'S', version: '1' },
      create: async () => message({ stop_reason: 'refusal', content: [] }),
    });
    await expect(refused.summarize(input)).rejects.toThrow(/refusal/);
    const cut = new AnthropicSummaryProvider({
      model: 'm',
      prompt: { text: 'S', version: '1' },
      create: async () => message({ stop_reason: 'max_tokens' }),
    });
    await expect(cut.summarize(input)).rejects.toThrow(/max_tokens/);
  });
});

describe('summarizeEdition', () => {
  const NOW = new Date('2026-10-24T06:00:00.000Z');
  const setup = async () => {
    const db = openDb(':memory:');
    await runPipeline(db, [new DemoAdapter(() => NOW)], {
      sections: DEFAULT_SECTIONS,
      maxArticlesPerRun: 20,
      retentionDays: 7,
      now: () => NOW,
    });
    return db;
  };

  it('ohne KI: jede Karte hat eine Kurzfassung mit höchstens 45 Wörtern (Abnahme M3)', async () => {
    const db = await setup();
    const cards = latestEdition(db).articles;
    expect(cards.length).toBeGreaterThan(0);
    for (const c of cards) {
      expect(c.summary).toBeTruthy();
      expect(countWords(c.summary ?? '')).toBeLessThanOrEqual(MAX_SUMMARY_WORDS);
      expect(c.summaryAi).toBe(false);
    }
  });

  it('erstellt KI-Kurzfassungen für die Ausgabe, einmal pro Artikel', async () => {
    const db = await setup();
    const provider = new FakeProvider([
      'Auf dem Markt in der Stadt gibt es etwas Neues für die Menschen.',
    ]);
    const r = await summarizeEdition(db, { provider, dailyLimit: 40, now: () => NOW });
    expect(r.created).toBe(8);
    const cards = latestEdition(db).articles;
    expect(cards.every((c) => c.summaryAi)).toBe(true);
    expect(getArticle(db, 'demo-markt')?.summary?.model).toBe('fake-model');
    expect(aiUsage(db, '2026-10-24')).toMatchObject({
      calls: 8,
      failures: 0,
      inputTokens: 800,
      outputTokens: 160,
    });
    // Zweiter Lauf: nichts mehr zu tun.
    expect((await summarizeEdition(db, { provider, dailyLimit: 40, now: () => NOW })).calls).toBe(
      0,
    );
  });

  it('hält das Tageslimit ein, der Rest behält die ersten Sätze', async () => {
    const db = await setup();
    const provider = new FakeProvider([
      'Auf dem Markt in der Stadt gibt es etwas Neues für die Menschen.',
    ]);
    const r = await summarizeEdition(db, { provider, dailyLimit: 3, now: () => NOW });
    expect(r.calls).toBe(3);
    expect(latestEdition(db).articles.filter((c) => c.summaryAi)).toHaveLength(3);
    expect(aiUsage(db, '2026-10-24').calls).toBe(3);
  });

  it('falscher Schlüssel: Lauf bricht ab, kein Versuch wird verbraucht', async () => {
    const db = await setup();
    const broken = new FakeProvider([new ProviderUnavailableError('API-Schlüssel ungültig (401)')]);
    for (let i = 0; i < 3; i++) {
      const r = await summarizeEdition(db, { provider: broken, dailyLimit: 100, now: () => NOW });
      expect(r.calls).toBe(1);
    }
    // Schlüssel korrigiert: alle Artikel bekommen ihre Kurzfassung.
    const fixed = new FakeProvider([
      'Auf dem Markt in der Stadt gibt es etwas Neues für die Menschen.',
    ]);
    expect(
      (await summarizeEdition(db, { provider: fixed, dailyLimit: 100, now: () => NOW })).created,
    ).toBe(8);
  });

  it('gibt nach zwei fehlgeschlagenen Läufen pro Artikel auf', async () => {
    const db = await setup();
    const provider = new FakeProvider([new Error('API nicht erreichbar')]);
    await summarizeEdition(db, { provider, dailyLimit: 100, now: () => NOW });
    await summarizeEdition(db, { provider, dailyLimit: 100, now: () => NOW });
    const third = await summarizeEdition(db, { provider, dailyLimit: 100, now: () => NOW });
    expect(third).toMatchObject({ calls: 0, skipped: 8 });
    expect(aiUsage(db, '2026-10-24').failures).toBe(16);
    expect(latestEdition(db).articles.every((c) => !c.summaryAi && c.summary)).toBe(true);
  });
});
