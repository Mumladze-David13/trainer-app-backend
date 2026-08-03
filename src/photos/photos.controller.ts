import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, CurrentUser } from '../auth/decorators/roles.decorator';
import { PhotosService } from './photos.service';
import { CreatePhotoDto } from './dto/create-photo.dto';
import { GetPhotosQueryDto } from './dto/get-photos-query.dto';
import { Role } from '@prisma/client';

@ApiTags('Photos')
@ApiBearerAuth('JWT')
@Controller('photos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  @Post()
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Клиент: сохранить загруженное фото' })
  @ApiResponse({ status: 201, description: 'Фото сохранено' })
  createPhoto(@CurrentUser() user: any, @Body() dto: CreatePhotoDto) {
    return this.photosService.createPhoto(user.id, dto);
  }

  @Get()
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Клиент: получить свои фото' })
  @ApiQuery({ name: 'category', required: false, enum: ['progress-photos', 'pose-analysis'] })
  @ApiResponse({ status: 200, description: 'Список фото' })
  getPhotos(@CurrentUser() user: any, @Query() query: GetPhotosQueryDto) {
    return this.photosService.getPhotos(user.id, query.category);
  }

  @Delete(':id')
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Клиент: удалить фото' })
  @ApiParam({ name: 'id', description: 'ID фото' })
  @ApiResponse({ status: 200, description: 'Фото удалено' })
  deletePhoto(@CurrentUser() user: any, @Param('id') id: string) {
    return this.photosService.deletePhoto(id, user.id);
  }

  @Get('client/:clientId')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Тренер: получить фото клиента' })
  @ApiParam({ name: 'clientId', description: 'ID клиента' })
  @ApiQuery({ name: 'category', required: false, enum: ['progress-photos', 'pose-analysis'] })
  @ApiResponse({ status: 200, description: 'Список фото клиента' })
  getClientPhotos(
    @CurrentUser() user: any,
    @Param('clientId') clientId: string,
    @Query() query: GetPhotosQueryDto,
  ) {
    return this.photosService.getClientPhotos(clientId, user.id, query.category);
  }
}
