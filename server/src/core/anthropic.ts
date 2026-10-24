/** Standard-Provider für Kurzfassungen: Anthropic Claude API (SPEC §6). */
import Anthropic from '@anthropic-ai/sdk';
import {
  ProviderUnavailableError,
  type Prompt,
  type SummaryInput,
  type SummaryProvider,
  type SummaryResult,
} from './summary.ts';

type CreateParams = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
type Create = (params: CreateParams) => Promise<Anthropic.Beta.Messages.BetaMessage>;

export type AnthropicOptions = {
  model: string;
  prompt: Prompt;
  apiKey?: string;
  /** Für Tests: ersetzt den Aufruf der API. */
  create?: Create;
};

export class SummaryRefusedError extends Error {}

export class AnthropicSummaryProvider implements SummaryProvider {
  readonly name = 'anthropic';
  readonly model: string;
  private readonly create: Create;
  private readonly prompt: Prompt;

  constructor(options: AnthropicOptions) {
    this.model = options.model;
    this.prompt = options.prompt;
    if (options.create) this.create = options.create;
    else {
      const client = new Anthropic({ apiKey: options.apiKey, timeout: 60_000, maxRetries: 2 });
      this.create = (params) => client.beta.messages.create(params);
    }
  }

  private request(input: SummaryInput, note: string): Promise<Anthropic.Beta.Messages.BetaMessage> {
    return this.create({
      model: this.model,
      max_tokens: 16000,
      // Kurzfassen ist eine einfache Aufgabe: wenig Denkaufwand genügt.
      output_config: { effort: 'low' },
      // Lehnt das Modell ab, übernimmt serverseitig ein passendes anderes Modell.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: this.prompt.text,
      messages: [
        {
          role: 'user',
          content: `Titel: ${input.title}\n\n<artikel>\n${input.text}\n</artikel>\n\nSchreibe jetzt die Kurzfassung.${note}`,
        },
      ],
    });
  }

  async summarize(input: SummaryInput, hint?: string): Promise<SummaryResult> {
    const note = hint
      ? `\n\nDie vorige Kurzfassung war ungültig (${hint}). Bitte halte dich genau an die Regeln.`
      : '';
    let response: Anthropic.Beta.Messages.BetaMessage;
    try {
      response = await this.request(input, note);
    } catch (err) {
      throw classify(err);
    }
    if (response.stop_reason === 'refusal')
      throw new SummaryRefusedError('Kurzfassung abgelehnt (refusal)');
    if (response.stop_reason === 'max_tokens')
      throw new Error('Antwort abgeschnitten (max_tokens)');
    const text = response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim();
    return {
      text,
      model: `${response.model} (Prompt v${this.prompt.version})`,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }
}

/**
 * Schlüssel, Rechte, Modellname, Netz, Rate-Limit und Serverfehler liegen nicht am Artikel
 * (typisierte Fehler des SDK, vom Spezifischen zum Allgemeinen).
 */
function classify(err: unknown): Error {
  if (err instanceof Anthropic.AuthenticationError)
    return new ProviderUnavailableError('API-Schlüssel ungültig (401)');
  if (err instanceof Anthropic.PermissionDeniedError)
    return new ProviderUnavailableError('Keine Berechtigung (403)');
  if (err instanceof Anthropic.NotFoundError) {
    return new ProviderUnavailableError(
      'Modell nicht gefunden (404) – AUGENBLICK_SUMMARY_MODEL prüfen',
    );
  }
  if (err instanceof Anthropic.RateLimitError)
    return new ProviderUnavailableError('Rate-Limit erreicht (429)');
  if (err instanceof Anthropic.InternalServerError)
    return new ProviderUnavailableError(`Serverfehler (${err.status})`);
  if (err instanceof Anthropic.APIConnectionError)
    return new ProviderUnavailableError('Keine Verbindung zur API');
  if (err instanceof Anthropic.APIError)
    return new Error(`API-Fehler ${err.status ?? ''}: ${err.message}`);
  return err instanceof Error ? err : new Error(String(err));
}
