import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadCalibrationFramesDto } from './dto/upload-calibration-frames.dto';
import { UploadDatasetCaseDto } from './dto/upload-dataset-case.dto';

@Injectable()
export class PoseAnalysisService {
  constructor(private readonly prisma: PrismaService) {}

  public async uploadCalibrationFrames(userId: string, dto: UploadCalibrationFramesDto) {
    const rows = dto.frames.map((f) => ({
      userId,
      createdAt: f.ts ? new Date(f.ts) : new Date(),
      exercise: f.exercise,
      view: f.view,
      phase: f.phase,
      formScore: f.formScore,
      imageWidth: f.imageWidth,
      imageHeight: f.imageHeight,
      angles: f.angles ?? {},
      calibrationMetrics: f.calibrationMetrics ?? {},
    }));

    await this.prisma.poseCalibrationFrame.createMany({ data: rows });
    return { saved: rows.length };
  }

  public async uploadDatasetCase(userId: string, dto: UploadDatasetCaseDto) {
    await this.prisma.poseDatasetCase.upsert({
      where: { caseId: dto.caseId },
      create: {
        caseId: dto.caseId,
        userId,
        exercise: dto.exercise,
        viewMode: dto.viewMode,
        label: dto.label,
        comment: dto.comment,
        frames: dto.frames as any,
      },
      update: {
        userId,
        exercise: dto.exercise,
        viewMode: dto.viewMode,
        label: dto.label,
        comment: dto.comment,
        frames: dto.frames as any,
      },
    });
    return { ok: true };
  }
}
