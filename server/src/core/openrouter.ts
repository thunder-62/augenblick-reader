/**
 * KI-Anbindung über OpenRouter (SPEC §6): OpenAI-kompatible Chat-Completions-API.
 * Mit optionalem Ausweich-Modell, wenn das Hauptmodell nicht verfügbar ist.
 */
import type { FetchLike } from './http.ts';
import {
  ProviderUnavailableError,
  type Prompt,
  type SummaryInput,
  type SummaryProvider,
  type SummaryResult,
} from './summary.ts';

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
/** Kennzeichnung bei OpenRouter (HTTP-Referer/X-Title), SPEC §6. */
const REFERER = 'https://github.com/thunder-62/augenblick-reader';
const TITLE = 'Augenblick';

type ChatResponse = {
  model?: string;
  choices?: { message?: { content?: string | null }; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  error?: { message?: string; code?: number | string };
};

export type OpenRouterOptions = {
  apiKey: string;
  model: string;
  fallbackModel?: string | null;
  prompt: Prompt;
  fetch?: FetchLike;
  timeoutMs?: number;
};

export class OpenRouterSummaryProvider implements SummaryProvider {
  readonly name = 'openrouter';
  readonly model: string;

  constructor(private readonly options: OpenRouterOptions) {
    this.model = options.model;
  }

  async summarize(input: SummaryInput, hint?: string): Promise<SummaryResult> {
    try {
      return await this.request(this.options.model, input, hint);
    } catch (err) {
      const fallback = this.options.fallbackModel;
      if (
        !fallback ||
        fallback === this.options.model ||
        !(err instanceof ProviderUnavailableError)
      )
        throw err;
      return this.request(fallback, input, hint);
    }
  }

  private async request(model: string, input: SummaryInput, hint?: string): Promise<SummaryResult> {
    const note = hint
      ? `\n\nDie vorige Antwort war ungültig (${hint}). Bitte halte dich genau an die Regeln.`
      : '';
    const doFetch = this.options.fetch ?? fetch;
    let res: Response;
    try {
      res = await doFetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          'content-type': 'application/json',
          'http-referer': REFERER,
          'x-title': TITLE,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 600,
          // Kosten in der Antwort mitliefern (für den Technik-Status).
          usage: { include: true },
          messages: [
            { role: 'system', content: this.options.prompt.text },
            {
              role: 'user',
              content: `Titel: ${input.title}\n\n<artikel>\n${input.text}\n</artikel>\n\nAntworte jetzt mit dem JSON-Objekt.${note}`,
            },
          ],
        }),
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 60_000),
      });
    } catch (err) {
      throw new ProviderUnavailableError(
        `Keine Verbindung zu OpenRouter (${err instanceof Error ? err.message : String(err)})`,
      );
    }
    const data = (await res.json().catch(() => ({}))) as ChatResponse;
    if (!res.ok) throw classify(res.status, data.error?.message ?? res.statusText);
    if (data.error) throw new Error(`OpenRouter: ${data.error.message ?? 'Fehler'}`);
    const choice = data.choices?.[0];
    if (choice?.finish_reason === 'length') throw new Error('Antwort abgeschnitten (max_tokens)');
    const text = (choice?.message?.content ?? '').trim();
    if (!text) throw new Error('Leere Antwort');
    return {
      text,
      model: `${data.model ?? model} (Prompt v${this.options.prompt.version})`,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      ...(typeof data.usage?.cost === 'number' ? { costUsd: data.usage.cost } : {}),
    };
  }
}

/** Schlüssel, Guthaben, Modell, Rate-Limit und Serverfehler liegen nicht am Artikel. */
function classify(status: number, message: string): Error {
  const m = `${message} (${status})`;
  if (status === 401) return new ProviderUnavailableError(`API-Schlüssel ungültig: ${m}`);
  if (status === 402) return new ProviderUnavailableError(`Kein Guthaben: ${m}`);
  if (status === 403) return new ProviderUnavailableError(`Keine Berechtigung: ${m}`);
  if (status === 404)
    return new ProviderUnavailableError(`Modell nicht gefunden – OPENROUTER_MODEL prüfen: ${m}`);
  if (status === 408 || status === 429)
    return new ProviderUnavailableError(`Überlastet oder Limit erreicht: ${m}`);
  if (status >= 500) return new ProviderUnavailableError(`Serverfehler: ${m}`);
  return new Error(`OpenRouter: ${m}`);
}
