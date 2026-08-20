// src/auth/oauth-state.service.ts
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type OAuthPlatform = 'web' | 'mobile';

export interface OAuthStatePayload {
  platform: OAuthPlatform;
  codeVerifier?: string;
}

// Пользователь проходит consent-экран провайдера вручную, поэтому TTL заметно
// больше, чем у OAuthExchangeService.
const TTL_MS = 5 * 60_000;

@Injectable()
export class OAuthStateService {
  private readonly store = new Map<
    string,
    { payload: OAuthStatePayload; expiresAt: number }
  >();

  public create(payload: OAuthStatePayload): string {
    const state = randomUUID();
    this.store.set(state, { payload, expiresAt: Date.now() + TTL_MS });
    return state;
  }

  public consume(state: string): OAuthStatePayload | null {
    const entry = this.store.get(state);
    if (!entry) return null;
    this.store.delete(state);
    if (entry.expiresAt < Date.now()) return null;
    return entry.payload;
  }
}
