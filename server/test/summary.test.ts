import { describe, expect, it } from 'vitest';
import { DEFAULT_SECTIONS, DEFAULT_SETTINGS, type Block } from '@augenblick/shared';
import {
  fallbackSummary,
  FALLBACK_SUMMARY_MODEL,
  isAiSummary,
  TEASER_SUMMARY_MODEL,
} from '../src/core/article.ts';
import { OPENROUTER_URL, OpenRouterSummaryProvider } from '../src/core/openrouter.ts';
import { aiUsage, getArticle, latestEdition, openDb } from '../src/core/db.ts';
import {
  runPipeline,
  SUMMARY_CANDIDATES_PER_RUN,
  summarizeCandidates,
  summarizeEdition,
} from '../src/core/pipeline.ts';
import { addTopicPoints, interestRanker, saveSettings } from '../src/core/store.ts';
import {
  cleanTopics,
  createSummary,
  loadPrompt,
  parseSummaryResponse,
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

  it('nimmt zuerst den Anreißer der Quelle (ohne Funkelstern)', () => {
    const s = fallbackSummary(
      [para('Erster Satz hier.')],
      'x',
      '  Der Anreißer der Quelle in fünf Wörtern.  ',
    );
    expect(s).toMatchObject({
      text: 'Der Anreißer der Quelle in fünf Wörtern.',
      model: TEASER_SUMMARY_MODEL,
    });
    expect(isAiSummary(s)).toBe(false);
  });

  it('ein zu kurzer Anreißer zählt nicht', () => {
    expect(fallbackSummary([para('Erster Satz hier.')], 'x', 'Mehr dazu')?.text).toBe(
      'Erster Satz hier.',
    );
  });

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
    return { text: a ?? '', model: this.model, inputTokens: 100, outputTokens: 20, costUsd: 0.001 };
  }
}

const GOOD = 'Lindenau hat einen neuen Wochenmarkt mit Glasdach. Dort gibt es Obst und Gemüse.';
const json = (text: string, topics: string[] = []) =>
  JSON.stringify({ kurzfassung: text, themen: topics });
const input: SummaryInput = { title: 'Markt', text: SOURCE, lang: 'de' };

describe('createSummary', () => {
  it('übernimmt eine gültige Antwort mit Themen', async () => {
    const p = new FakeProvider([json(GOOD, ['Markt', 'Einkaufen'])]);
    const r = await createSummary(p, input, () => true);
    expect(r).toMatchObject({
      ok: true,
      text: GOOD,
      topics: ['Markt', 'Einkaufen'],
      calls: 1,
      inputTokens: 100,
    });
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
    expect(prompt.version).toBe('2');
    expect(prompt.text).toContain('"themen"');
    expect(prompt.text).not.toContain('<!--');
    expect(prompt.text).toContain('höchstens 45 Wörter');
    expect(prompt.text).toMatch(/Keine Wertung/i);
    expect(prompt.text).toMatch(/Nur Informationen, die im Artikel stehen/);
    expect(prompt.text).toMatch(/Fremdwörter/);
  });
});

describe('Antwort lesen: Kurzfassung und Themen', () => {
  it('liest das JSON-Objekt, auch mit Text drumherum', () => {
    expect(
      parseSummaryResponse(
        'Hier: {"kurzfassung": "Ein Satz.", "themen": ["garten", "Natur", "Garten"]}',
      ),
    ).toEqual({
      summary: 'Ein Satz.',
      topics: ['Garten', 'Natur'],
    });
  });

  it('ohne JSON ist die ganze Antwort die Kurzfassung', () => {
    expect(parseSummaryResponse('Nur Text.')).toEqual({ summary: 'Nur Text.', topics: [] });
  });

  it('Schlagworte: höchstens drei, ein bis zwei Wörter, keine Sonderzeichen', () => {
    expect(
      cleanTopics(['Garten', 'Öffentlicher Nahverkehr', 'a b c', '<script>', 'Wetter', 'Sport']),
    ).toEqual(['Garten', 'Öffentlicher Nahverkehr', 'Wetter']);
  });
});

