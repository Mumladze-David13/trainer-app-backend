// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ExercisesModule } from './exercises/exercises.module';
import { ClientsModule } from './clients/clients.module';
import { SeasonsModule } from './seasons/seasons.module';
import { WorkoutsModule } from './workouts/workouts.module';
import { SettingsModule } from './settings/settings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ChatModule } from './chat/chat.module';
import { AiModule } from './ai/ai.module';
import { NutritionModule } from './nutrition/nutrition.module';
import { WeightLogModule } from './weight-log/weight-log.module';
import { ClientSessionsModule } from './client-sessions/client-sessions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ExercisesModule,
    ClientsModule,
    SeasonsModule,
    WorkoutsModule,
    SettingsModule,
    NotificationsModule,
    ChatModule,
    AiModule,
    NutritionModule,
    WeightLogModule,
    ClientSessionsModule,
  ],
})
export class AppModule {}
