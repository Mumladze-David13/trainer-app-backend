import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const EXERCISES_DIR = path.join(__dirname, 'seed-data', 'free-exercise-db');
const NAME_TRANSLATIONS: Record<string, string> = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'seed-data', 'name-translations-ru.json'), 'utf-8'),
);

async function main() {
  const files = fs.readdirSync(EXERCISES_DIR).filter((f) => f.endsWith('.json'));
  const englishNameBySourceId: Record<string, string> = {};
  for (const file of files) {
    const entry = JSON.parse(fs.readFileSync(path.join(EXERCISES_DIR, file), 'utf-8'));
    englishNameBySourceId[entry.id] = entry.name;
  }

  const rows = await prisma.globalExercise.findMany({ where: { sourceId: { not: null } } });

  let fixed = 0;
  for (const row of rows) {
    const englishName = row.sourceId ? englishNameBySourceId[row.sourceId] : undefined;
    if (!englishName) continue;

    await prisma.globalExercise.update({
      where: { id: row.id },
      data: {
        name: englishName,
        nameRus: NAME_TRANSLATIONS[row.sourceId!] ?? row.nameRus ?? row.name,
      },
    });
    fixed++;
  }

  console.log(`Fixed ${fixed} of ${rows.length} rows`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