describe('OpenRouterSummaryProvider', () => {
  const PROMPT = { text: 'SYSTEM', version: '2' };
  type Call = { url: string; init: RequestInit; body: Record<string, unknown> };
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const ok = (model = 'test/modell') =>
    reply(200, {
      model,
      choices: [
        {
          message: { content: `{"kurzfassung": "${GOOD}", "themen": ["Markt"]}` },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 812, completion_tokens: 64, cost: 0.0004 },
    });
  function provider(responses: Response[], fallbackModel: string | null = null) {
    const calls: Call[] = [];
    const p = new OpenRouterSummaryProvider({
      apiKey: 'sk-or-test-0123456789abcdef',
      model: 'test/modell',
      fallbackModel,
      prompt: PROMPT,
      fetch: async (url, init = {}) => {
        calls.push({ url, init, body: JSON.parse(String(init.body)) });
        return responses.shift() ?? reply(500, {});
      },
    });
    return { p, calls };
  }

  it('schickt Prompt, Artikel, Kennzeichnung und liest Text, Verbrauch und Kosten', async () => {
    const { p, calls } = provider([ok()]);
    const r = await p.summarize(input, 'zu lang');
    expect(r).toMatchObject({
      model: 'test/modell (Prompt v2)',
      inputTokens: 812,
      outputTokens: 64,
      costUsd: 0.0004,
    });
    expect(parseSummaryResponse(r.text).topics).toEqual(['Markt']);
    const c = calls[0]!;
    expect(c.url).toBe(OPENROUTER_URL);
    const h = c.init.headers as Record<string, string>;
    expect(h.authorization).toBe('Bearer sk-or-test-0123456789abcdef');
    expect(h['x-title']).toBe('Augenblick');
    expect(h['http-referer']).toContain('augenblick-reader');
    expect(c.body.model).toBe('test/modell');
    const messages = c.body.messages as { role: string; content: string }[];
    expect(messages[0]).toEqual({ role: 'system', content: 'SYSTEM' });
    expect(messages[1]?.content).toContain(`<artikel>\n${SOURCE}\n</artikel>`);
    expect(messages[1]?.content).toContain('zu lang');
  });

  it('Schlüssel, Guthaben, Modell, Limit und Server gelten als „nicht verfügbar“', async () => {
    for (const status of [401, 402, 404, 429, 503]) {
      const { p } = provider([reply(status, { error: { message: 'x' } })]);
      await expect(p.summarize(input)).rejects.toBeInstanceOf(ProviderUnavailableError);
    }
    const { p } = provider([reply(400, { error: { message: 'kaputt' } })]);
    await expect(p.summarize(input)).rejects.not.toBeInstanceOf(ProviderUnavailableError);
  });

  it('weicht auf das Ausweich-Modell aus, wenn das Hauptmodell nicht verfügbar ist', async () => {
    const { p, calls } = provider([reply(429, {}), ok('test/ausweich')], 'test/ausweich');
    const r = await p.summarize(input);
    expect(calls.map((c) => c.body.model)).toEqual(['test/modell', 'test/ausweich']);
    expect(r.model).toContain('test/ausweich');
  });

  it('abgeschnittene oder leere Antworten sind Fehler', async () => {
    const cut = provider([
      reply(200, { choices: [{ message: { content: '{' }, finish_reason: 'length' }] }),
    ]);
    await expect(cut.p.summarize(input)).rejects.toThrow(/abgeschnitten/);
    const empty = provider([reply(200, { choices: [{ message: { content: '' } }] })]);
    await expect(empty.p.summarize(input)).rejects.toThrow(/Leer/);
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
      json('Auf dem Markt in der Stadt gibt es etwas Neues für die Menschen.', ['Markt']),
    ]);
    const r = await summarizeEdition(db, { provider, dailyLimit: 40, now: () => NOW });
    expect(r.created).toBe(8);
    const cards = latestEdition(db).articles;
    expect(cards.every((c) => c.summaryAi)).toBe(true);
    expect(getArticle(db, 'demo-markt')?.summary?.model).toBe('fake-model');
    expect(getArticle(db, 'demo-markt')?.topics).toEqual(['Markt']);
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
      json('Auf dem Markt in der Stadt gibt es etwas Neues für die Menschen.', ['Markt']),
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
      json('Auf dem Markt in der Stadt gibt es etwas Neues für die Menschen.', ['Markt']),
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

describe('Schlagworte vor der Auswahl (Auftrag 004, C8)', () => {
  const NOW = new Date('2026-10-24T06:00:00.000Z');
  const CHOR = 'demo-chor';

  /** Gibt dem Chor-Artikel das Schlagwort „Gesang“, allen anderen „Allerlei“. */
  class TopicProvider implements SummaryProvider {
    readonly name = 'fake';
    readonly model = 'fake-model';
    calls = 0;
    async summarize(input: SummaryInput): Promise<SummaryResult> {
      this.calls++;
      const topic = input.title.includes('Chor') ? 'Gesang' : 'Allerlei';
      return {
        text: json('In der Stadt ist etwas passiert, und viele Menschen waren dabei.', [topic]),
        model: this.model,
        inputTokens: 100,
        outputTokens: 20,
        costUsd: 0,
      };
    }
  }

  /** Leserin hat eingewilligt und liest gern über Gesang. */
  const withInterest = () => {
    const db = openDb(':memory:');
    const settings = saveSettings(
      db,
      { interestLearning: true },
      DEFAULT_SETTINGS,
      NOW.toISOString(),
      'einfuehrung',
    );
    addTopicPoints(db, ['Gesang'], 9, NOW);
    return { db, ranker: interestRanker(db, settings, NOW) };
  };

  const run = (db: ReturnType<typeof openDb>, opts: object) =>
    runPipeline(db, [new DemoAdapter(() => NOW)], {
      sections: DEFAULT_SECTIONS,
      maxArticlesPerRun: 20,
      retentionDays: 7,
      now: () => NOW,
      ...opts,
    });

  it('ein Kandidat mit Lieblings-Schlagwort rückt in der neuen Ausgabe vor', async () => {
    // Ohne Kurzfassung vor der Auswahl kennt die Auswahl das Schlagwort noch nicht.
    const before = withInterest();
    await run(before.db, { ranker: before.ranker });
    const late = latestEdition(before.db).articles.map((c) => c.id);

    const after = withInterest();
    const provider = new TopicProvider();
    await run(after.db, {
      ranker: after.ranker,
      beforeEdition: () =>
        summarizeCandidates(after.db, { provider, dailyLimit: 40, now: () => NOW }),
    });
    const early = latestEdition(after.db).articles.map((c) => c.id);

    // Zwei feste Plätze vorn, danach das Lieblingsthema.
    expect(early.indexOf(CHOR)).toBe(2);
    expect(late.indexOf(CHOR)).toBeGreaterThan(2);
    expect(getArticle(after.db, CHOR)?.topics).toEqual(['Gesang']);
    expect(latestEdition(after.db).articles.every((c) => c.summaryAi)).toBe(true);
  });

  it('beachtet die Obergrenze je Lauf und das Tageslimit', async () => {
    const { db } = withInterest();
    await run(db, {});
    const provider = new TopicProvider();
    const r = await summarizeCandidates(db, {
      provider,
      dailyLimit: 40,
      maxArticles: 3,
      now: () => NOW,
    });
    expect(r.calls).toBe(3);
    expect(SUMMARY_CANDIDATES_PER_RUN).toBe(20);
    const limited = await summarizeCandidates(db, { provider, dailyLimit: 4, now: () => NOW });
    expect(limited.calls).toBe(1);
  });

  it('ohne KI-Schlüssel bleibt es beim Ranking nach Rubrik', async () => {
    const { db, ranker } = withInterest();
    await run(db, { ranker });
    expect(latestEdition(db).articles.some((c) => c.summaryAi)).toBe(false);
  });
});
