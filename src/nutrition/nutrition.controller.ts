import { Controller, Get, Post, Delete, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/roles.decorator';
import { NutritionService } from './nutrition.service';
import { CreateNutritionProfileDto } from './dto/create-nutrition-profile.dto';
import { AddMealItemDto } from './dto/add-meal-item.dto';
import { CreateFoodItemDto } from './dto/create-food-item.dto';
import { AddMealDto } from './dto/add-meal.dto';
import { UpdateFoodItemDto } from './dto/update-food-item.dto';
import { UpdateMealDto } from './dto/update-meal.dto';
import { UpdateMealItemDto } from './dto/update-meal-item.dto';

@ApiTags('Nutrition')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('nutrition')
export class NutritionController {
  constructor(private readonly nutritionService: NutritionService) {}

  @Post('profile')
  @ApiOperation({ summary: 'Создать/обновить профиль питания клиента (тренер)' })
  upsertProfile(@Body() dto: CreateNutritionProfileDto, @CurrentUser() user: any) {
    return this.nutritionService.upsertProfile(dto, user.id);
  }

  @Get('profile/:clientId')
  @ApiOperation({ summary: 'Получить профиль питания с расчётами КБЖУ' })
  getProfile(@Param('clientId') clientId: string, @CurrentUser() user: any) {
    return this.nutritionService.getProfile(clientId, user.id);
  }

  @Get('meal-plan/:clientId')
  @ApiOperation({ summary: 'Получить план питания на дату (создать если нет)' })
  @ApiQuery({ name: 'date', required: true, example: '2026-07-01' })
  getMealPlan(
    @Param('clientId') clientId: string,
    @Query('date') date: string,
    @CurrentUser() user: any,
  ) {
    return this.nutritionService.getMealPlan(clientId, date, user.id);
  }

  @Post('meal-plan/:mealPlanId/meals')
  @ApiOperation({ summary: 'Добавить приём пищи в план' })
  addMeal(
    @Param('mealPlanId') mealPlanId: string,
    @Body() dto: AddMealDto,
    @CurrentUser() user: any,
  ) {
    return this.nutritionService.addMeal(mealPlanId, dto, user.id);
  }

  @Post('meals/:mealId/items')
  @ApiOperation({ summary: 'Добавить продукт в приём пищи' })
  addMealItem(
    @Param('mealId') mealId: string,
    @Body() dto: AddMealItemDto,
    @CurrentUser() user: any,
  ) {
    return this.nutritionService.addMealItem(mealId, dto, user.id);
  }

  @Delete('meal-items/:itemId')
  @ApiOperation({ summary: 'Удалить продукт из приёма пищи' })
  removeMealItem(@Param('itemId') itemId: string, @CurrentUser() user: any) {
    return this.nutritionService.removeMealItem(itemId, user.id);
  }

  @Get('summary/:clientId')
  @ApiOperation({ summary: 'Итоги дня — сколько съедено КБЖУ' })
  @ApiQuery({ name: 'date', required: true, example: '2026-07-01' })
  getDaySummary(
    @Param('clientId') clientId: string,
    @Query('date') date: string,
    @CurrentUser() user: any,
  ) {
    return this.nutritionService.getDaySummary(clientId, date, user.id);
  }

  @Get('food')
  @ApiOperation({ summary: 'Поиск продуктов по названию' })
  @ApiQuery({ name: 'q', required: true })
  searchFood(@Query('q') q: string) {
    return this.nutritionService.searchFood(q);
  }

  @Post('food')
  @ApiOperation({ summary: 'Добавить новый продукт в справочник' })
  createFoodItem(@Body() dto: CreateFoodItemDto, @CurrentUser() user: any) {
    return this.nutritionService.createFoodItem(dto, user.id);
  }

  @Patch('food/:id')
  @ApiOperation({ summary: 'Редактировать продукт в справочнике' })
  updateFoodItem(
    @Param('id') id: string,
    @Body() dto: UpdateFoodItemDto,
    @CurrentUser() user: any,
  ) {
    return this.nutritionService.updateFoodItem(id, dto, user.id);
  }

  @Delete('food/:id')
  @ApiOperation({ summary: 'Удалить продукт из справочника' })
  deleteFoodItem(@Param('id') id: string, @CurrentUser() user: any) {
    return this.nutritionService.deleteFoodItem(id, user.id);
  }

  @Patch('meal-items/:itemId')
  @ApiOperation({ summary: 'Изменить количество грамм продукта в приёме пищи' })
  updateMealItem(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateMealItemDto,
    @CurrentUser() user: any,
  ) {
    return this.nutritionService.updateMealItem(itemId, dto, user.id);
  }

  @Delete('meals/:mealId')
  @ApiOperation({ summary: 'Удалить приём пищи целиком' })
  deleteMeal(@Param('mealId') mealId: string, @CurrentUser() user: any) {
    return this.nutritionService.deleteMeal(mealId, user.id);
  }

  @Patch('meals/:mealId')
  @ApiOperation({ summary: 'Редактировать приём пищи (время, тип, заметки)' })
  updateMeal(
    @Param('mealId') mealId: string,
    @Body() dto: UpdateMealDto,
    @CurrentUser() user: any,
  ) {
    return this.nutritionService.updateMeal(mealId, dto, user.id);
  }
}
