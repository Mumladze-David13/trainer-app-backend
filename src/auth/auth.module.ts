// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { OAuthService } from './oauth.service';
import { OAuthStateService } from './oauth-state.service';
import { OAuthExchangeService } from './oauth-exchange.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'trainer-app-secret-key',
      signOptions: { expiresIn: '60d' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    OAuthService,
    OAuthStateService,
    OAuthExchangeService,
  ],
  exports: [JwtModule],
})
export class AuthModule {}
