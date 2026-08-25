// src/subscription/guards/admin-secret.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AdminSecretGuard implements CanActivate {
  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const secret = request.headers['x-admin-secret'];

    if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
