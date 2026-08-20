// src/auth/oauth.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Role, User } from '@prisma/client';

export type OAuthProvider = 'google' | 'vk' | 'mailru';

export const OAUTH_PROVIDERS: OAuthProvider[] = ['google', 'vk', 'mailru'];

interface OAuthProfile {
  providerId: string;
  email: string | null;
  firstName: string;
  lastName: string;
}

@Injectable()
export class OAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  public generateCodeVerifier(): string {
    return randomBytes(32).toString('base64url');
  }

  public buildAuthorizeUrl(
    provider: OAuthProvider,
    state: string,
    codeVerifier?: string,
  ): string {
    const redirectUri = this.redirectUri(provider);

    if (provider === 'google') {
      const params = new URLSearchParams({
        response_type: 'code',
        scope: 'email profile',
        client_id: this.config.get<string>('GOOGLE_CLIENT_ID') ?? '',
        redirect_uri: redirectUri,
        state,
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    if (provider === 'vk') {
      const challenge = createHash('sha256')
        .update(codeVerifier ?? '')
        .digest('base64url');
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: this.config.get<string>('VK_CLIENT_ID') ?? '',
        scope: 'email',
        redirect_uri: redirectUri,
        state,
        code_challenge: challenge,
        code_challenge_method: 's256',
      });
      return `https://id.vk.com/authorize?${params.toString()}`;
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.get<string>('MAILRU_CLIENT_ID') ?? '',
      scope: 'userinfo',
      redirect_uri: redirectUri,
      state,
    });
    return `https://oauth.mail.ru/login?${params.toString()}`;
  }

  public async exchangeAndFetchProfile(
    provider: OAuthProvider,
    code: string,
    codeVerifier?: string,
  ): Promise<OAuthProfile> {
    if (provider === 'google') return this.googleFlow(code);
    if (provider === 'vk') return this.vkFlow(code, codeVerifier);
    return this.mailruFlow(code);
  }

  public async findOrCreateUser(
    provider: OAuthProvider,
    profile: OAuthProfile,
  ): Promise<{ user: Omit<User, 'password'>; isNewUser: boolean }> {
    const existingByProvider = await this.prisma.user.findFirst({
      where: { provider, providerId: profile.providerId },
    });
    if (existingByProvider) {
      return { user: this.withoutPassword(existingByProvider), isNewUser: false };
    }

    const email = profile.email ?? `${provider}_${profile.providerId}@noemail.local`;
    const existingByEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existingByEmail) {
      const linked = existingByEmail.provider
        ? existingByEmail
        : await this.prisma.user.update({
            where: { id: existingByEmail.id },
            data: { provider, providerId: profile.providerId },
          });
      return { user: this.withoutPassword(linked), isNewUser: false };
    }

    const created = await this.prisma.user.create({
      data: {
        email,
        firstName: profile.firstName || provider,
        lastName: profile.lastName || '',
        role: Role.CLIENT,
        provider,
        providerId: profile.providerId,
      },
    });
    return { user: this.withoutPassword(created), isNewUser: true };
  }

  private redirectUri(provider: OAuthProvider): string {
    const base = this.config.get<string>('PUBLIC_API_URL');
    return `${base}/api/auth/${provider}/callback`;
  }

  private withoutPassword(user: User): Omit<User, 'password'> {
    const { password: _password, ...rest } = user;
    return rest;
  }

  private async googleFlow(code: string): Promise<OAuthProfile> {
    const { data: tokenData } = await axios.post(
      'https://oauth2.googleapis.com/token',
      {
        code,
        client_id: this.config.get<string>('GOOGLE_CLIENT_ID'),
        client_secret: this.config.get<string>('GOOGLE_CLIENT_SECRET'),
        redirect_uri: this.redirectUri('google'),
        grant_type: 'authorization_code',
      },
    );
    const { data: profile } = await axios.get(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
    );
    return {
      providerId: profile.sub,
      email: profile.email ?? null,
      firstName: profile.given_name ?? '',
      lastName: profile.family_name ?? '',
    };
  }

  private async vkFlow(code: string, codeVerifier?: string): Promise<OAuthProfile> {
    const { data: tokenData } = await axios.post(
      'https://id.vk.com/oauth2/auth',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        code_verifier: codeVerifier ?? '',
        client_id: this.config.get<string>('VK_CLIENT_ID') ?? '',
        client_secret: this.config.get<string>('VK_CLIENT_SECRET') ?? '',
        redirect_uri: this.redirectUri('vk'),
      }),
    );
    const { data: profile } = await axios.get(
      'https://id.vk.com/oauth2/user_info',
      { params: { access_token: tokenData.access_token } },
    );
    const info = profile.user ?? profile;
    return {
      providerId: String(info.user_id ?? info.id),
      email: info.email ?? null,
      firstName: info.first_name ?? '',
      lastName: info.last_name ?? '',
    };
  }

  private async mailruFlow(code: string): Promise<OAuthProfile> {
    const { data: tokenData } = await axios.post(
      'https://oauth.mail.ru/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.config.get<string>('MAILRU_CLIENT_ID') ?? '',
        client_secret: this.config.get<string>('MAILRU_CLIENT_SECRET') ?? '',
        redirect_uri: this.redirectUri('mailru'),
      }),
    );
    const { data: profile } = await axios.get('https://oauth.mail.ru/userinfo', {
      params: { access_token: tokenData.access_token },
    });
    return {
      providerId: String(profile.id),
      email: profile.email ?? null,
      firstName: profile.first_name ?? '',
      lastName: profile.last_name ?? '',
    };
  }
}
