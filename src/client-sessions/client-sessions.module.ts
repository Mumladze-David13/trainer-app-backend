import { Module } from '@nestjs/common';
import { ClientSessionsController } from './client-sessions.controller';
import { ClientSessionsService } from './client-sessions.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ClientSessionsController],
  providers: [ClientSessionsService],
  exports: [ClientSessionsService],
})
export class ClientSessionsModule {}
