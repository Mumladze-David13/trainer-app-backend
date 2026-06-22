import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { CurrentUser } from '../auth/decorators/roles.decorator';
import { UpdateRoleDto } from './dto/update-role.dto';

@ApiTags('Users')
@ApiBearerAuth('JWT')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Получить профиль текущего пользователя' })
  @ApiResponse({ status: 200, description: 'Профиль пользователя' })
  public getMe(@CurrentUser() user: any) {
    return this.usersService.findById(user.id);
  }

  @Put('me/role')
  @ApiOperation({ summary: 'Обновить роль текущего пользователя' })
  @ApiResponse({ status: 200, description: 'Роль обновлена' })
  public updateRole(@CurrentUser() user: any, @Body() dto: UpdateRoleDto) {
    return this.usersService.updateRole(user.id, dto);
  }

  @Get('trainers')
  @ApiOperation({ summary: 'Получить список всех тренеров' })
  @ApiResponse({ status: 200, description: 'Список тренеров' })
  public getTrainers() {
    return this.usersService.findAllTrainers();
  }
}
