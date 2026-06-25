import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NutritionProfile } from '@prisma/client';
import { CreateNutritionProfileDto } from './dto/create-nutrition-profile.dto';
import { AddMealItemDto } from './dto/add-meal-item.dto';
import { CreateFoodItemDto } from './dto/create-food-item.dto';
import { AddMealDto } from './dto/add-meal.dto';
import { UpdateFoodItemDto } from './dto/update-food-item.dto';
import { UpdateMealDto } from './dto/update-meal.dto';
import { UpdateMealItemDto } from './dto/update-meal-item.dto';

@Injectable()
export class NutritionService {
  constructor(private prisma: PrismaService) {}

  private calculateBMR(profile: NutritionProfile): number {
    const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age;
    return profile.gender === 'male' ? base + 5 : base - 161;
  }

  private calculateTDEE(bmr: number, activityLevel: string): number {
    const multipliers: Record<string, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9,
    };
    return bmr * (multipliers[activityLevel] ?? 1.2);
  }

  private calculateTargetCalories(tdee: number, goal: string, weeklyChange?: number | null): number {
    if (goal === 'lose_fat') return tdee - (weeklyChange ? Math.abs(weeklyChange) * 7700 / 7 : 500);
    if (goal === 'gain_muscle') return tdee + 300;
    return tdee;
  }

  private calculateMacros(calories: number, weightKg: number, goal: string) {
    const proteinG = goal === 'gain_muscle' ? weightKg * 2.0 : weightKg * 1.8;
    const fatG = weightKg * 1.0;
    const carbsG = (calories - proteinG * 4 - fatG * 9) / 4;
    return {
      protein: Math.round(proteinG),
      fat: Math.round(fatG),
      carbs: Math.round(Math.max(carbsG, 50)),
    };
  }

  private async verifyAccess(clientId: string, requesterId: string): Promise<void> {
    if (requesterId === clientId) return;
    const trainerClient = await this.prisma.trainerClient.findFirst({
      where: { clientId, trainerId: requesterId },
    });
    if (!trainerClient) throw new ForbiddenException('Access denied');
  }

  async upsertProfile(dto: CreateNutritionProfileDto, trainerId: string) {
    const trainerClient = await this.prisma.trainerClient.findFirst({
      where: { clientId: dto.clientId, trainerId },
    });
    if (!trainerClient) throw new ForbiddenException('Client not assigned to this trainer');

    return this.prisma.nutritionProfile.upsert({
      where: { clientId: dto.clientId },
      create: {
        clientId: dto.clientId,
        gender: dto.gender,
        age: dto.age,
        weightKg: dto.weightKg,
        heightCm: dto.heightCm,
        activityLevel: dto.activityLevel,
        goal: dto.goal,
        targetWeeklyChange: dto.targetWeeklyChange,
      },
      update: {
        gender: dto.gender,
        age: dto.age,
        weightKg: dto.weightKg,
        heightCm: dto.heightCm,
        activityLevel: dto.activityLevel,
        goal: dto.goal,
        targetWeeklyChange: dto.targetWeeklyChange,
      },
    });
  }

  async getProfile(clientId: string, requesterId: string) {
    await this.verifyAccess(clientId, requesterId);
    const profile = await this.prisma.nutritionProfile.findUnique({ where: { clientId } });
    if (!profile) throw new NotFoundException('Nutrition profile not found');

    const bmr = this.calculateBMR(profile);
    const tdee = this.calculateTDEE(bmr, profile.activityLevel);
    const targetCalories = this.calculateTargetCalories(tdee, profile.goal, profile.targetWeeklyChange);
    const macros = this.calculateMacros(targetCalories, profile.weightKg, profile.goal);

    return {
      profile,
      calculations: {
        bmr: Math.round(bmr),
        tdee: Math.round(tdee),
        targetCalories: Math.round(targetCalories),
        macros,
      },
    };
  }

  async getMealPlan(clientId: string, date: string, requesterId: string) {
    await this.verifyAccess(clientId, requesterId);

    const profile = await this.prisma.nutritionProfile.findUnique({ where: { clientId } });
    if (!profile) throw new NotFoundException('Nutrition profile not found');

    const parsedDate = new Date(date);

    let mealPlan = await this.prisma.mealPlan.findUnique({
      where: { clientId_date: { clientId, date: parsedDate } },
      include: { meals: { include: { items: { include: { foodItem: true } } } } },
    });

    if (!mealPlan) {
      const bmr = this.calculateBMR(profile);
      const tdee = this.calculateTDEE(bmr, profile.activityLevel);
      const targetCalories = this.calculateTargetCalories(tdee, profile.goal, profile.targetWeeklyChange);
      const macros = this.calculateMacros(targetCalories, profile.weightKg, profile.goal);

      mealPlan = await this.prisma.mealPlan.create({
        data: {
          nutritionProfileId: profile.id,
          clientId,
          date: parsedDate,
          targetCalories: Math.round(targetCalories),
          targetProtein: macros.protein,
          targetCarbs: macros.carbs,
          targetFat: macros.fat,
        },
        include: { meals: { include: { items: { include: { foodItem: true } } } } },
      });
    }

    return mealPlan;
  }

  async addMeal(mealPlanId: string, dto: AddMealDto, requesterId: string) {
    const mealPlan = await this.prisma.mealPlan.findUnique({ where: { id: mealPlanId } });
    if (!mealPlan) throw new NotFoundException('Meal plan not found');
    await this.verifyAccess(mealPlan.clientId, requesterId);

    return this.prisma.meal.create({
      data: { mealPlanId, type: dto.type, time: dto.time, notes: dto.notes },
      include: { items: { include: { foodItem: true } } },
    });
  }

  async addMealItem(mealId: string, dto: AddMealItemDto, requesterId: string) {
    const meal = await this.prisma.meal.findUnique({
      where: { id: mealId },
      include: { mealPlan: true },
    });
    if (!meal) throw new NotFoundException('Meal not found');
    await this.verifyAccess(meal.mealPlan.clientId, requesterId);

    const foodItem = await this.prisma.foodItem.findUnique({ where: { id: dto.foodItemId } });
    if (!foodItem) throw new NotFoundException('Food item not found');

    return this.prisma.mealItem.create({
      data: { mealId, foodItemId: dto.foodItemId, amountGrams: dto.amountGrams },
      include: { foodItem: true },
    });
  }

  async removeMealItem(mealItemId: string, requesterId: string) {
    const item = await this.prisma.mealItem.findUnique({
      where: { id: mealItemId },
      include: { meal: { include: { mealPlan: true } } },
    });
    if (!item) throw new NotFoundException('Meal item not found');
    await this.verifyAccess(item.meal.mealPlan.clientId, requesterId);

    return this.prisma.mealItem.delete({ where: { id: mealItemId } });
  }

  async searchFood(query: string, clientId?: string) {
    const items = await this.prisma.foodItem.findMany({
      where: query ? { name: { contains: query, mode: 'insensitive' } } : undefined,
      orderBy: { name: 'asc' },
    });

    if (!clientId) return items.slice(0, 20);

    const usageCounts = await this.prisma.mealItem.groupBy({
      by: ['foodItemId'],
      where: { meal: { mealPlan: { clientId } } },
      _count: { foodItemId: true },
    });

    const countMap = new Map(usageCounts.map((u) => [u.foodItemId, u._count.foodItemId]));

    return items
      .sort((a, b) => {
        const diff = (countMap.get(b.id) ?? 0) - (countMap.get(a.id) ?? 0);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      })
      .slice(0, 20);
  }

  async createFoodItem(dto: CreateFoodItemDto, userId: string) {
    return this.prisma.foodItem.create({
      data: { ...dto, createdBy: userId },
    });
  }

  async getDaySummary(clientId: string, date: string, requesterId: string) {
    await this.verifyAccess(clientId, requesterId);
    const parsedDate = new Date(date);

    const mealPlan = await this.prisma.mealPlan.findUnique({
      where: { clientId_date: { clientId, date: parsedDate } },
      include: { meals: { include: { items: { include: { foodItem: true } } } } },
    });

    if (!mealPlan) {
      return {
        targetCalories: null,
        targetProtein: null,
        targetCarbs: null,
        targetFat: null,
        consumedCalories: 0,
        consumedProtein: 0,
        consumedCarbs: 0,
        consumedFat: 0,
        percentCalories: 0,
        meals: [],
      };
    }

    let consumedCalories = 0, consumedProtein = 0, consumedCarbs = 0, consumedFat = 0;

    const meals = mealPlan.meals.map((meal) => {
      let subCalories = 0, subProtein = 0, subCarbs = 0, subFat = 0;

      const items = meal.items.map((item) => {
        const ratio = item.amountGrams / 100;
        const cal = item.foodItem.caloriesPer100g * ratio;
        const prot = item.foodItem.proteinPer100g * ratio;
        const carb = item.foodItem.carbsPer100g * ratio;
        const fat = item.foodItem.fatPer100g * ratio;
        subCalories += cal; subProtein += prot; subCarbs += carb; subFat += fat;
        return {
          ...item,
          computed: {
            calories: Math.round(cal),
            protein: Math.round(prot),
            carbs: Math.round(carb),
            fat: Math.round(fat),
          },
        };
      });

      consumedCalories += subCalories;
      consumedProtein += subProtein;
      consumedCarbs += subCarbs;
      consumedFat += subFat;

      return {
        id: meal.id,
        type: meal.type,
        time: meal.time,
        notes: meal.notes,
        items,
        subtotal: {
          calories: Math.round(subCalories),
          protein: Math.round(subProtein),
          carbs: Math.round(subCarbs),
          fat: Math.round(subFat),
        },
      };
    });

    return {
      targetCalories: mealPlan.targetCalories,
      targetProtein: mealPlan.targetProtein,
      targetCarbs: mealPlan.targetCarbs,
      targetFat: mealPlan.targetFat,
      consumedCalories: Math.round(consumedCalories),
      consumedProtein: Math.round(consumedProtein),
      consumedCarbs: Math.round(consumedCarbs),
      consumedFat: Math.round(consumedFat),
      percentCalories: mealPlan.targetCalories
        ? Math.round((consumedCalories / mealPlan.targetCalories) * 100)
        : 0,
      meals,
    };
  }

  async updateFoodItem(id: string, dto: UpdateFoodItemDto, userId: string) {
    const foodItem = await this.prisma.foodItem.findUnique({ where: { id } });
    if (!foodItem) throw new NotFoundException('Food item not found');

    return this.prisma.foodItem.update({
      where: { id },
      data: dto,
    });
  }

  async deleteFoodItem(id: string, userId: string) {
    const foodItem = await this.prisma.foodItem.findUnique({ where: { id } });
    if (!foodItem) throw new NotFoundException('Food item not found');

    await this.prisma.foodItem.delete({ where: { id } });
    return { message: 'Food item deleted' };
  }

  async updateMealItem(mealItemId: string, dto: UpdateMealItemDto, requesterId: string) {
    const item = await this.prisma.mealItem.findUnique({
      where: { id: mealItemId },
      include: { meal: { include: { mealPlan: true } } },
    });
    if (!item) throw new NotFoundException('Meal item not found');
    await this.verifyAccess(item.meal.mealPlan.clientId, requesterId);

    return this.prisma.mealItem.update({
      where: { id: mealItemId },
      data: { amountGrams: dto.amountGrams },
      include: { foodItem: true },
    });
  }

  async deleteMeal(mealId: string, requesterId: string) {
    const meal = await this.prisma.meal.findUnique({
      where: { id: mealId },
      include: { mealPlan: true },
    });
    if (!meal) throw new NotFoundException('Meal not found');
    await this.verifyAccess(meal.mealPlan.clientId, requesterId);

    await this.prisma.meal.delete({ where: { id: mealId } });
    return { message: 'Meal deleted' };
  }

  async updateMeal(mealId: string, dto: UpdateMealDto, requesterId: string) {
    const meal = await this.prisma.meal.findUnique({
      where: { id: mealId },
      include: { mealPlan: true },
    });
    if (!meal) throw new NotFoundException('Meal not found');
    await this.verifyAccess(meal.mealPlan.clientId, requesterId);

    return this.prisma.meal.update({
      where: { id: mealId },
      data: dto,
      include: { items: { include: { foodItem: true } } },
    });
  }
}
