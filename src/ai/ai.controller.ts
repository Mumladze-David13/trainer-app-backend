import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/roles.decorator';
import { AiService } from './ai.service';
import { GenerateProgramDto, SaveGeneratedProgramDto } from './dto/generate-program.dto';
import { Role } from '@prisma/client';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate-program')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  generateProgram(
    @Body() dto: GenerateProgramDto,
    @CurrentUser() user: any,
  ) {
    return this.aiService.generateProgram(dto, user.id);
  }

  @Post('save-program')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  saveProgram(
    @Body() dto: SaveGeneratedProgramDto,
    @CurrentUser() user: any,
  ) {
    return this.aiService.saveGeneratedProgram(dto, user.id);
  }

  @Get('usage')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  getUsage(@CurrentUser() user: any) {
    return this.aiService.getUsage(user.id);
  }
}
