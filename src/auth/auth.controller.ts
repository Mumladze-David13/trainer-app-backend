import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { OAuthService, OAuthProvider, OAUTH_PROVIDERS } from './oauth.service';
import { OAuthStateService, OAuthPlatform } from './oauth-state.service';
import { OAuthExchangeService } from './oauth-exchange.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ExchangeOAuthDto } from './dto/exchange-oauth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly oauthService: OAuthService,
    private readonly oauthState: OAuthStateService,
    private readonly oauthExchange: OAuthExchangeService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Регистрация нового пользователя' })
  @ApiResponse({ status: 201, description: 'Пользователь создан, возвращает JWT' })
  @ApiResponse({ status: 409, description: 'Email уже занят' })
  public async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Вход в систему' })
  @ApiResponse({ status: 200, description: 'Успешный вход, возвращает JWT' })
  @ApiResponse({ status: 401, description: 'Неверный email или пароль' })
  public async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get(':provider')
  @ApiOperation({ summary: 'Редирект на consent-экран OAuth-провайдера' })
  public redirectToProvider(
    @Param('provider') provider: string,
    @Query('platform') platform: string | undefined,
    @Res() res: Response,
  ) {
    if (!this.isKnownProvider(provider)) {
      throw new NotFoundException('Unknown provider');
    }

    const resolvedPlatform: OAuthPlatform = platform === 'web' ? 'web' : 'mobile';
    const codeVerifier =
      provider === 'vk' ? this.oauthService.generateCodeVerifier() : undefined;
    const state = this.oauthState.create({ platform: resolvedPlatform, codeVerifier });
    const url = this.oauthService.buildAuthorizeUrl(provider, state, codeVerifier);
    return res.redirect(url);
  }

  @Get(':provider/callback')
  @ApiOperation({ summary: 'Callback от OAuth-провайдера' })
  public async handleCallback(
    @Param('provider') provider: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    const stateData = state ? this.oauthState.consume(state) : null;
    const platform: OAuthPlatform = stateData?.platform ?? 'mobile';

    try {
      if (!this.isKnownProvider(provider)) throw new Error('unknown_provider');
      if (!code || !stateData) throw new Error('invalid_state');

      const profile = await this.oauthService.exchangeAndFetchProfile(
        provider,
        code,
        stateData.codeVerifier,
      );
      const { user, isNewUser } = await this.oauthService.findOrCreateUser(provider, profile);
      const token = this.authService.generateTokenForUser(user as any);
      const exchangeCode = this.oauthExchange.create({ user, token, isNewUser });
      return res.redirect(this.buildFinalRedirect(platform, { code: exchangeCode }));
    } catch {
      return res.redirect(this.buildFinalRedirect(platform, { error: 'oauth_failed' }));
    }
  }

  @Post('exchange')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Обмен одноразового OAuth-кода на JWT' })
  @ApiResponse({ status: 200, description: '{ user, token, isNewUser }' })
  @ApiResponse({ status: 400, description: 'Код недействителен, истёк или уже использован' })
  public exchange(@Body() dto: ExchangeOAuthDto) {
    const payload = this.oauthExchange.consume(dto.code);
    if (!payload) throw new BadRequestException('Invalid or expired code');
    return payload;
  }

  private isKnownProvider(provider: string): provider is OAuthProvider {
    return (OAUTH_PROVIDERS as string[]).includes(provider);
  }

  private buildFinalRedirect(platform: OAuthPlatform, params: Record<string, string>): string {
    const qs = new URLSearchParams(params).toString();
    if (platform === 'web') {
      const frontend = this.config.get<string>('FRONTEND_URL');
      return `${frontend}/auth_callback.html?${qs}`;
    }
    const scheme = this.config.get<string>('OAUTH_MOBILE_REDIRECT_SCHEME') || 'trainerapp';
    return `${scheme}://auth-callback?${qs}`;
  }
}
