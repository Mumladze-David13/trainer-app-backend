import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AiResponse {
  text: string;
  usage: AiUsage;
}

@Injectable()
export class AiGateway {
  private client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  async complete(systemPrompt: string, userMessage: string): Promise<AiResponse> {
    const message = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
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

  async *stream(
    systemPrompt: string,
    userMessage: string,
  ): AsyncGenerator<string> {
    const stream = this.client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
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
}
