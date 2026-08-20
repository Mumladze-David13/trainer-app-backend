// src/auth/oauth-exchange.service.ts
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface OAuthExchangePayload {
  user: Record<string, unknown>;
  token: string;
  isNewUser: boolean;
}

const TTL_MS = 60_000;

@Injectable()
export class OAuthExchangeService {
  private readonly store = new Map<
    string,
    { payload: OAuthExchangePayload; expiresAt: number }
  >();

  public create(payload: OAuthExchangePayload): string {
    const code = randomUUID();
    this.store.set(code, { payload, expiresAt: Date.now() + TTL_MS });
    return code;
  }

  public consume(code: string): OAuthExchangePayload | null {
    const entry = this.store.get(code);
    if (!entry) return null;
    this.store.delete(code);
    if (entry.expiresAt < Date.now()) return null;
    return entry.payload;
  }
}
