// Общая логика AI-генерации программ тренировок для режима тренера и SOLO:
// каталог упражнений, методика в промпте, данные клиента и раскладка
// сгенерированных тренировок по сезонам с учётом лимита занятий.
import { PrismaService } from '../prisma/prisma.service';

const MUSCLE_RU: Record<string, string> = {
  abdominals: 'пресс',
  abductors: 'отводящие бедра',
  adductors: 'приводящие бедра',
  biceps: 'бицепс',
  calves: 'икры',
  chest: 'грудь',
  forearms: 'предплечья',
  glutes: 'ягодицы',
  hamstrings: 'бицепс бедра',
  lats: 'широчайшие',
  'lower back': 'поясница',
  'middle back': 'середина спины',
  neck: 'шея',
  quadriceps: 'квадрицепс',
  shoulders: 'плечи',
  traps: 'трапеции',
  triceps: 'трицепс',
};

// Оборудование силовых упражнений, из которых строится программа.
// Медбол, фитбол, ролик и «другое» в программу не попадают.
const PROGRAM_EQUIPMENT = ['штанга', 'гантели', 'тренажёр', 'собственный вес', 'эспандер'];

// Онбординг-выбор оборудования SOLO → GlobalExercise.equipment.
export const SOLO_EQUIPMENT_FILTER: Record<string, string[]> = {
  gym: PROGRAM_EQUIPMENT,
  home_dumbbells: ['гантели', 'собственный вес', 'эспандер'],
  bodyweight: ['собственный вес'],
};

// В режиме тренера оборудование приходит свободным текстом из формы.
export function equipmentFilterFromText(text: string): string[] {
  const t = text.toLowerCase();
  if (t.includes('собственн') || t.includes('свой вес')) return ['собственный вес'];
  if (t.includes('зал') || t.includes('тренаж')) return PROGRAM_EQUIPMENT;
  if (t.includes('штанг')) return ['штанга', 'гантели', 'собственный вес'];
  if (t.includes('гантел') || t.includes('дома')) return ['гантели', 'собственный вес', 'эспандер'];
  return PROGRAM_EQUIPMENT;
}

export interface CatalogEntry {
  ref: number;
  name: string;
  equipment: string | null;
  trainerExerciseId: string | null;
  globalExerciseId: string | null;
}

export interface ExerciseCatalog {
  entries: Map<number, CatalogEntry>;
  promptList: string;
}

function muscleLabel(muscles: string[] | undefined | null): string {
  const ru = (muscles ?? []).map((m) => MUSCLE_RU[m] ?? m);
  return ru.length ? ` [${ru.join(', ')}]` : '';
}

// Каталог для промпта: короткие номера вместо UUID (экономия токенов и
// никаких выдуманных id). Сначала упражнения самого тренера, затем силовые
// упражнения глобального справочника под доступное оборудование.
export async function loadExerciseCatalog(
  prisma: PrismaService,
  opts: { equipment: string[]; trainerId?: string },
): Promise<ExerciseCatalog> {
  const trainerExercises = opts.trainerId
    ? await prisma.trainerExercise.findMany({
        where: { trainerId: opts.trainerId },
        select: {
          id: true,
          name: true,
          equipment: true,
          globalExerciseId: true,
          globalExercise: { select: { primaryMuscles: true } },
        },
        orderBy: { name: 'asc' },
      })
    : [];

  const globalExercises = await prisma.globalExercise.findMany({
    where: { category: 'силовые', equipment: { in: opts.equipment } },
    select: { id: true, name: true, nameRus: true, equipment: true, primaryMuscles: true },
    orderBy: { name: 'asc' },
  });

  const entries = new Map<number, CatalogEntry>();
  const ownLines: string[] = [];
  const globalLines: string[] = [];
  const linkedGlobalIds = new Set<string>();
  const ownNames = new Set<string>();
  let ref = 1;

  for (const e of trainerExercises) {
    entries.set(ref, {
      ref,
      name: e.name,
      equipment: e.equipment,
      trainerExerciseId: e.id,
      globalExerciseId: e.globalExerciseId,
    });
    ownLines.push(`#${ref} ${e.name}${muscleLabel(e.globalExercise?.primaryMuscles)}`);
    if (e.globalExerciseId) linkedGlobalIds.add(e.globalExerciseId);
    ownNames.add(e.name.toLowerCase());
    ref++;
  }

  for (const g of globalExercises) {
    const name = g.nameRus ?? g.name;
    if (linkedGlobalIds.has(g.id) || ownNames.has(name.toLowerCase())) continue;
    entries.set(ref, {
      ref,
      name,
      equipment: g.equipment,
      trainerExerciseId: null,
      globalExerciseId: g.id,
    });
    globalLines.push(`#${ref} ${name}${muscleLabel(g.primaryMuscles)}`);
    ref++;
  }

  const sections: string[] = [];
  if (ownLines.length) {
    sections.push(
      `Упражнения тренера (предпочитай их, если есть равноценные варианты):\n${ownLines.join('\n')}`,
    );
  }
  if (globalLines.length) {
    sections.push(`Общий справочник упражнений:\n${globalLines.join('\n')}`);
  }

  return { entries, promptList: sections.join('\n\n') };
}

