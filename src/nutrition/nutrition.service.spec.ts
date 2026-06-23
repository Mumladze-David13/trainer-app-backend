import { Test, TestingModule } from '@nestjs/testing';
import { NutritionService } from './nutrition.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('NutritionService', () => {
  let service: NutritionService;

  const mockPrismaService = {
    trainerClient: { findFirst: jest.fn() },
    nutritionProfile: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    mealPlan: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    meal: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    mealItem: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    foodItem: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };

  const CLIENT_ID = 'client-1';
  const TRAINER_ID = 'trainer-1';
  const OTHER_USER_ID = 'other-user';
  const PROFILE_ID = 'profile-1';
  const MEAL_PLAN_ID = 'mealplan-1';
  const MEAL_ID = 'meal-1';
  const MEAL_ITEM_ID = 'mealitem-1';
  const FOOD_ITEM_ID = 'food-1';

  const makeProfile = (overrides = {}) => ({
    id: PROFILE_ID,
    clientId: CLIENT_ID,
    gender: 'male',
    age: 30,
    weightKg: 80,
    heightCm: 180,
    activityLevel: 'moderate',
    goal: 'maintain',
    targetWeeklyChange: null,
    ...overrides,
  });

  const makeMealPlan = (overrides = {}) => ({
    id: MEAL_PLAN_ID,
    nutritionProfileId: PROFILE_ID,
    clientId: CLIENT_ID,
    date: new Date('2026-06-23'),
    targetCalories: 2000,
    targetProtein: 160,
    targetCarbs: 200,
    targetFat: 60,
    meals: [],
    ...overrides,
  });

  const makeMeal = (overrides = {}) => ({
    id: MEAL_ID,
    mealPlanId: MEAL_PLAN_ID,
    type: 'breakfast',
    time: '08:00',
    notes: null,
    items: [],
    mealPlan: makeMealPlan(),
    ...overrides,
  });

  const makeFoodItem = (overrides = {}) => ({
    id: FOOD_ITEM_ID,
    name: 'Куриная грудка',
    caloriesPer100g: 165,
    proteinPer100g: 31,
    carbsPer100g: 0,
    fatPer100g: 3.6,
    createdBy: TRAINER_ID,
    ...overrides,
  });

  const makeMealItem = (overrides = {}) => ({
    id: MEAL_ITEM_ID,
    mealId: MEAL_ID,
    foodItemId: FOOD_ITEM_ID,
    amountGrams: 100,
    foodItem: makeFoodItem(),
    meal: makeMeal(),
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NutritionService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<NutritionService>(NutritionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── calculateBMR (через getProfile) ─────────────────────────────────────

  describe('calculateBMR (via getProfile)', () => {
    beforeEach(() => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({});
    });

    it('calculates BMR for male: 10*80 + 6.25*180 - 5*30 + 5 = 1780', async () => {
      const profile = makeProfile({ gender: 'male', age: 30, weightKg: 80, heightCm: 180 });
      mockPrismaService.nutritionProfile.findUnique.mockResolvedValue(profile);

      const result = await service.getProfile(CLIENT_ID, CLIENT_ID);

      expect(result.calculations.bmr).toBe(1780);
    });

    it('calculates BMR for female: 10*60 + 6.25*165 - 5*25 - 161 = 1470 (rounded)', async () => {
      const profile = makeProfile({ gender: 'female', age: 25, weightKg: 60, heightCm: 165 });
      mockPrismaService.nutritionProfile.findUnique.mockResolvedValue(profile);

      const result = await service.getProfile(CLIENT_ID, CLIENT_ID);

      // 10*60 + 6.25*165 - 5*25 - 161 = 600 + 1031.25 - 125 - 161 = 1345.25 → округляется
      expect(result.calculations.bmr).toBe(1345);
    });
  });

  // ─── calculateTDEE (via getProfile) ──────────────────────────────────────

  describe('calculateTDEE (via getProfile)', () => {
    beforeEach(() => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({});
    });

    it('sedentary: bmr * 1.2', async () => {
      const profile = makeProfile({ activityLevel: 'sedentary', weightKg: 80, heightCm: 180, age: 30, gender: 'male' });
      mockPrismaService.nutritionProfile.findUnique.mockResolvedValue(profile);

      const result = await service.getProfile(CLIENT_ID, CLIENT_ID);

      // BMR = 1780 → TDEE = 1780 * 1.2 = 2136
      expect(result.calculations.tdee).toBe(2136);
    });

    it('light: bmr * 1.375', async () => {
      const profile = makeProfile({ activityLevel: 'light', weightKg: 80, heightCm: 180, age: 30, gender: 'male' });
      mockPrismaService.nutritionProfile.findUnique.mockResolvedValue(profile);

      const result = await service.getProfile(CLIENT_ID, CLIENT_ID);

      // TDEE = 1780 * 1.375 = 2447.5 → округляется до 2448
      expect(result.calculations.tdee).toBe(2448);
    });

    it('moderate: bmr * 1.55', async () => {
      const profile = makeProfile({ activityLevel: 'moderate', weightKg: 80, heightCm: 180, age: 30, gender: 'male' });
      mockPrismaService.nutritionProfile.findUnique.mockResolvedValue(profile);

      const result = await service.getProfile(CLIENT_ID, CLIENT_ID);

      // TDEE = 1780 * 1.55 = 2759
      expect(result.calculations.tdee).toBe(2759);
    });

    it('active: bmr * 1.725', async () => {
      const profile = makeProfile({ activityLevel: 'active', weightKg: 80, heightCm: 180, age: 30, gender: 'male' });
      mockPrismaService.nutritionProfile.findUnique.mockResolvedValue(profile);

      const result = await service.getProfile(CLIENT_ID, CLIENT_ID);

      // TDEE = 1780 * 1.725 = 3070.5 → округляется до 3071
      expect(result.calculations.tdee).toBe(3071);
    });

    it('very_active: bmr * 1.9', async () => {
      const profile = makeProfile({ activityLevel: 'very_active', weightKg: 80, heightCm: 180, age: 30, gender: 'male' });
      mockPrismaService.nutritionProfile.findUnique.mockResolvedValue(profile);

      const result = await service.getProfile(CLIENT_ID, CLIENT_ID);

      // TDEE = 1780 * 1.9 = 3382
      expect(result.calculations.tdee).toBe(3382);
    });
  });

  // ─── calculateTargetCalories (via getProfile) ───────────────────────────

  describe('calculateTargetCalories (via getProfile)', () => {
    beforeEach(() => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({});
    });

    it('lose_fat without weeklyChange: tdee - 500', async () => {
      const profile = makeProfile({ goal: 'lose_fat', targetWeeklyChange: null, activityLevel: 'moderate', weightKg: 80, heightCm: 180, age: 30, gender: 'male' });
      mockPrismaService.nutritionProfile.findUnique.mockResolvedValue(profile);

      const result = await service.getProfile(CLIENT_ID, CLIENT_ID);

      // TDEE = 2759 → targetCalories = 2759 - 500 = 2259
      expect(result.calculations.targetCalories).toBe(2259);
    });

    it('lose_fat with weeklyChange=0.5: tdee - (0.5 * 7700 / 7) = tdee - 550', async () => {
      const profile = makeProfile({ goal: 'lose_fat', targetWeeklyChange: 0.5, activityLevel: 'moderate', weightKg: 80, heightCm: 180, age: 30, gender: 'male' });
      mockPrismaService.nutritionProfile.findUnique.mockResolvedValue(profile);

      const result = await service.getProfile(CLIENT_ID, CLIENT_ID);

      // TDEE = 2759 → targetCalories = 2759 - 550 = 2209
      expect(result.calculations.targetCalories).toBe(2209);
    });

    it('lose_fat with weeklyChange=1: tdee - (1 * 7700 / 7) = tdee - 1100', async () => {
      const profile = makeProfile({ goal: 'lose_fat', targetWeeklyChange: 1, activityLevel: 'moderate', weightKg: 80, heightCm: 180, age: 30, gender: 'male' });
      mockPrismaService.nutritionProfile.findUnique.mockResolvedValue(profile);

      const result = await service.getProfile(CLIENT_ID, CLIENT_ID);

      // TDEE = 2759 → targetCalories = 2759 - 1100 = 1659
      expect(result.calculations.targetCalories).toBe(1659);
    });

    it('gain_muscle: tdee + 300', async () => {
      const profile = makeProfile({ goal: 'gain_muscle', activityLevel: 'moderate', weightKg: 80, heightCm: 180, age: 30, gender: 'male' });
      mockPrismaService.nutritionProfile.findUnique.mockResolvedValue(profile);

      const result = await service.getProfile(CLIENT_ID, CLIENT_ID);

      // TDEE = 2759 → targetCalories = 2759 + 300 = 3059
      expect(result.calculations.targetCalories).toBe(3059);
    });

    it('maintain: tdee', async () => {
      const profile = makeProfile({ goal: 'maintain', activityLevel: 'moderate', weightKg: 80, heightCm: 180, age: 30, gender: 'male' });
      mockPrismaService.nutritionProfile.findUnique.mockResolvedValue(profile);

      const result = await service.getProfile(CLIENT_ID, CLIENT_ID);

      // TDEE = 2759 → targetCalories = 2759
      expect(result.calculations.targetCalories).toBe(2759);
    });
  });

  // ─── calculateMacros (via getProfile) ────────────────────────────────────

  describe('calculateMacros (via getProfile)', () => {
    beforeEach(() => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({});
    });

    it('gain_muscle: protein = weight * 2.0', async () => {
      const profile = makeProfile({ goal: 'gain_muscle', weightKg: 80, activityLevel: 'moderate', heightCm: 180, age: 30, gender: 'male' });
      mockPrismaService.nutritionProfile.findUnique.mockResolvedValue(profile);

      const result = await service.getProfile(CLIENT_ID, CLIENT_ID);

      // protein = 80 * 2.0 = 160
      expect(result.calculations.macros.protein).toBe(160);
    });

    it('lose_fat: protein = weight * 1.8', async () => {
      const profile = makeProfile({ goal: 'lose_fat', weightKg: 80, activityLevel: 'moderate', heightCm: 180, age: 30, gender: 'male' });
      mockPrismaService.nutritionProfile.findUnique.mockResolvedValue(profile);

      const result = await service.getProfile(CLIENT_ID, CLIENT_ID);

      // protein = 80 * 1.8 = 144
      expect(result.calculations.macros.protein).toBe(144);
    });

    it('maintain: protein = weight * 1.8', async () => {
      const profile = makeProfile({ goal: 'maintain', weightKg: 80, activityLevel: 'moderate', heightCm: 180, age: 30, gender: 'male' });
      mockPrismaService.nutritionProfile.findUnique.mockResolvedValue(profile);

      const result = await service.getProfile(CLIENT_ID, CLIENT_ID);

      // protein = 80 * 1.8 = 144
      expect(result.calculations.macros.protein).toBe(144);
    });

    it('fat = weight * 1.0', async () => {
      const profile = makeProfile({ goal: 'maintain', weightKg: 80, activityLevel: 'moderate', heightCm: 180, age: 30, gender: 'male' });
      mockPrismaService.nutritionProfile.findUnique.mockResolvedValue(profile);

      const result = await service.getProfile(CLIENT_ID, CLIENT_ID);

      // fat = 80 * 1.0 = 80
      expect(result.calculations.macros.fat).toBe(80);
    });

    it('carbs = (calories - protein*4 - fat*9) / 4, rounded', async () => {
      const profile = makeProfile({ goal: 'maintain', weightKg: 80, activityLevel: 'moderate', heightCm: 180, age: 30, gender: 'male' });
      mockPrismaService.nutritionProfile.findUnique.mockResolvedValue(profile);

      const result = await service.getProfile(CLIENT_ID, CLIENT_ID);

      // targetCalories = 2759, protein = 144, fat = 80
      // carbs = (2759 - 144*4 - 80*9) / 4 = (2759 - 576 - 720) / 4 = 1463 / 4 = 365.75 → округляется до 366
      expect(result.calculations.macros.carbs).toBe(366);
    });

    it('carbs minimum is 50 when calculated value is negative', async () => {
      // Создаём профиль с очень низкими калориями, чтобы расчёт углеводов был отрицательным
      const profile = makeProfile({ goal: 'lose_fat', weightKg: 80, heightCm: 150, age: 60, activityLevel: 'sedentary', gender: 'female', targetWeeklyChange: 1 });
      mockPrismaService.nutritionProfile.findUnique.mockResolvedValue(profile);

      const result = await service.getProfile(CLIENT_ID, CLIENT_ID);

      // Проверяем, что углеводы не меньше 50
      expect(result.calculations.macros.carbs).toBeGreaterThanOrEqual(50);
    });
  });

  // ─── upsertProfile ───────────────────────────────────────────────────────

  describe('upsertProfile', () => {
    const dto = {
      clientId: CLIENT_ID,
      gender: 'male' as const,
      age: 30,
      weightKg: 80,
      heightCm: 180,
      activityLevel: 'moderate',
      goal: 'gain_muscle',
      targetWeeklyChange: null,
    };

    it('throws ForbiddenException when trainer is not assigned to client', async () => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue(null);

      await expect(service.upsertProfile(dto, TRAINER_ID)).rejects.toThrow(ForbiddenException);
      await expect(service.upsertProfile(dto, TRAINER_ID)).rejects.toThrow('Client not assigned to this trainer');
    });

    it('calls prisma.nutritionProfile.upsert when trainer is assigned', async () => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({ clientId: CLIENT_ID, trainerId: TRAINER_ID });
      mockPrismaService.nutritionProfile.upsert.mockResolvedValue(makeProfile(dto));

      const result = await service.upsertProfile(dto, TRAINER_ID);

      expect(mockPrismaService.nutritionProfile.upsert).toHaveBeenCalledTimes(1);
      expect(result.clientId).toBe(CLIENT_ID);
    });

    it('passes correct data to upsert', async () => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({ clientId: CLIENT_ID, trainerId: TRAINER_ID });
      mockPrismaService.nutritionProfile.upsert.mockResolvedValue(makeProfile(dto));

      await service.upsertProfile(dto, TRAINER_ID);

      const upsertCall = mockPrismaService.nutritionProfile.upsert.mock.calls[0][0];
      expect(upsertCall.where).toEqual({ clientId: CLIENT_ID });
      expect(upsertCall.create.gender).toBe('male');
      expect(upsertCall.create.age).toBe(30);
      expect(upsertCall.update.weightKg).toBe(80);
    });
  });

  // ─── getProfile ──────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('allows client to access their own profile', async () => {
      mockPrismaService.nutritionProfile.findUnique.mockResolvedValue(makeProfile());

      const result = await service.getProfile(CLIENT_ID, CLIENT_ID);

      expect(result.profile.clientId).toBe(CLIENT_ID);
    });

    it('throws ForbiddenException when trainer requests profile of non-assigned client', async () => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue(null);

      await expect(service.getProfile(CLIENT_ID, OTHER_USER_ID)).rejects.toThrow(ForbiddenException);
      await expect(service.getProfile(CLIENT_ID, OTHER_USER_ID)).rejects.toThrow('Access denied');
    });

    it('allows trainer to access profile of assigned client', async () => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({ clientId: CLIENT_ID, trainerId: TRAINER_ID });
      mockPrismaService.nutritionProfile.findUnique.mockResolvedValue(makeProfile());

      const result = await service.getProfile(CLIENT_ID, TRAINER_ID);

      expect(result.profile.clientId).toBe(CLIENT_ID);
    });

    it('throws NotFoundException when profile does not exist', async () => {
      mockPrismaService.nutritionProfile.findUnique.mockResolvedValue(null);

      await expect(service.getProfile(CLIENT_ID, CLIENT_ID)).rejects.toThrow(NotFoundException);
      await expect(service.getProfile(CLIENT_ID, CLIENT_ID)).rejects.toThrow('Nutrition profile not found');
    });

    it('returns profile with calculations (bmr, tdee, targetCalories, macros)', async () => {
      const profile = makeProfile({ activityLevel: 'moderate', weightKg: 80, heightCm: 180, age: 30, gender: 'male', goal: 'maintain' });
      mockPrismaService.nutritionProfile.findUnique.mockResolvedValue(profile);

      const result = await service.getProfile(CLIENT_ID, CLIENT_ID);

      expect(result.profile).toBeDefined();
      expect(result.calculations).toBeDefined();
      expect(result.calculations.bmr).toBeDefined();
      expect(result.calculations.tdee).toBeDefined();
      expect(result.calculations.targetCalories).toBeDefined();
      expect(result.calculations.macros).toBeDefined();
      expect(result.calculations.macros.protein).toBeDefined();
      expect(result.calculations.macros.fat).toBeDefined();
      expect(result.calculations.macros.carbs).toBeDefined();
    });
  });

  // ─── getMealPlan ─────────────────────────────────────────────────────────

  describe('getMealPlan', () => {
    const date = '2026-06-23';

    it('returns existing meal plan when it exists', async () => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({});
      mockPrismaService.nutritionProfile.findUnique.mockResolvedValue(makeProfile());
      const existingPlan = makeMealPlan({ date: new Date(date) });
      mockPrismaService.mealPlan.findUnique.mockResolvedValue(existingPlan);

      const result = await service.getMealPlan(CLIENT_ID, date, CLIENT_ID);

      expect(result.id).toBe(MEAL_PLAN_ID);
      expect(mockPrismaService.mealPlan.create).not.toHaveBeenCalled();
    });

    it('creates new meal plan when it does not exist', async () => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({});
      const profile = makeProfile({ activityLevel: 'moderate', weightKg: 80, heightCm: 180, age: 30, gender: 'male', goal: 'maintain' });
      mockPrismaService.nutritionProfile.findUnique.mockResolvedValue(profile);
      mockPrismaService.mealPlan.findUnique.mockResolvedValue(null);
      const newPlan = makeMealPlan({ date: new Date(date) });
      mockPrismaService.mealPlan.create.mockResolvedValue(newPlan);

      const result = await service.getMealPlan(CLIENT_ID, date, CLIENT_ID);

      expect(mockPrismaService.mealPlan.create).toHaveBeenCalledTimes(1);
      expect(result.id).toBe(MEAL_PLAN_ID);
    });

    it('new meal plan uses target KBJU from profile calculations', async () => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({});
      const profile = makeProfile({ activityLevel: 'moderate', weightKg: 80, heightCm: 180, age: 30, gender: 'male', goal: 'gain_muscle' });
      mockPrismaService.nutritionProfile.findUnique.mockResolvedValue(profile);
      mockPrismaService.mealPlan.findUnique.mockResolvedValue(null);
      mockPrismaService.mealPlan.create.mockResolvedValue(makeMealPlan());

      await service.getMealPlan(CLIENT_ID, date, CLIENT_ID);

      const createCall = mockPrismaService.mealPlan.create.mock.calls[0][0];
      // BMR = 1780, TDEE = 2759, targetCalories = 3059 (gain_muscle)
      // protein = 80*2.0 = 160, fat = 80, carbs = (3059 - 640 - 720) / 4 = 424.75 → 425
      expect(createCall.data.targetCalories).toBe(3059);
      expect(createCall.data.targetProtein).toBe(160);
      expect(createCall.data.targetFat).toBe(80);
      expect(createCall.data.targetCarbs).toBe(425);
    });

    it('throws NotFoundException when profile does not exist', async () => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({});
      mockPrismaService.nutritionProfile.findUnique.mockResolvedValue(null);

      await expect(service.getMealPlan(CLIENT_ID, date, CLIENT_ID)).rejects.toThrow(NotFoundException);
      await expect(service.getMealPlan(CLIENT_ID, date, CLIENT_ID)).rejects.toThrow('Nutrition profile not found');
    });

    it('verifies access before retrieving meal plan', async () => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue(null);

      await expect(service.getMealPlan(CLIENT_ID, OTHER_USER_ID, date)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── addMeal ─────────────────────────────────────────────────────────────

  describe('addMeal', () => {
    const dto = { type: 'lunch', time: '13:00', notes: 'Обед после тренировки' };

    it('throws NotFoundException when meal plan does not exist', async () => {
      mockPrismaService.mealPlan.findUnique.mockResolvedValue(null);

      await expect(service.addMeal(MEAL_PLAN_ID, dto, CLIENT_ID)).rejects.toThrow(NotFoundException);
      await expect(service.addMeal(MEAL_PLAN_ID, dto, CLIENT_ID)).rejects.toThrow('Meal plan not found');
    });

    it('creates meal successfully when meal plan exists and access verified', async () => {
      mockPrismaService.mealPlan.findUnique.mockResolvedValue(makeMealPlan());
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({});
      const newMeal = makeMeal({ type: 'lunch', time: '13:00', notes: 'Обед после тренировки' });
      mockPrismaService.meal.create.mockResolvedValue(newMeal);

      const result = await service.addMeal(MEAL_PLAN_ID, dto, CLIENT_ID);

      expect(mockPrismaService.meal.create).toHaveBeenCalledTimes(1);
      expect(result.type).toBe('lunch');
    });

    it('passes correct data to meal.create', async () => {
      mockPrismaService.mealPlan.findUnique.mockResolvedValue(makeMealPlan());
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({});
      mockPrismaService.meal.create.mockResolvedValue(makeMeal());

      await service.addMeal(MEAL_PLAN_ID, dto, CLIENT_ID);

      const createCall = mockPrismaService.meal.create.mock.calls[0][0];
      expect(createCall.data.mealPlanId).toBe(MEAL_PLAN_ID);
      expect(createCall.data.type).toBe('lunch');
      expect(createCall.data.time).toBe('13:00');
      expect(createCall.data.notes).toBe('Обед после тренировки');
    });

    it('verifies access before creating meal', async () => {
      mockPrismaService.mealPlan.findUnique.mockResolvedValue(makeMealPlan());
      mockPrismaService.trainerClient.findFirst.mockResolvedValue(null);

      await expect(service.addMeal(MEAL_PLAN_ID, dto, OTHER_USER_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── addMealItem ─────────────────────────────────────────────────────────

  describe('addMealItem', () => {
    const dto = { foodItemId: FOOD_ITEM_ID, amountGrams: 200 };

    it('throws NotFoundException when meal does not exist', async () => {
      mockPrismaService.meal.findUnique.mockResolvedValue(null);

      await expect(service.addMealItem(MEAL_ID, dto, CLIENT_ID)).rejects.toThrow(NotFoundException);
      await expect(service.addMealItem(MEAL_ID, dto, CLIENT_ID)).rejects.toThrow('Meal not found');
    });

    it('throws NotFoundException when foodItem does not exist', async () => {
      mockPrismaService.meal.findUnique.mockResolvedValue(makeMeal());
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({});
      mockPrismaService.foodItem.findUnique.mockResolvedValue(null);

      await expect(service.addMealItem(MEAL_ID, dto, CLIENT_ID)).rejects.toThrow(NotFoundException);
      await expect(service.addMealItem(MEAL_ID, dto, CLIENT_ID)).rejects.toThrow('Food item not found');
    });

    it('creates meal item successfully when all entities exist', async () => {
      mockPrismaService.meal.findUnique.mockResolvedValue(makeMeal());
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({});
      mockPrismaService.foodItem.findUnique.mockResolvedValue(makeFoodItem());
      const newMealItem = makeMealItem({ amountGrams: 200 });
      mockPrismaService.mealItem.create.mockResolvedValue(newMealItem);

      const result = await service.addMealItem(MEAL_ID, dto, CLIENT_ID);

      expect(mockPrismaService.mealItem.create).toHaveBeenCalledTimes(1);
      expect(result.amountGrams).toBe(200);
    });

    it('passes correct data to mealItem.create', async () => {
      mockPrismaService.meal.findUnique.mockResolvedValue(makeMeal());
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({});
      mockPrismaService.foodItem.findUnique.mockResolvedValue(makeFoodItem());
      mockPrismaService.mealItem.create.mockResolvedValue(makeMealItem());

      await service.addMealItem(MEAL_ID, dto, CLIENT_ID);

      const createCall = mockPrismaService.mealItem.create.mock.calls[0][0];
      expect(createCall.data.mealId).toBe(MEAL_ID);
      expect(createCall.data.foodItemId).toBe(FOOD_ITEM_ID);
      expect(createCall.data.amountGrams).toBe(200);
    });

    it('verifies access before creating meal item', async () => {
      mockPrismaService.meal.findUnique.mockResolvedValue(makeMeal());
      mockPrismaService.trainerClient.findFirst.mockResolvedValue(null);

      await expect(service.addMealItem(MEAL_ID, dto, OTHER_USER_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── removeMealItem ──────────────────────────────────────────────────────

  describe('removeMealItem', () => {
    it('throws NotFoundException when meal item does not exist', async () => {
      mockPrismaService.mealItem.findUnique.mockResolvedValue(null);

      await expect(service.removeMealItem(MEAL_ITEM_ID, CLIENT_ID)).rejects.toThrow(NotFoundException);
      await expect(service.removeMealItem(MEAL_ITEM_ID, CLIENT_ID)).rejects.toThrow('Meal item not found');
    });

    it('deletes meal item successfully when it exists and access verified', async () => {
      mockPrismaService.mealItem.findUnique.mockResolvedValue(makeMealItem());
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({});
      mockPrismaService.mealItem.delete.mockResolvedValue(makeMealItem());

      const result = await service.removeMealItem(MEAL_ITEM_ID, CLIENT_ID);

      expect(mockPrismaService.mealItem.delete).toHaveBeenCalledTimes(1);
      expect(result.id).toBe(MEAL_ITEM_ID);
    });

    it('passes correct id to mealItem.delete', async () => {
      mockPrismaService.mealItem.findUnique.mockResolvedValue(makeMealItem());
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({});
      mockPrismaService.mealItem.delete.mockResolvedValue(makeMealItem());

      await service.removeMealItem(MEAL_ITEM_ID, CLIENT_ID);

      const deleteCall = mockPrismaService.mealItem.delete.mock.calls[0][0];
      expect(deleteCall.where.id).toBe(MEAL_ITEM_ID);
    });

    it('verifies access before deleting meal item', async () => {
      mockPrismaService.mealItem.findUnique.mockResolvedValue(makeMealItem());
      mockPrismaService.trainerClient.findFirst.mockResolvedValue(null);

      await expect(service.removeMealItem(MEAL_ITEM_ID, OTHER_USER_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── getDaySummary ───────────────────────────────────────────────────────

  describe('getDaySummary', () => {
    const date = '2026-06-23';

    it('returns empty summary when meal plan does not exist', async () => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({});
      mockPrismaService.mealPlan.findUnique.mockResolvedValue(null);

      const result = await service.getDaySummary(CLIENT_ID, date, CLIENT_ID);

      expect(result.targetCalories).toBeNull();
      expect(result.targetProtein).toBeNull();
      expect(result.targetCarbs).toBeNull();
      expect(result.targetFat).toBeNull();
      expect(result.consumedCalories).toBe(0);
      expect(result.consumedProtein).toBe(0);
      expect(result.consumedCarbs).toBe(0);
      expect(result.consumedFat).toBe(0);
      expect(result.percentCalories).toBe(0);
      expect(result.meals).toEqual([]);
    });

    it('correctly sums KBJU from meal items', async () => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({});

      // Создаём мок: 2 приёма пищи с продуктами
      const foodItem1 = makeFoodItem({ id: 'food-1', name: 'Куриная грудка', caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6 });
      const foodItem2 = makeFoodItem({ id: 'food-2', name: 'Рис', caloriesPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28, fatPer100g: 0.3 });

      const mealItem1 = { id: 'mi-1', mealId: 'meal-1', foodItemId: 'food-1', amountGrams: 200, foodItem: foodItem1 };
      const mealItem2 = { id: 'mi-2', mealId: 'meal-2', foodItemId: 'food-2', amountGrams: 150, foodItem: foodItem2 };

      const meal1 = { id: 'meal-1', type: 'lunch', time: '13:00', notes: null, items: [mealItem1] };
      const meal2 = { id: 'meal-2', type: 'dinner', time: '19:00', notes: null, items: [mealItem2] };

      const mealPlan = makeMealPlan({
        targetCalories: 2500,
        targetProtein: 150,
        targetCarbs: 300,
        targetFat: 70,
        meals: [meal1, meal2],
      });

      mockPrismaService.mealPlan.findUnique.mockResolvedValue(mealPlan);

      const result = await service.getDaySummary(CLIENT_ID, date, CLIENT_ID);

      // meal1: 200g куриной грудки → 165*2=330 cal, 31*2=62 prot, 0 carbs, 3.6*2=7.2 fat
      // meal2: 150g риса → 130*1.5=195 cal, 2.7*1.5=4.05 prot, 28*1.5=42 carbs, 0.3*1.5=0.45 fat
      // Total: 525 cal, 66 prot (округлённо), 42 carbs, 8 fat (округлённо)
      expect(result.consumedCalories).toBe(525);
      expect(result.consumedProtein).toBe(66);
      expect(result.consumedCarbs).toBe(42);
      expect(result.consumedFat).toBe(8);
    });

    it('calculates percentCalories correctly', async () => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({});

      const foodItem = makeFoodItem({ caloriesPer100g: 100, proteinPer100g: 10, carbsPer100g: 10, fatPer100g: 1 });
      const mealItem = { id: 'mi-1', mealId: 'meal-1', foodItemId: 'food-1', amountGrams: 100, foodItem };
      const meal = { id: 'meal-1', type: 'breakfast', time: '08:00', notes: null, items: [mealItem] };
      const mealPlan = makeMealPlan({ targetCalories: 2000, meals: [meal] });

      mockPrismaService.mealPlan.findUnique.mockResolvedValue(mealPlan);

      const result = await service.getDaySummary(CLIENT_ID, date, CLIENT_ID);

      // consumed: 100 cal, target: 2000 → percent = (100/2000)*100 = 5%
      expect(result.percentCalories).toBe(5);
    });

    it('percentCalories is 0 when targetCalories is 0', async () => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({});

      const mealPlan = makeMealPlan({ targetCalories: 0, meals: [] });
      mockPrismaService.mealPlan.findUnique.mockResolvedValue(mealPlan);

      const result = await service.getDaySummary(CLIENT_ID, date, CLIENT_ID);

      expect(result.percentCalories).toBe(0);
    });

    it('returns meals with subtotals', async () => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({});

      const foodItem = makeFoodItem({ caloriesPer100g: 200, proteinPer100g: 20, carbsPer100g: 20, fatPer100g: 5 });
      const mealItem = { id: 'mi-1', mealId: 'meal-1', foodItemId: 'food-1', amountGrams: 150, foodItem };
      const meal = { id: 'meal-1', type: 'breakfast', time: '08:00', notes: 'Первый приём', items: [mealItem] };
      const mealPlan = makeMealPlan({ meals: [meal] });

      mockPrismaService.mealPlan.findUnique.mockResolvedValue(mealPlan);

      const result = await service.getDaySummary(CLIENT_ID, date, CLIENT_ID);

      expect(result.meals.length).toBe(1);
      expect(result.meals[0].id).toBe('meal-1');
      expect(result.meals[0].type).toBe('breakfast');
      expect(result.meals[0].time).toBe('08:00');
      expect(result.meals[0].notes).toBe('Первый приём');
      expect(result.meals[0].subtotal).toBeDefined();
      // 150g → 1.5 ratio → 200*1.5=300, 20*1.5=30, 20*1.5=30, 5*1.5=7.5→8
      expect(result.meals[0].subtotal.calories).toBe(300);
      expect(result.meals[0].subtotal.protein).toBe(30);
      expect(result.meals[0].subtotal.carbs).toBe(30);
      expect(result.meals[0].subtotal.fat).toBe(8);
    });

    it('returns items with computed nutrition', async () => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({});

      const foodItem = makeFoodItem({ caloriesPer100g: 100, proteinPer100g: 10, carbsPer100g: 15, fatPer100g: 2 });
      const mealItem = { id: 'mi-1', mealId: 'meal-1', foodItemId: 'food-1', amountGrams: 250, foodItem };
      const meal = { id: 'meal-1', type: 'lunch', time: '13:00', notes: null, items: [mealItem] };
      const mealPlan = makeMealPlan({ meals: [meal] });

      mockPrismaService.mealPlan.findUnique.mockResolvedValue(mealPlan);

      const result = await service.getDaySummary(CLIENT_ID, date, CLIENT_ID);

      expect(result.meals[0].items.length).toBe(1);
      const item = result.meals[0].items[0];
      expect(item.computed).toBeDefined();
      // 250g → 2.5 ratio → 100*2.5=250, 10*2.5=25, 15*2.5=37.5→38, 2*2.5=5
      expect(item.computed.calories).toBe(250);
      expect(item.computed.protein).toBe(25);
      expect(item.computed.carbs).toBe(38);
      expect(item.computed.fat).toBe(5);
    });

    it('verifies access before retrieving summary', async () => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue(null);

      await expect(service.getDaySummary(CLIENT_ID, date, OTHER_USER_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── searchFood ──────────────────────────────────────────────────────────

  describe('searchFood', () => {
    it('calls prisma.foodItem.findMany with insensitive search', async () => {
      const foods = [makeFoodItem({ name: 'Куриная грудка' }), makeFoodItem({ name: 'Куриная ножка', id: 'food-2' })];
      mockPrismaService.foodItem.findMany.mockResolvedValue(foods);

      const result = await service.searchFood('курица');

      expect(mockPrismaService.foodItem.findMany).toHaveBeenCalledTimes(1);
      const call = mockPrismaService.foodItem.findMany.mock.calls[0][0];
      expect(call.where.name.contains).toBe('курица');
      expect(call.where.name.mode).toBe('insensitive');
      expect(result.length).toBe(2);
    });

    it('limits results to 20 items', async () => {
      mockPrismaService.foodItem.findMany.mockResolvedValue([]);

      await service.searchFood('еда');

      const call = mockPrismaService.foodItem.findMany.mock.calls[0][0];
      expect(call.take).toBe(20);
    });

    it('orders results by name ascending', async () => {
      mockPrismaService.foodItem.findMany.mockResolvedValue([]);

      await service.searchFood('еда');

      const call = mockPrismaService.foodItem.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ name: 'asc' });
    });
  });

  // ─── createFoodItem ──────────────────────────────────────────────────────

  describe('createFoodItem', () => {
    const dto = {
      name: 'Овсянка',
      caloriesPer100g: 68,
      proteinPer100g: 2.4,
      carbsPer100g: 12,
      fatPer100g: 1.4,
    };

    it('creates food item with userId as createdBy', async () => {
      const newFood = makeFoodItem({ ...dto, createdBy: TRAINER_ID });
      mockPrismaService.foodItem.create.mockResolvedValue(newFood);

      const result = await service.createFoodItem(dto, TRAINER_ID);

      expect(mockPrismaService.foodItem.create).toHaveBeenCalledTimes(1);
      const createCall = mockPrismaService.foodItem.create.mock.calls[0][0];
      expect(createCall.data.createdBy).toBe(TRAINER_ID);
      expect(createCall.data.name).toBe('Овсянка');
      expect(result.createdBy).toBe(TRAINER_ID);
    });
  });
});
