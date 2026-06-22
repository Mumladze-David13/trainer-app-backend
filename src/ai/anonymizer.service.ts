import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class AnonymizerService {
  anonymizeClient(client: {
    firstName: string;
    lastName: string;
    email: string;
    id: string;
  }): { clientHash: string } {
    const hash = crypto
      .createHash('sha256')
      .update(client.id)
      .digest('hex')
      .substring(0, 8);
    return { clientHash: `CLIENT_${hash}` };
  }

  anonymizeWorkoutHistory(workouts: any[]): any[] {
    return workouts.map((w) => ({
      date: w.date,
      isCompleted: w.isCompleted,
      exercises:
        w.workoutExercises?.map((e: any) => ({
          name: e.exercise?.name,
          sets: e.sets,
          reps: e.reps,
          weight: e.weight,
          setWeights: e.setWeights,
        })) ?? [],
    }));
  }
}
