import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThinkingLevel } from '@google/genai';
import { AiGateway } from './ai.gateway';

function asyncIterable<T>(items: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) yield item;
    },
  };
}

async function collect(gen: AsyncGenerator<string>): Promise<string[]> {
  const results: string[] = [];
  for await (const chunk of gen) results.push(chunk);
  return results;
}

describe('AiGateway', () => {
  const originalEnv = process.env;
  let gateway: AiGateway;
  let mockClient: { messages: { create: jest.Mock; stream: jest.Mock } };
  let mockGemini: { models: { generateContent: jest.Mock; generateContentStream: jest.Mock } };

  beforeEach(async () => {
    process.env = {
      ...originalEnv,
      ANTHROPIC_API_KEY: 'anthropic-key',
      GEMINI_API_KEY: 'gemini-key',
    };
    delete process.env.AI_PROVIDER;
    delete process.env.GEMINI_MODEL;

    mockClient = { messages: { create: jest.fn(), stream: jest.fn() } };
    mockGemini = {
      models: { generateContent: jest.fn(), generateContentStream: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AiGateway],
    }).compile();

    gateway = module.get<AiGateway>(AiGateway);
    (gateway as any).client = mockClient;
    (gateway as any).gemini = mockGemini;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('provider selection', () => {
    it('uses Anthropic when AI_PROVIDER is not set', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'hi' }],
        usage: { input_tokens: 1, output_tokens: 1 },
      });

      await gateway.complete('system', 'user');

      expect(mockClient.messages.create).toHaveBeenCalled();
      expect(mockGemini.models.generateContent).not.toHaveBeenCalled();
    });

    it('accepts AI_PROVIDER in any case', async () => {
      process.env.AI_PROVIDER = ' Gemini ';
      mockGemini.models.generateContent.mockResolvedValue({ text: 'hi' });

      await gateway.complete('system', 'user');

      expect(mockGemini.models.generateContent).toHaveBeenCalled();
    });

    it('throws on unknown AI_PROVIDER', async () => {
      process.env.AI_PROVIDER = 'openai';

      await expect(gateway.complete('system', 'user')).rejects.toThrow(
        'Неизвестный AI_PROVIDER',
      );
    });

    it('throws a clear error when the Anthropic key is missing', async () => {
      delete process.env.ANTHROPIC_API_KEY;

      await expect(gateway.complete('system', 'user')).rejects.toThrow(
        new InternalServerErrorException('ИИ-провайдер не настроен: не задан ANTHROPIC_API_KEY'),
      );
      expect(mockClient.messages.create).not.toHaveBeenCalled();
    });

    it('throws a clear error when the Gemini key is missing', async () => {
      process.env.AI_PROVIDER = 'gemini';
      delete process.env.GEMINI_API_KEY;

      await expect(gateway.complete('system', 'user')).rejects.toThrow(
        'не задан GEMINI_API_KEY',
      );
      expect(mockGemini.models.generateContent).not.toHaveBeenCalled();
    });
  });

  describe('Anthropic', () => {
    it('complete() sends the request and maps text and usage', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'Hello, human!' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      const result = await gateway.complete('You are helpful.', 'Hello, AI!');

      expect(mockClient.messages.create).toHaveBeenCalledWith({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: 'You are helpful.',
        messages: [{ role: 'user', content: 'Hello, AI!' }],
      });
      expect(result).toEqual({
        text: 'Hello, human!',
        usage: { inputTokens: 10, outputTokens: 5 },
      });
    });

    it('complete() returns empty text when the first block is not text', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'tool_use' }],
        usage: { input_tokens: 1, output_tokens: 1 },
      });

      const result = await gateway.complete('system', 'user');

      expect(result.text).toBe('');
    });

    it('completeJson() strips ```json fences', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: '```json\n{"a":1}\n```' }],
        usage: { input_tokens: 1, output_tokens: 1 },
      });

      const result = await gateway.completeJson('system', 'user');

      expect(JSON.parse(result.text)).toEqual({ a: 1 });
    });

    it('stream() yields only text deltas', async () => {
      mockClient.messages.stream.mockReturnValue(
        asyncIterable([
          { type: 'message_start' },
          { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } },
          { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{}' } },
          { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } },
          { type: 'message_stop' },
        ]),
      );

      const results = await collect(gateway.stream('system', 'user'));

      expect(results).toEqual(['Hello', ' world']);
      expect(mockClient.messages.stream).toHaveBeenCalledWith({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: 'system',
        messages: [{ role: 'user', content: 'user' }],
      });
    });
  });

  describe('Gemini', () => {
    beforeEach(() => {
      process.env.AI_PROVIDER = 'gemini';
    });

    it('complete() sends the request with minimal thinking and the default model', async () => {
      mockGemini.models.generateContent.mockResolvedValue({
        text: 'Привет!',
        usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 7, thoughtsTokenCount: 20 },
      });

      const result = await gateway.complete('system', 'Скажи привет');

      expect(mockGemini.models.generateContent).toHaveBeenCalledWith({
        model: 'gemini-3.8-flash',
        contents: 'Скажи привет',
        config: {
          systemInstruction: 'system',
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      // токены размышлений считаются как выходные
      expect(result).toEqual({
        text: 'Привет!',
        usage: { inputTokens: 3, outputTokens: 27 },
      });
    });

    it('uses GEMINI_MODEL when set', async () => {
      process.env.GEMINI_MODEL = 'gemini-3.8-pro';
      mockGemini.models.generateContent.mockResolvedValue({ text: 'ok' });

      await gateway.complete('system', 'user');

      expect(mockGemini.models.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gemini-3.8-pro' }),
      );
    });

    it('complete() tolerates missing text and usage', async () => {
      mockGemini.models.generateContent.mockResolvedValue({});

      const result = await gateway.complete('system', 'user');

      expect(result).toEqual({ text: '', usage: { inputTokens: 0, outputTokens: 0 } });
    });

    it('completeJson() requests application/json', async () => {
      mockGemini.models.generateContent.mockResolvedValue({ text: '{"workouts":[]}' });

      const result = await gateway.completeJson('system', 'user');

      expect(mockGemini.models.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({ responseMimeType: 'application/json' }),
        }),
      );
      expect(JSON.parse(result.text)).toEqual({ workouts: [] });
    });

    it('complete() does not request JSON', async () => {
      mockGemini.models.generateContent.mockResolvedValue({ text: 'ok' });

      await gateway.complete('system', 'user');

      const { config } = mockGemini.models.generateContent.mock.calls[0][0];
      expect(config.responseMimeType).toBeUndefined();
    });

    it('stream() yields non-empty chunk texts', async () => {
      mockGemini.models.generateContentStream.mockResolvedValue(
        asyncIterable([{ text: 'При' }, { text: undefined }, { text: 'вет' }]),
      );

      const results = await collect(gateway.stream('system', 'user'));

      expect(results).toEqual(['При', 'вет']);
      expect(mockClient.messages.stream).not.toHaveBeenCalled();
    });
  });

  describe('completeJsonWithAudio', () => {
    const audio = Buffer.from('fake-m4a-bytes');

    it('sends inline base64 audio with the given mime type and requests JSON (gemini)', async () => {
      process.env.AI_PROVIDER = 'gemini';
      mockGemini.models.generateContent.mockResolvedValue({
        text: '```json\n{"exercises":[]}\n```',
        usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 50 },
      });

      const result = await gateway.completeJsonWithAudio('system', audio, 'audio/mp4', 'подсказка');

      expect(mockGemini.models.generateContent).toHaveBeenCalledWith({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'audio/mp4', data: audio.toString('base64') } },
              { text: 'подсказка' },
            ],
          },
        ],
        config: {
          systemInstruction: 'system',
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
        },
      });
      expect(result).toEqual({
        text: '{"exercises":[]}',
        usage: { inputTokens: 900, outputTokens: 50 },
      });
    });

    it('omits the text part when no user text is given', async () => {
      process.env.AI_PROVIDER = 'gemini';
      mockGemini.models.generateContent.mockResolvedValue({ text: '{}' });

      await gateway.completeJsonWithAudio('system', audio, 'audio/mp4');

      const { contents } = mockGemini.models.generateContent.mock.calls[0][0];
      expect(contents[0].parts).toHaveLength(1);
    });

    it('throws BadRequestException for anthropic', async () => {
      await expect(
        gateway.completeJsonWithAudio('system', audio, 'audio/mp4'),
      ).rejects.toThrow(BadRequestException);
      expect(mockClient.messages.create).not.toHaveBeenCalled();
    });
  });
});
