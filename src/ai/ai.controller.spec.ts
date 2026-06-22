import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ExecutionContext } from '@nestjs/common';
import { GenerateProgramDto, SaveGeneratedProgramDto } from './dto/generate-program.dto';

describe('AiController', () => {
  let controller: AiController;
  let service: AiService;

  const mockUser = { id: 'trainer-1', email: 'trainer@example.com', role: 'TRAINER' };

  const mockAiService = {
    generateProgram: jest.fn(),
    saveGeneratedProgram: jest.fn(),
  };

  const mockJwtAuthGuard = {
    canActivate: (context: ExecutionContext) => {
      const request = context.switchToHttp().getRequest();
      request.user = mockUser;
      return true;
    },
  };

  const mockRolesGuard = {
    canActivate: () => true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [{ provide: AiService, useValue: mockAiService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<AiController>(AiController);
    service = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generateProgram', () => {
    const dto: GenerateProgramDto = {
      clientId: 'client-1',
      goal: 'gain_muscle',
      level: 'intermediate',
      daysPerWeek: 3,
      equipment: 'тренажёрный зал',
    };

    it('should call service.generateProgram with dto and user id', async () => {
      const expected = {
        workouts: [{ dayNumber: 1, exercises: [] }],
        recommendations: 'Отдыхайте между подходами',
        totalWorkouts: 1,
      };
      mockAiService.generateProgram.mockResolvedValue(expected);

      const result = await controller.generateProgram(dto, mockUser as any);

      expect(service.generateProgram).toHaveBeenCalledWith(dto, mockUser.id);
      expect(result).toEqual(expected);
    });

    it('should pass optional notes to service', async () => {
      const dtoWithNotes = { ...dto, notes: 'болит плечо' };
      mockAiService.generateProgram.mockResolvedValue({ workouts: [], recommendations: '', totalWorkouts: 0 });

      await controller.generateProgram(dtoWithNotes, mockUser as any);

      expect(service.generateProgram).toHaveBeenCalledWith(dtoWithNotes, mockUser.id);
    });

    it('should propagate service errors', async () => {
      mockAiService.generateProgram.mockRejectedValue(new Error('AI error'));

      await expect(controller.generateProgram(dto, mockUser as any)).rejects.toThrow('AI error');
    });
  });

  describe('saveProgram', () => {
    const dto: SaveGeneratedProgramDto = {
      seasonId: 'season-1',
      workouts: [
        {
          date: '2026-07-01',
          notes: 'День 1',
          exercises: [
            { exerciseId: 'ex-1', sets: 3, reps: 10, order: 0 },
          ],
        },
      ],
    };

    it('should call service.saveGeneratedProgram with dto and user id', async () => {
      const expected = { created: 1, seasonId: 'season-1' };
      mockAiService.saveGeneratedProgram.mockResolvedValue(expected);

      const result = await controller.saveProgram(dto, mockUser as any);

      expect(service.saveGeneratedProgram).toHaveBeenCalledWith(dto, mockUser.id);
      expect(result).toEqual(expected);
    });

    it('should propagate service errors', async () => {
      mockAiService.saveGeneratedProgram.mockRejectedValue(new Error('Season not found'));

      await expect(controller.saveProgram(dto, mockUser as any)).rejects.toThrow('Season not found');
    });
  });
});
