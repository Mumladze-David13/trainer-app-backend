import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  ApiError,
  ContentListUnion,
  GenerateContentConfig,
  GenerateContentResponse,
  GoogleGenAI,
  Part,
  ThinkingLevel,
} from '@google/genai';

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AiResponse {
  text: string;
  usage: AiUsage;
}

type AiProvider = 'anthropic' | 'gemini';

const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_MAX_TOKENS = 2048;
const GEMINI_DEFAULT_MODEL = 'gemini-3.8-flash';
// У Gemini лимит включает токены «размышлений», поэтому берём с запасом
const GEMINI_MAX_TOKENS = 8192;
// Gemini часто отвечает 503 «high demand» на секунды — один повтор спасает большинство запросов
const GEMINI_RETRY_DELAY_MS = 1000;

@Injectable()
export class AiGateway {
  private client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  private gemini: GoogleGenAI | null = null;

  async complete(systemPrompt: string, userMessage: string): Promise<AiResponse> {
    if (this.provider() === 'gemini') {
      return this.geminiComplete(systemPrompt, userMessage, false);
    }
    return this.anthropicComplete(systemPrompt, userMessage);
  }

  // Ответ, который вызывающий код парсит через JSON.parse
  async completeJson(systemPrompt: string, userMessage: string): Promise<AiResponse> {
    const response =
      this.provider() === 'gemini'
        ? await this.geminiComplete(systemPrompt, userMessage, true)
        : await this.anthropicComplete(systemPrompt, userMessage);

    return { ...response, text: stripJsonFence(response.text) };
  }

  // Распознавание речи и разбор одним вызовом — аудио принимает только Gemini
  async completeJsonWithAudio(
    systemPrompt: string,
    audio: Buffer,
    mimeType: string,
    userText?: string,
  ): Promise<AiResponse> {
    if (this.provider() !== 'gemini') {
      throw new BadRequestException(
        'Распознавание аудио доступно только при AI_PROVIDER=gemini',
      );
    }

    const parts: Part[] = [{ inlineData: { mimeType, data: audio.toString('base64') } }];
    if (userText) parts.push({ text: userText });

    const response = await this.geminiGenerate(
      this.geminiRequest(systemPrompt, [{ role: 'user', parts }], true),
    );

    return { text: stripJsonFence(response.text ?? ''), usage: geminiUsage(response) };
  }

  async *stream(
    systemPrompt: string,
    userMessage: string,
  ): AsyncGenerator<string> {
    if (this.provider() === 'gemini') {
      yield* this.geminiStream(systemPrompt, userMessage);
      return;
    }

    this.requireKey('ANTHROPIC_API_KEY');
    const stream = this.client.messages.stream({
      model: ANTHROPIC_MODEL,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    for await (const chunk of stream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        yield chunk.delta.text;
      }
    }
  }

  private provider(): AiProvider {
    const value = (process.env.AI_PROVIDER || 'anthropic').trim().toLowerCase();
    if (value === 'anthropic' || value === 'gemini') return value;
    throw new InternalServerErrorException(
      `Неизвестный AI_PROVIDER: "${value}". Допустимо: anthropic, gemini`,
    );
  }

  private requireKey(name: 'ANTHROPIC_API_KEY' | 'GEMINI_API_KEY'): void {
    if (!process.env[name]) {
      throw new InternalServerErrorException(
        `ИИ-провайдер не настроен: не задан ${name}`,
      );
    }
  }

  private async anthropicComplete(
    systemPrompt: string,
    userMessage: string,
  ): Promise<AiResponse> {
    this.requireKey('ANTHROPIC_API_KEY');
    const message = await this.client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    return {
      text: message.content[0].type === 'text' ? message.content[0].text : '',
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    };
  }

  private geminiClient(): GoogleGenAI {
    this.requireKey('GEMINI_API_KEY');
    if (!this.gemini) {
      this.gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return this.gemini;
  }

  private geminiRequest(systemPrompt: string, contents: ContentListUnion, json: boolean) {
    const config: GenerateContentConfig = {
      systemInstruction: systemPrompt,
      maxOutputTokens: GEMINI_MAX_TOKENS,
      // MINIMAL gemini-3.8-flash не принимает (400), LOW почти не тратит токены на размышления
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    };
    if (json) config.responseMimeType = 'application/json';

    return {
      model: process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL,
      contents,
      config,
    };
  }

  private async geminiComplete(
    systemPrompt: string,
    userMessage: string,
    json: boolean,
  ): Promise<AiResponse> {
    const response = await this.geminiGenerate(
      this.geminiRequest(systemPrompt, userMessage, json),
    );

    return { text: response.text ?? '', usage: geminiUsage(response) };
  }

  private async geminiGenerate(
    request: ReturnType<AiGateway['geminiRequest']>,
  ): Promise<GenerateContentResponse> {
    const client = this.geminiClient();
    try {
      return await client.models.generateContent(request);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 503)) throw geminiHttpError(error);
    }

    await new Promise((resolve) => setTimeout(resolve, GEMINI_RETRY_DELAY_MS));
    try {
      return await client.models.generateContent(request);
    } catch (error) {
      throw geminiHttpError(error);
    }
  }

  private async *geminiStream(
    systemPrompt: string,
    userMessage: string,
  ): AsyncGenerator<string> {
    const stream = await this.geminiClient()
      .models.generateContentStream(this.geminiRequest(systemPrompt, userMessage, false))
      .catch((error) => {
        throw geminiHttpError(error);
      });

    for await (const chunk of stream) {
      if (chunk.text) yield chunk.text;
    }
  }
}

// «Размышления» Gemini оплачиваются как выходные токены
function geminiUsage(response: GenerateContentResponse): AiUsage {
  const meta = response.usageMetadata;
  return {
    inputTokens: meta?.promptTokenCount ?? 0,
    outputTokens: (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0),
  };
}

// Перегрузку и лимиты Gemini отдаём клиенту понятным кодом вместо 500
function geminiHttpError(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;
  if (error.status === 429) {
    return new HttpException(
      'Слишком много запросов к ИИ. Подождите минуту и попробуйте ещё раз.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
  if (error.status === 503) {
    return new ServiceUnavailableException(
      'ИИ-сервис сейчас перегружен. Попробуйте ещё раз через несколько секунд.',
    );
  }
  return error;
}

function stripJsonFence(text: string): string {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
}
