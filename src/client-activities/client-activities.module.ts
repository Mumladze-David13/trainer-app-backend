import { Module } from '@nestjs/common';
import { ClientActivitiesController } from './client-activities.controller';
import { ClientActivitiesService } from './client-activities.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ClientActivitiesController],
  providers: [ClientActivitiesService],
})
export class ClientActivitiesModule {}
