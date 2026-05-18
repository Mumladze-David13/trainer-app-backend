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
  ],
})
export class AppModule {}
