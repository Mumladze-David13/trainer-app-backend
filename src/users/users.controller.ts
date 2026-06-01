// src/users/users.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { CurrentUser } from '../auth/decorators/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  public getMe(@CurrentUser() user: any) {
    return this.usersService.findById(user.id);
  }

  @Get('trainers')
  public getTrainers() {
    return this.usersService.findAllTrainers();
  }
}
