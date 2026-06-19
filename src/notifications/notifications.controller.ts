import { Controller, Patch, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';

@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Patch('fcm-token')
  async saveFcmToken(
    @CurrentUser() user: { id: string },
    @Body() body: { token: string },
  ) {
    return this.notificationsService.saveFcmToken(user.id, body.token);
  }
}
