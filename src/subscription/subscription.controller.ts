// src/subscription/subscription.controller.ts
import { Body, Controller, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/roles.decorator';
import { AdminSecretGuard } from './guards/admin-secret.guard';
import { SubscriptionService } from './subscription.service';
import { UpdateTariffDto } from './dto/update-tariff.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';

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

  @Post('pay')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Создать платёж подписки через ЮKassa и получить ссылку на оплату' })
  @ApiResponse({ status: 200, description: '{ paymentId, confirmationUrl }' })
  @ApiResponse({ status: 400, description: 'Некорректный platform' })
  @ApiResponse({ status: 502, description: 'ЮKassa API недоступна' })
  createPayment(@CurrentUser() user: any, @Body() dto: CreatePaymentDto) {
    return this.subscriptionService.createPayment(user.id, user.role, dto.platform);
  }

  @Get('payment/:id/status')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Статус платежа подписки (источник истины — вебхук ЮKassa)' })
  @ApiResponse({ status: 200, description: '{ status: "pending" | "succeeded" | "failed" | "canceled" }' })
  @ApiResponse({ status: 404, description: 'Платёж не найден или принадлежит другому пользователю' })
  getPaymentStatus(@CurrentUser() user: any, @Param('id') id: string) {
    return this.subscriptionService.getPaymentStatus(id, user.id);
  }

  @Post('yookassa-webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Публичный вебхук ЮKassa (без JWT) — уведомления об изменении статуса платежа' })
  @ApiResponse({ status: 200, description: 'Всегда 200, кроме временных сбоев' })
  async handleWebhook(@Body() body: { event?: string; object?: { id?: string } }) {
    await this.subscriptionService.handleYookassaWebhook(body);
    return { received: true };
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
