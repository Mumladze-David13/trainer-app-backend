import { Test, TestingModule } from '@nestjs/testing';
import { AnonymizerService } from './anonymizer.service';

describe('AnonymizerService', () => {
  let service: AnonymizerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AnonymizerService],
    }).compile();

    service = module.get<AnonymizerService>(AnonymizerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('anonymizeClient', () => {
    it('should return CLIENT_ prefix with 8 character hash', () => {
      const client = {
        id: 'user-123',
        firstName: 'Иван',
        lastName: 'Петров',
        email: 'ivan@example.com',
      };

      const result = service.anonymizeClient(client);

      expect(result.clientHash).toMatch(/^CLIENT_[a-f0-9]{8}$/);
    });

    it('should return the same hash for the same client id', () => {
      const client1 = {
        id: 'user-abc',
        firstName: 'Мария',
        lastName: 'Иванова',
        email: 'maria@example.com',
      };
      const client2 = {
        id: 'user-abc',
        firstName: 'Другое имя',
        lastName: 'Другая фамилия',
        email: 'other@example.com',
      };

      const result1 = service.anonymizeClient(client1);
      const result2 = service.anonymizeClient(client2);

      expect(result1.clientHash).toBe(result2.clientHash);
    });

    it('should return different hashes for different client ids', () => {
      const client1 = {
        id: 'user-123',
        firstName: 'Иван',
        lastName: 'Петров',
        email: 'ivan@example.com',
      };
      const client2 = {
        id: 'user-456',
        firstName: 'Иван',
        lastName: 'Петров',
        email: 'ivan@example.com',
      };

      const result1 = service.anonymizeClient(client1);
      const result2 = service.anonymizeClient(client2);

      expect(result1.clientHash).not.toBe(result2.clientHash);
    });
  });

  describe('anonymizeWorkoutHistory', () => {
    it('should correctly map workout fields', () => {
      const workouts = [
        {
          id: 'workout-1',
          date: new Date('2026-06-01'),
          isCompleted: true,
          workoutExercises: [
            {
              id: 'we-1',
              exercise: { id: 'ex-1', name: 'Приседания' },
              sets: 3,
              reps: 10,
              weight: 100,
              setWeights: [90, 100, 110],
            },
          ],
        },
      ];

      const result = service.anonymizeWorkoutHistory(workouts);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        date: workouts[0].date,
        isCompleted: true,
        exercises: [
          {
            name: 'Приседания',
            sets: 3,
            reps: 10,
            weight: 100,
            setWeights: [90, 100, 110],
          },
        ],
      });
    });

    it('should handle missing workoutExercises by returning empty array', () => {
      const workouts = [
        {
          id: 'workout-1',
          date: new Date('2026-06-01'),
          isCompleted: false,
          workoutExercises: null,
        },
      ];

      const result = service.anonymizeWorkoutHistory(workouts);

      expect(result).toHaveLength(1);
      expect(result[0].exercises).toEqual([]);
    });

    it('should handle undefined workoutExercises by returning empty array', () => {
      const workouts = [
        {
          id: 'workout-1',
          date: new Date('2026-06-01'),
          isCompleted: false,
        },
      ];

      const result = service.anonymizeWorkoutHistory(workouts);

      expect(result).toHaveLength(1);
      expect(result[0].exercises).toEqual([]);
    });

    it('should process multiple workouts correctly', () => {
      const workouts = [
        {
          id: 'workout-1',
          date: new Date('2026-06-01'),
          isCompleted: true,
          workoutExercises: [
            {
              exercise: { name: 'Жим лёжа' },
              sets: 4,
              reps: 8,
              weight: 80,
              setWeights: null,
            },
          ],
        },
        {
          id: 'workout-2',
          date: new Date('2026-06-03'),
          isCompleted: false,
          workoutExercises: [
            {
              exercise: { name: 'Тяга' },
              sets: 3,
              reps: 12,
              weight: 60,
              setWeights: [50, 60, 70],
            },
          ],
        },
      ];

      const result = service.anonymizeWorkoutHistory(workouts);

      expect(result).toHaveLength(2);
      expect(result[0].exercises[0].name).toBe('Жим лёжа');
      expect(result[1].exercises[0].name).toBe('Тяга');
    });

    it('should handle empty workout array', () => {
      const result = service.anonymizeWorkoutHistory([]);
      expect(result).toEqual([]);
    });
  });
});
