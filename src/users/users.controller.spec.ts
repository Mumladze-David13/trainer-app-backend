import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Role } from '@prisma/client';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ExecutionContext } from '@nestjs/common';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUsersService = {
    findById: jest.fn(),
    updateRole: jest.fn(),
    findAllTrainers: jest.fn(),
  };

  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: Role.CLIENT,
  };

  // Mock guard that always passes and injects mock user
  const mockJwtAuthGuard = {
    canActivate: (context: ExecutionContext) => {
      const request = context.switchToHttp().getRequest();
      request.user = mockUser;
      return true;
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMe', () => {
    it('should call usersService.findById with user.id and return the result', async () => {
      const expectedUser = {
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        role: mockUser.role,
        createdAt: new Date(),
        settings: null,
      };

      mockUsersService.findById.mockResolvedValue(expectedUser);

      const result = await controller.getMe(mockUser);

      expect(service.findById).toHaveBeenCalledWith(mockUser.id);
      expect(service.findById).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedUser);
    });

    it('should return null when user not found', async () => {
      mockUsersService.findById.mockResolvedValue(null);

      const result = await controller.getMe(mockUser);

      expect(service.findById).toHaveBeenCalledWith(mockUser.id);
      expect(result).toBeNull();
    });
  });

  describe('updateRole', () => {
    it('should call usersService.updateRole with user.id and dto, then return result', async () => {
      const dto: UpdateRoleDto = { role: Role.TRAINER };
      const expectedUser = {
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        role: Role.TRAINER,
        createdAt: new Date(),
        settings: null,
      };

      mockUsersService.updateRole.mockResolvedValue(expectedUser);

      const result = await controller.updateRole(mockUser, dto);

      expect(service.updateRole).toHaveBeenCalledWith(mockUser.id, dto);
      expect(service.updateRole).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedUser);
      expect(result.role).toBe(Role.TRAINER);
    });

    it('should handle role update to CLIENT', async () => {
      const dto: UpdateRoleDto = { role: Role.CLIENT };
      const expectedUser = {
        ...mockUser,
        createdAt: new Date(),
        settings: null,
      };

      mockUsersService.updateRole.mockResolvedValue(expectedUser);

      const result = await controller.updateRole(mockUser, dto);

      expect(service.updateRole).toHaveBeenCalledWith(mockUser.id, dto);
      expect(result.role).toBe(Role.CLIENT);
    });

    it('should handle role update to TRAINER_CLIENT', async () => {
      const dto: UpdateRoleDto = { role: Role.TRAINER_CLIENT };
      const expectedUser = {
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        role: Role.TRAINER_CLIENT,
        createdAt: new Date(),
        settings: null,
      };

      mockUsersService.updateRole.mockResolvedValue(expectedUser);

      const result = await controller.updateRole(mockUser, dto);

      expect(service.updateRole).toHaveBeenCalledWith(mockUser.id, dto);
      expect(result.role).toBe(Role.TRAINER_CLIENT);
    });
  });

  describe('getTrainers', () => {
    it('should call usersService.findAllTrainers and return the result', async () => {
      const expectedTrainers = [
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

      mockUsersService.findAllTrainers.mockResolvedValue(expectedTrainers);

      const result = await controller.getTrainers();

      expect(service.findAllTrainers).toHaveBeenCalledWith();
      expect(service.findAllTrainers).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedTrainers);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no trainers exist', async () => {
      mockUsersService.findAllTrainers.mockResolvedValue([]);

      const result = await controller.getTrainers();

      expect(service.findAllTrainers).toHaveBeenCalledWith();
      expect(result).toEqual([]);
    });
  });
});
