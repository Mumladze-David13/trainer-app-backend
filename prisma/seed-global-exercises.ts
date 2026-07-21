import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const IMAGE_BASE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const EXERCISES_DIR = path.join(__dirname, 'seed-data', 'free-exercise-db');
const NAME_TRANSLATIONS: Record<string, string> = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'seed-data', 'name-translations-ru.json'), 'utf-8'),
);

const CATEGORY_MAP: Record<string, string> = {
  strength: 'силовые',
  powerlifting: 'силовые',
  'olympic weightlifting': 'силовые',
  strongman: 'силовые',
  stretching: 'растяжка',
  cardio: 'кардио',
  plyometrics: 'плиометрика',
};

const EQUIPMENT_MAP: Record<string, string> = {
  barbell: 'штанга',
  'e-z curl bar': 'штанга',
  dumbbell: 'гантели',
  kettlebells: 'гантели',
  'body only': 'собственный вес',
  machine: 'тренажёр',
  cable: 'тренажёр',
};

interface FreeExerciseDbEntry {
  id: string;
  name: string;
  category?: string;
  equipment?: string;
  level?: string;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  images?: string[];
}

async function main() {
  const files = fs.readdirSync(EXERCISES_DIR).filter((f) => f.endsWith('.json'));

  let seeded = 0;
  for (const file of files) {
    const raw = fs.readFileSync(path.join(EXERCISES_DIR, file), 'utf-8');
    const entry: FreeExerciseDbEntry = JSON.parse(raw);

    const category = entry.category ? CATEGORY_MAP[entry.category] ?? entry.category : null;
    const equipment = entry.equipment ? EQUIPMENT_MAP[entry.equipment] ?? entry.equipment : null;
    const imageUrl = entry.images?.[0] ? IMAGE_BASE_URL + entry.images[0] : null;
    const name = NAME_TRANSLATIONS[entry.id] ?? entry.name;

    await prisma.globalExercise.upsert({
      where: { name },
      update: {},
      create: {
        name,
        category,
        equipment,
        level: entry.level ?? null,
        primaryMuscles: entry.primaryMuscles ?? [],
        secondaryMuscles: entry.secondaryMuscles ?? [],
        imageUrl,
        sourceId: entry.id,
      },
    });
    seeded++;
  }

  console.log(`Seeded ${seeded} global exercises`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
