import { Controller, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth('JWT')
@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Patch('fcm-token')
  @ApiOperation({ summary: 'Сохранить FCM-токен устройства для push-уведомлений' })
  @ApiBody({ schema: { properties: { token: { type: 'string', example: 'fcm-device-token-xxx' } } } })
  @ApiResponse({ status: 200, description: 'Токен сохранён' })
  async saveFcmToken(@CurrentUser() user: { id: string }, @Body() body: { token: string }) {
    return this.notificationsService.saveFcmToken(user.id, body.token);
  }
}