// Возвращает id TrainerExercise; упражнение из глобального справочника
// материализуется в личный справочник тренера (как это уже делал SOLO).
export async function resolveTrainerExerciseId(
  prisma: PrismaService,
  entry: CatalogEntry,
  trainerId: string,
): Promise<string> {
  if (entry.trainerExerciseId) return entry.trainerExerciseId;

  const existing = await prisma.trainerExercise.findUnique({
    where: { name_trainerId: { name: entry.name, trainerId } },
  });
  const trainerExercise =
    existing ??
    (await prisma.trainerExercise.create({
      data: {
        name: entry.name,
        trainerId,
        equipment: entry.equipment,
        globalExerciseId: entry.globalExerciseId,
      },
    }));

  entry.trainerExerciseId = trainerExercise.id;
  return trainerExercise.id;
}

export const PROGRAM_SYSTEM_PROMPT = `Ты опытный персональный тренер, составляющий программы тренировок.
Используй ТОЛЬКО упражнения из предоставленного списка и указывай их номер (#) в поле "exercise".
Отвечай строго в JSON формате без лишнего текста, markdown или пояснений.
Формат ответа:
{
  "workouts": [
    {
      "dayNumber": 1,
      "notes": "описание занятия",
      "exercises": [
        {
          "exercise": 12,
          "sets": 3,
          "reps": 10,
          "weight": 50,
          "setWeights": null,
          "supersetGroup": null,
          "supersetOrder": null,
          "order": 0
        }
      ]
    }
  ],
  "recommendations": "общие рекомендации"
}

Методика:
- Сплит выбирай по числу занятий в неделю: 1–2 — фулбоди, 3 — фулбоди или верх/низ/фулбоди,
  4 — верх/низ, 5–6 — тяни/толкай/ноги. Если нужно меньше тренировок, чем занятий в неделю,
  составь первые тренировки этого сплита.
- Каждую тренировку начинай с базовых многосуставных упражнений (жим лёжа, приседания,
  становая/румынская тяга, тяга в наклоне или подтягивания, жим над головой), затем изоляция.
  Если базовое упражнение недоступно с имеющимся оборудованием — бери ближайший аналог из списка.
- За неделю нагрузка должна быть сбалансирована: грудь, спина, ноги (квадрицепс, бицепс бедра,
  ягодицы), плечи, руки, пресс. Тянущих и толкающих упражнений примерно поровну.
- 4–7 упражнений на тренировку. Подходы и повторения — под цель: сила 3–5×3–6,
  масса 3–4×8–12, жиросжигание/выносливость 2–3×12–20.
- Учитывай пол, возраст, вес и ограничения/травмы клиента, если они указаны.

Правила для веса:
- weight — рабочий вес в кг (число). Указывай его для КАЖДОГО упражнения со штангой,
  гантелями, гирей или в тренажёре — не оставляй null.
- Если в истории тренировок есть это или похожее упражнение — отталкивайся от веса из истории
  с учётом цели и прогрессии.
- Если истории нет — оцени стартовый вес по уровню подготовки и данным клиента (для новичка —
  консервативно, лёгкий вес для отработки техники). Для гантелей указывай вес одной гантели.
- null — только для упражнений с собственным весом (подтягивания, отжимания, планка и т.п.).
- setWeights — массив весов по подходам, если вес меняется от подхода к подходу, иначе null.`;

