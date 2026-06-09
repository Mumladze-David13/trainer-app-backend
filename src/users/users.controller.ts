// src/users/users.controller.ts
import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { CurrentUser } from '../auth/decorators/roles.decorator';
import { UpdateRoleDto } from './dto/update-role.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  public getMe(@CurrentUser() user: any) {
    return this.usersService.findById(user.id);
  }

  @Put('me/role')
  public updateRole(@CurrentUser() user: any, @Body() dto: UpdateRoleDto) {
    return this.usersService.updateRole(user.id, dto);
  }

  @Get('trainers')
  public getTrainers() {
    return this.usersService.findAllTrainers();
  }
}
