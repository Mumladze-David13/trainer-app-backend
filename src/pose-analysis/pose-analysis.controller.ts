import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/roles.decorator';
import { PoseAnalysisService } from './pose-analysis.service';
import { UploadCalibrationFramesDto } from './dto/upload-calibration-frames.dto';
import { UploadDatasetCaseDto } from './dto/upload-dataset-case.dto';

@ApiTags('Pose Analysis')
@ApiBearerAuth('JWT')
@Controller('pose-analysis')
@UseGuards(JwtAuthGuard)
export class PoseAnalysisController {
  constructor(private readonly poseAnalysisService: PoseAnalysisService) {}

  @Post('calibration-frames')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Загрузить батч кадров калибровки (фоновый сбор во время анализа техники)' })
  public uploadCalibrationFrames(@CurrentUser() user: any, @Body() dto: UploadCalibrationFramesDto) {
    return this.poseAnalysisService.uploadCalibrationFrames(user.id, dto);
  }

  @Post('dataset-cases')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Загрузить размеченный кейс (запись повторения/подхода целиком)' })
  public uploadDatasetCase(@CurrentUser() user: any, @Body() dto: UploadDatasetCaseDto) {
    return this.poseAnalysisService.uploadDatasetCase(user.id, dto);
  }
}