// Пол/возраст/рост/вес из профиля питания (без ФИО и email).
export async function describeClient(prisma: PrismaService, clientId: string): Promise<string> {
  const [profile, lastWeight] = await Promise.all([
    prisma.nutritionProfile.findUnique({ where: { clientId } }),
    prisma.weightLog.findFirst({ where: { clientId }, orderBy: { date: 'desc' } }),
  ]);

  const parts: string[] = [];
  if (profile?.gender) {
    parts.push(`пол: ${profile.gender === 'female' ? 'женский' : profile.gender === 'male' ? 'мужской' : profile.gender}`);
  }
  if (profile?.age) parts.push(`возраст: ${profile.age}`);
  if (profile?.heightCm) parts.push(`рост: ${profile.heightCm} см`);
  const weight = lastWeight?.weightKg ?? profile?.weightKg;
  if (weight) parts.push(`вес: ${weight} кг`);

  return parts.length ? parts.join(', ') : 'нет данных';
}

export function historyBlock(history: unknown[]): string {
  if (!history.length) {
    return `История тренировок: нет — это первая программа. Не ссылайся на прошлые тренировки,
составь программу с нуля по параметрам выше.`;
  }
  return `История тренировок (последние занятия):\n${JSON.stringify(history, null, 2)}`;
}

export interface PlacedWorkout<T> {
  workout: T;
  seasonId: string;
}

// Раскладывает тренировки по сезонам: в текущий (явно указанный или последний
// активный), пока в нём не исчерпан лимит sessionsPerSeason и дата тренировки
// не позже его endDate; остаток — в новый сезон «Сезон N».
export async function placeWorkoutsInSeasons<T extends { date: Date }>(
  prisma: PrismaService,
  opts: { trainerClientId: string; trainerId: string; preferredSeasonId?: string | null },
  workouts: T[],
): Promise<{ placed: PlacedWorkout<T>[]; newSeason: { id: string; name: string } | null }> {
  const settings = await prisma.trainerSettings.findUnique({ where: { trainerId: opts.trainerId } });
  const limit = settings?.sessionsPerSeason || 30;

  const current = opts.preferredSeasonId
    ? await prisma.season.findFirst({
        where: { id: opts.preferredSeasonId, trainerClientId: opts.trainerClientId },
      })
    : await prisma.season.findFirst({
        where: { trainerClientId: opts.trainerClientId, isActive: true },
        orderBy: { startDate: 'desc' },
      });

  let capacity = current
    ? limit - (await prisma.workout.count({ where: { seasonId: current.id } }))
    : 0;
  let seasonEnd: Date | null = null;
  if (current?.endDate) {
    seasonEnd = new Date(current.endDate);
    seasonEnd.setHours(23, 59, 59, 999);
  }

  const sorted = [...workouts].sort((a, b) => a.date.getTime() - b.date.getTime());
  const placed: PlacedWorkout<T>[] = [];
  let newSeason: { id: string; name: string } | null = null;

  for (const workout of sorted) {
    const fitsCurrent =
      current && capacity > 0 && (!seasonEnd || workout.date.getTime() <= seasonEnd.getTime());
    if (fitsCurrent) {
      placed.push({ workout, seasonId: current.id });
      capacity--;
      continue;
    }

    if (!newSeason) {
      const count = await prisma.season.count({ where: { trainerClientId: opts.trainerClientId } });
      newSeason = await prisma.season.create({
        data: {
          trainerClientId: opts.trainerClientId,
          name: `Сезон ${count + 1}`,
          startDate: workout.date,
          isActive: true,
        },
      });
    }
    placed.push({ workout, seasonId: newSeason.id });
  }

  return { placed, newSeason };
}
