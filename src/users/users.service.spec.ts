import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import { UpdateRoleDto } from './dto/update-role.dto';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    trainerSettings: {
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('should call prisma.user.findUnique with correct parameters', async () => {
      const userId = 'test-user-id';
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: Role.CLIENT,
        createdAt: new Date(),
        settings: null,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById(userId);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
          settings: true,
        },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('updateRole', () => {
    const userId = 'test-user-id';
    const mockUpdatedUser = {
      id: userId,
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: Role.CLIENT,
      createdAt: new Date(),
      settings: null,
    };

    it('should update role to CLIENT without creating trainer settings', async () => {
      const dto: UpdateRoleDto = { role: Role.CLIENT };

      mockPrismaService.user.update.mockResolvedValue({
        ...mockUpdatedUser,
        role: Role.CLIENT,
      });

      const result = await service.updateRole(userId, dto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { role: Role.CLIENT },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
          settings: true,
        },
      });
      expect(prisma.trainerSettings.upsert).not.toHaveBeenCalled();
      expect(result.role).toBe(Role.CLIENT);
    });

    it('should update role to TRAINER and create trainer settings', async () => {
      const dto: UpdateRoleDto = { role: Role.TRAINER };

      mockPrismaService.user.update.mockResolvedValue({
        ...mockUpdatedUser,
        role: Role.TRAINER,
      });
      mockPrismaService.trainerSettings.upsert.mockResolvedValue({
        id: 'settings-id',
        trainerId: userId,
        sessionsPerSeason: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.updateRole(userId, dto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { role: Role.TRAINER },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
          settings: true,
        },
      });
      expect(prisma.trainerSettings.upsert).toHaveBeenCalledWith({
        where: { trainerId: userId },
        create: { trainerId: userId },
        update: {},
      });
      expect(result.role).toBe(Role.TRAINER);
    });

    it('should update role to TRAINER_CLIENT and create trainer settings', async () => {
      const dto: UpdateRoleDto = { role: Role.TRAINER_CLIENT };

      mockPrismaService.user.update.mockResolvedValue({
        ...mockUpdatedUser,
        role: Role.TRAINER_CLIENT,
      });
      mockPrismaService.trainerSettings.upsert.mockResolvedValue({
        id: 'settings-id',
        trainerId: userId,
        sessionsPerSeason: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.updateRole(userId, dto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { role: Role.TRAINER_CLIENT },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
          settings: true,
        },
      });
      expect(prisma.trainerSettings.upsert).toHaveBeenCalledWith({
        where: { trainerId: userId },
        create: { trainerId: userId },
        update: {},
      });
      expect(result.role).toBe(Role.TRAINER_CLIENT);
    });

    it('should handle prisma errors gracefully', async () => {
      const dto: UpdateRoleDto = { role: Role.TRAINER };
      const error = new Error('Database connection failed');

      mockPrismaService.user.update.mockRejectedValue(error);

      await expect(service.updateRole(userId, dto)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('findAllTrainers', () => {
    it('should return all trainers with correct filters and ordering', async () => {
      const mockTrainers = [
        {
          id: 'trainer-1',
          email: 'alice@example.com',
          firstName: 'Alice',
          lastName: 'Smith',
          role: Role.TRAINER,
          settings: { sessionsPerSeason: 12 },
        },
        {
          id: 'trainer-2',
          email: 'bob@example.com',
          firstName: 'Bob',
          lastName: 'Jones',
          role: Role.TRAINER_CLIENT,
          settings: { sessionsPerSeason: 8 },
        },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(mockTrainers);

      const result = await service.findAllTrainers();

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { role: { in: [Role.TRAINER, Role.TRAINER_CLIENT] } },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          settings: { select: { sessionsPerSeason: true } },
        },
        orderBy: { firstName: 'asc' },
      });
      expect(result).toEqual(mockTrainers);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no trainers exist', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const result = await service.findAllTrainers();

      expect(result).toEqual([]);
      expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
    });
  });
});
