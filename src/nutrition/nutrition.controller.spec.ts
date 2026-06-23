import { Test, TestingModule } from '@nestjs/testing';
import { NutritionController } from './nutrition.controller';
import { NutritionService } from './nutrition.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';
import { CreateNutritionProfileDto } from './dto/create-nutrition-profile.dto';
import { AddMealDto } from './dto/add-meal.dto';
import { AddMealItemDto } from './dto/add-meal-item.dto';
import { CreateFoodItemDto } from './dto/create-food-item.dto';

describe('NutritionController', () => {
  let controller: NutritionController;
  let service: NutritionService;

  const mockUser = { id: 'user-1', email: 'test@test.com' };

  const mockNutritionService = {
    upsertProfile: jest.fn(),
    getProfile: jest.fn(),
    getMealPlan: jest.fn(),
    addMeal: jest.fn(),
    addMealItem: jest.fn(),
    removeMealItem: jest.fn(),
    getDaySummary: jest.fn(),
    searchFood: jest.fn(),
    createFoodItem: jest.fn(),
  };

  const mockJwtAuthGuard = {
    canActivate: (context: ExecutionContext) => {
      const request = context.switchToHttp().getRequest();
      request.user = mockUser;
      return true;
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NutritionController],
      providers: [{ provide: NutritionService, useValue: mockNutritionService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<NutritionController>(NutritionController);
    service = module.get<NutritionService>(NutritionService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('upsertProfile', () => {
    const dto: CreateNutritionProfileDto = {
      clientId: 'client-1',
      gender: 'male',
      age: 30,
      weightKg: 80,
      heightCm: 180,
      activityLevel: 'moderate',
      goal: 'gain_muscle',
    };

    it('should call service.upsertProfile with dto and user.id', async () => {
      const expected = { id: 'profile-1', ...dto, dailyCalories: 2500, dailyProtein: 150 };
      mockNutritionService.upsertProfile.mockResolvedValue(expected);

      const result = await controller.upsertProfile(dto, mockUser as any);

      expect(service.upsertProfile).toHaveBeenCalledWith(dto, mockUser.id);
      expect(result).toEqual(expected);
    });

    it('should pass optional targetWeeklyChange to service', async () => {
      const dtoWithTarget = { ...dto, targetWeeklyChange: 0.5 };
      mockNutritionService.upsertProfile.mockResolvedValue({ id: 'profile-1' });

      await controller.upsertProfile(dtoWithTarget, mockUser as any);

      expect(service.upsertProfile).toHaveBeenCalledWith(dtoWithTarget, mockUser.id);
    });

    it('should propagate service errors', async () => {
      mockNutritionService.upsertProfile.mockRejectedValue(new Error('Client not found'));

      await expect(controller.upsertProfile(dto, mockUser as any)).rejects.toThrow('Client not found');
    });
  });

  describe('getProfile', () => {
    it('should call service.getProfile with clientId and user.id', async () => {
      const clientId = 'client-1';
      const expected = {
        id: 'profile-1',
        clientId,
        dailyCalories: 2500,
        dailyProtein: 150,
        dailyCarbs: 300,
        dailyFat: 70,
      };
      mockNutritionService.getProfile.mockResolvedValue(expected);

      const result = await controller.getProfile(clientId, mockUser as any);

      expect(service.getProfile).toHaveBeenCalledWith(clientId, mockUser.id);
      expect(result).toEqual(expected);
    });

    it('should propagate service errors', async () => {
      mockNutritionService.getProfile.mockRejectedValue(new Error('Profile not found'));

      await expect(controller.getProfile('client-1', mockUser as any)).rejects.toThrow('Profile not found');
    });
  });

  describe('getMealPlan', () => {
    it('should call service.getMealPlan with clientId, date and user.id', async () => {
      const clientId = 'client-1';
      const date = '2026-07-01';
      const expected = {
        id: 'plan-1',
        clientId,
        date,
        meals: [],
      };
      mockNutritionService.getMealPlan.mockResolvedValue(expected);

      const result = await controller.getMealPlan(clientId, date, mockUser as any);

      expect(service.getMealPlan).toHaveBeenCalledWith(clientId, date, mockUser.id);
      expect(result).toEqual(expected);
    });

    it('should propagate service errors', async () => {
      mockNutritionService.getMealPlan.mockRejectedValue(new Error('Invalid date'));

      await expect(controller.getMealPlan('client-1', '2026-07-01', mockUser as any)).rejects.toThrow('Invalid date');
    });
  });

  describe('addMeal', () => {
    const dto: AddMealDto = {
      type: 'breakfast',
      time: '08:30',
      notes: 'Завтрак перед тренировкой',
    };

    it('should call service.addMeal with mealPlanId, dto and user.id', async () => {
      const mealPlanId = 'plan-1';
      const expected = {
        id: 'meal-1',
        mealPlanId,
        type: dto.type,
        time: dto.time,
        items: [],
      };
      mockNutritionService.addMeal.mockResolvedValue(expected);

      const result = await controller.addMeal(mealPlanId, dto, mockUser as any);

      expect(service.addMeal).toHaveBeenCalledWith(mealPlanId, dto, mockUser.id);
      expect(result).toEqual(expected);
    });

    it('should pass minimal dto without optional fields', async () => {
      const minimalDto: AddMealDto = { type: 'lunch' };
      mockNutritionService.addMeal.mockResolvedValue({ id: 'meal-1' });

      await controller.addMeal('plan-1', minimalDto, mockUser as any);

      expect(service.addMeal).toHaveBeenCalledWith('plan-1', minimalDto, mockUser.id);
    });

    it('should propagate service errors', async () => {
      mockNutritionService.addMeal.mockRejectedValue(new Error('Meal plan not found'));

      await expect(controller.addMeal('plan-1', dto, mockUser as any)).rejects.toThrow('Meal plan not found');
    });
  });

  describe('addMealItem', () => {
    const dto: AddMealItemDto = {
      foodItemId: 'food-1',
      amountGrams: 150,
    };

    it('should call service.addMealItem with mealId, dto and user.id', async () => {
      const mealId = 'meal-1';
      const expected = {
        id: 'item-1',
        mealId,
        foodItemId: dto.foodItemId,
        amountGrams: dto.amountGrams,
        calories: 200,
        protein: 25,
      };
      mockNutritionService.addMealItem.mockResolvedValue(expected);

      const result = await controller.addMealItem(mealId, dto, mockUser as any);

      expect(service.addMealItem).toHaveBeenCalledWith(mealId, dto, mockUser.id);
      expect(result).toEqual(expected);
    });

    it('should propagate service errors', async () => {
      mockNutritionService.addMealItem.mockRejectedValue(new Error('Food item not found'));

      await expect(controller.addMealItem('meal-1', dto, mockUser as any)).rejects.toThrow('Food item not found');
    });
  });

  describe('removeMealItem', () => {
    it('should call service.removeMealItem with itemId and user.id', async () => {
      const itemId = 'item-1';
      const expected = { success: true };
      mockNutritionService.removeMealItem.mockResolvedValue(expected);

      const result = await controller.removeMealItem(itemId, mockUser as any);

      expect(service.removeMealItem).toHaveBeenCalledWith(itemId, mockUser.id);
      expect(result).toEqual(expected);
    });

    it('should propagate service errors', async () => {
      mockNutritionService.removeMealItem.mockRejectedValue(new Error('Item not found'));

      await expect(controller.removeMealItem('item-1', mockUser as any)).rejects.toThrow('Item not found');
    });
  });

  describe('getDaySummary', () => {
    it('should call service.getDaySummary with clientId, date and user.id', async () => {
      const clientId = 'client-1';
      const date = '2026-07-01';
      const expected = {
        date,
        totalCalories: 2200,
        totalProtein: 140,
        totalCarbs: 280,
        totalFat: 65,
        targetCalories: 2500,
        targetProtein: 150,
      };
      mockNutritionService.getDaySummary.mockResolvedValue(expected);

      const result = await controller.getDaySummary(clientId, date, mockUser as any);

      expect(service.getDaySummary).toHaveBeenCalledWith(clientId, date, mockUser.id);
      expect(result).toEqual(expected);
    });

    it('should propagate service errors', async () => {
      mockNutritionService.getDaySummary.mockRejectedValue(new Error('Profile not found'));

      await expect(controller.getDaySummary('client-1', '2026-07-01', mockUser as any)).rejects.toThrow('Profile not found');
    });
  });

  describe('searchFood', () => {
    it('should call service.searchFood with query string', async () => {
      const query = 'курица';
      const expected = [
        { id: 'food-1', name: 'Куриная грудка', caloriesPer100g: 165 },
        { id: 'food-2', name: 'Куриное филе', caloriesPer100g: 110 },
      ];
      mockNutritionService.searchFood.mockResolvedValue(expected);

      const result = await controller.searchFood(query);

      expect(service.searchFood).toHaveBeenCalledWith(query);
      expect(result).toEqual(expected);
    });

    it('should handle empty search query', async () => {
      mockNutritionService.searchFood.mockResolvedValue([]);

      const result = await controller.searchFood('');

      expect(service.searchFood).toHaveBeenCalledWith('');
      expect(result).toEqual([]);
    });

    it('should propagate service errors', async () => {
      mockNutritionService.searchFood.mockRejectedValue(new Error('Search error'));

      await expect(controller.searchFood('test')).rejects.toThrow('Search error');
    });
  });

  describe('createFoodItem', () => {
    const dto: CreateFoodItemDto = {
      name: 'Куриная грудка',
      caloriesPer100g: 165,
      proteinPer100g: 31,
      carbsPer100g: 0,
      fatPer100g: 3.6,
      category: 'meat',
    };

    it('should call service.createFoodItem with dto and user.id', async () => {
      const expected = { id: 'food-1', ...dto, createdBy: mockUser.id };
      mockNutritionService.createFoodItem.mockResolvedValue(expected);

      const result = await controller.createFoodItem(dto, mockUser as any);

      expect(service.createFoodItem).toHaveBeenCalledWith(dto, mockUser.id);
      expect(result).toEqual(expected);
    });

    it('should pass minimal dto without optional category', async () => {
      const minimalDto: CreateFoodItemDto = {
        name: 'Новый продукт',
        caloriesPer100g: 100,
        proteinPer100g: 10,
        carbsPer100g: 5,
        fatPer100g: 2,
      };
      mockNutritionService.createFoodItem.mockResolvedValue({ id: 'food-1' });

      await controller.createFoodItem(minimalDto, mockUser as any);

      expect(service.createFoodItem).toHaveBeenCalledWith(minimalDto, mockUser.id);
    });

    it('should propagate service errors', async () => {
      mockNutritionService.createFoodItem.mockRejectedValue(new Error('Duplicate food item'));

      await expect(controller.createFoodItem(dto, mockUser as any)).rejects.toThrow('Duplicate food item');
    });
  });
});
