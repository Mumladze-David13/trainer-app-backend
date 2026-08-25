// src/subscription/subscription.controller.ts
import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/roles.decorator';
import { AdminSecretGuard } from './guards/admin-secret.guard';
import { SubscriptionService } from './subscription.service';
import { UpdateTariffDto } from './dto/update-tariff.dto';

@ApiTags('Subscription')
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('price')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Эффективная цена подписки текущего пользователя (с учётом скидки на первый месяц)' })
  @ApiResponse({ status: 200, description: 'role, fullPriceRub, isFirstMonth, chargedRub' })
  getPrice(@CurrentUser() user: any) {
    return this.subscriptionService.getPriceForUser(user.id, user.role);
  }
}

@ApiTags('Subscription Admin')
@ApiHeader({ name: 'X-Admin-Secret', required: true })
@Controller('admin/subscription-tariffs')
@UseGuards(AdminSecretGuard)
export class SubscriptionAdminController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get()
  @ApiOperation({ summary: 'Список всех тарифов подписки' })
  @ApiResponse({ status: 200, description: 'Массив { role, priceRub, updatedAt }' })
  @ApiResponse({ status: 401, description: 'Неверный или отсутствующий X-Admin-Secret' })
  listTariffs() {
    return this.subscriptionService.listTariffs();
  }

  @Put(':role')
  @ApiOperation({ summary: 'Изменить цену тарифа роли' })
  @ApiResponse({ status: 200, description: '{ role, priceRub, updatedAt }' })
  @ApiResponse({ status: 400, description: 'Неизвестная роль или некорректная цена' })
  @ApiResponse({ status: 401, description: 'Неверный или отсутствующий X-Admin-Secret' })
  updateTariff(@Param('role') role: string, @Body() dto: UpdateTariffDto) {
    return this.subscriptionService.updateTariff(role, dto.priceRub);
  }
}
