import { Test, TestingModule } from '@nestjs/testing';
import { AiGateway } from './ai.gateway';

describe('AiGateway', () => {
  let gateway: AiGateway;
  let mockClient: {
    messages: {
      create: jest.Mock;
      stream: jest.Mock;
    };
  };

  beforeEach(async () => {
    mockClient = {
      messages: {
        create: jest.fn(),
        stream: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AiGateway],
    }).compile();

    gateway = module.get<AiGateway>(AiGateway);
    // Replace the private client with our mock
    (gateway as any).client = mockClient;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('complete', () => {
    it('should call client.messages.create with correct parameters', async () => {
      const systemPrompt = 'You are a helpful assistant.';
      const userMessage = 'Hello, AI!';
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'Hello, human!' }],
      });

      await gateway.complete(systemPrompt, userMessage);

      expect(mockClient.messages.create).toHaveBeenCalledWith({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });
    });

    it('should return text from content[0] when type is text', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'Response text' }],
      });

      const result = await gateway.complete('system', 'user message');

      expect(result).toBe('Response text');
    });

    it('should return empty string when content[0] type is not text', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'image', data: 'some-image-data' }],
      });

      const result = await gateway.complete('system', 'user message');

      expect(result).toBe('');
    });

    it('should handle empty content array', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [],
      });

      await expect(gateway.complete('system', 'user message')).rejects.toThrow();
    });
  });

  describe('stream', () => {
    it('should yield text from text_delta chunks', async () => {
      const chunks = [
        { type: 'content_block_start', index: 0 },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } },
        { type: 'content_block_stop' },
      ];

      const asyncIterator = {
        [Symbol.asyncIterator]() {
          let index = 0;
          return {
            async next() {
              if (index < chunks.length) {
                return { value: chunks[index++], done: false };
              }
              return { done: true, value: undefined };
            },
          };
        },
      };

      mockClient.messages.stream.mockReturnValue(asyncIterator);

      const results: string[] = [];
      for await (const chunk of gateway.stream('system', 'user message')) {
        results.push(chunk);
      }

      expect(results).toEqual(['Hello', ' world']);
    });

    it('should skip chunks that are not content_block_delta', async () => {
      const chunks = [
        { type: 'message_start' },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Test' } },
        { type: 'ping' },
        { type: 'message_stop' },
      ];

      const asyncIterator = {
        [Symbol.asyncIterator]() {
          let index = 0;
          return {
            async next() {
              if (index < chunks.length) {
                return { value: chunks[index++], done: false };
              }
              return { done: true, value: undefined };
            },
          };
        },
      };

      mockClient.messages.stream.mockReturnValue(asyncIterator);

      const results: string[] = [];
      for await (const chunk of gateway.stream('system', 'user message')) {
        results.push(chunk);
      }

      expect(results).toEqual(['Test']);
    });

    it('should skip content_block_delta with non-text_delta type', async () => {
      const chunks = [
        { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{}' } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Only this' } },
      ];

      const asyncIterator = {
        [Symbol.asyncIterator]() {
          let index = 0;
          return {
            async next() {
              if (index < chunks.length) {
                return { value: chunks[index++], done: false };
              }
              return { done: true, value: undefined };
            },
          };
        },
      };

      mockClient.messages.stream.mockReturnValue(asyncIterator);

      const results: string[] = [];
      for await (const chunk of gateway.stream('system', 'user message')) {
        results.push(chunk);
      }

      expect(results).toEqual(['Only this']);
    });

    it('should call client.messages.stream with correct parameters', async () => {
      const systemPrompt = 'System prompt';
      const userMessage = 'User message';

      const asyncIterator = {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              return { done: true, value: undefined };
            },
          };
        },
      };

      mockClient.messages.stream.mockReturnValue(asyncIterator);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of gateway.stream(systemPrompt, userMessage)) {
        // iterate to trigger call
      }

      expect(mockClient.messages.stream).toHaveBeenCalledWith({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });
    });
  });
});
