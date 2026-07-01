# Flutter промт: реализация новых функций (2026-06-29, v2)

Используй этот промт для Flutter-разработчика / AI-агента.

---

## Промт

Ты Flutter-разработчик. Нужно реализовать новые функции в мобильном приложении «Помощник тренера» (iOS/Android). API: `http://144.31.189.154:8080/api`. Авторизация: `Authorization: Bearer <token>`.

---

### 1. Тип веса упражнения (три варианта)

**Изменения в модели `Exercise`** — добавь поля:
```dart
final String weightType;  // "WEIGHT_KG" | "BODYWEIGHT" | "MACHINE"
final double? metValue;
```

**При создании/редактировании упражнения** (тренер):
- Добавь выбор из трёх вариантов (SegmentedButton или RadioGroup):
  - **«С весом (кг)»** → `"WEIGHT_KG"` — свободные веса, гантели, штанга
  - **«Без веса»** → `"BODYWEIGHT"` — подтягивания, отжимания, собственный вес
  - **«Тренажёр»** → `"MACHINE"` — упражнения на тренажёрах с плитками
- Поле `metValue` (double, опционально) — для кардио (бег, велосипед)

**При отображении упражнения в тренировке:**
- `WEIGHT_KG` → показывать поле веса как обычно (кг)
- `BODYWEIGHT` → поле веса не показывать
- `MACHINE` → показывать поле веса (кг), но можно добавить иконку/метку «тренажёр»

---

### 2. Блокировка редактирования завершённой тренировки

У тренера: если `workout.isCompleted == true`:
- Скрыть кнопку «Редактировать»
- Показать бейдж/иконку ✅ «Выполнено клиентом»
- При попытке PUT `/workouts/:id` сервер вернёт 403 — покажи snackbar с текстом из `message`

---

### 3. Журнал веса тела

**Два сценария:** клиент управляет своими записями; тренер видит историю клиента.

#### Экран клиента — вкладка «Вес» (новая)

**Верхняя часть — линейный график** (пакет `fl_chart` или `syncfusion_flutter_charts`):
- X: дата, Y: вес в кг
- Данные: `GET /weight-log` → массив `[{id, weightKg, date, notes}]`

**Кнопка «AI-анализ»** → `GET /weight-log/analysis`:
```json
{
  "stats": { "firstWeight": 85.0, "lastWeight": 82.5, "totalChange": -2.5, "weeklyRate": -0.42, "periodDays": 42 },
  "analysis": "Текст анализа от ИИ..."
}
```
Показывай в bottom sheet: карточки со stats + текст анализа.

**Список записей** — дата, вес, заметка. Свайп влево → удалить (`DELETE /weight-log/:id`).

**FAB «+»** → bottom sheet «Добавить взвешивание»:
```dart
// POST /weight-log
body: { "weightKg": 82.5, "notes": "Утром натощак" }
```

#### Экран тренера — вкладка «Вес тела» в карточке клиента

- `GET /weight-log/client/:clientId` — график
- `GET /weight-log/client/:clientId/analysis` — AI-анализ
- Только просмотр, без добавления/удаления

---

### 4. Прогрессия весов в упражнениях (динамика)

Отдельная функция для отслеживания того, как растёт рабочий вес клиента в конкретном упражнении.

#### Экран клиента — в детали упражнения

**Кнопка «Прогрессия»** → открывает экран/bottom sheet:
- Линейный график: X — дата тренировки, Y — максимальный вес
- `GET /exercises/:exerciseId/progress`
```json
{
  "exercise": { "id": "uuid", "name": "Жим лёжа", "weightType": "WEIGHT_KG" },
  "history": [
    { "date": "2026-05-01T...", "workoutId": "uuid", "weight": 80, "sets": 4, "reps": 8, "setWeights": [75, 80, 80, 80], "setReps": [10, 8, 8, 6] },
    { "date": "2026-05-08T...", "workoutId": "uuid", "weight": 82.5, "sets": 4, "reps": 8, "setWeights": null, "setReps": null }
  ]
}
```

**Кнопка «AI-анализ»** → `GET /exercises/:exerciseId/progress/analysis`
```json
{
  "exercise": { ... },
  "history": [ ... ],
  "stats": { "firstWeight": 75.0, "lastWeight": 90.0, "totalGain": 15.0, "periodDays": 60, "sessionsCount": 8 },
  "analysis": "За 2 месяца рабочий вес в жиме лёжа вырос на 15 кг..."
}
```

#### Экран тренера — в карточке клиента, вкладка упражнений

- `GET /exercises/:exerciseId/progress/client/:clientId`
- `GET /exercises/:exerciseId/progress/client/:clientId/analysis`
- Только просмотр

#### Dart-модели:
```dart
class ExerciseProgressEntry {
  final DateTime date;
  final String workoutId;
  final double? weight;
  final int? sets;
  final int? reps;
  final List<double>? setWeights;
  final List<int>? setReps;
}

class ExerciseProgress {
  final Exercise exercise;
  final List<ExerciseProgressEntry> history;
  final ExerciseProgressStats? stats;
  final String? analysis;
}

class ExerciseProgressStats {
  final double? firstWeight;
  final double? lastWeight;
  final double totalGain;
  final int periodDays;
  final int sessionsCount;
}
```

---

### 5. Справочник активностей клиента

Клиент ведёт **свой справочник** активностей (бег, ходьба, плавание, велосипед и т.д.) с MET-значениями для расчёта калорий.

#### Управление справочником (клиент)

Отдельный экран «Мои активности» или раздел в настройках:

**Список** `GET /client-activities` → карточки с названием и MET.

**FAB «+»** → bottom sheet «Добавить активность»:
```dart
// POST /client-activities
body: { "name": "Бег", "metValue": 8.0, "description": "Бег в умеренном темпе" }
```

Редактирование — `PUT /client-activities/:id`.  
Удаление — `DELETE /client-activities/:id`.

#### Dart-модель:
```dart
class ClientActivity {
  final String id;
  final String name;
  final double? metValue;
  final String? description;
}
```

---

### 6. Самостоятельные занятия клиента

Клиент может добавлять свои тренировки — ходьба, пробежка, домашние упражнения.

#### Экран клиента — вкладка «Мои занятия» (новая)

**Список** `GET /client-sessions` → карточки: дата, заметка, список активностей.

**FAB «+»** → экран создания:
- Поле «Заметка»
- Список активностей (можно добавить несколько):
  - **Из справочника клиента** (`GET /client-activities`) → указать `clientActivityId`
  - **Из библиотеки тренера** (`GET /exercises`) → указать `exerciseId`
  - Для каждой: подходы + повторения ИЛИ длительность (минуты)

```json
// POST /client-sessions
{
  "notes": "Утренняя тренировка",
  "exercises": [
    { "clientActivityId": "uuid-из-справочника", "durationMinutes": 30, "order": 0 },
    { "exerciseId": "uuid-из-библиотеки", "sets": 3, "reps": 10, "order": 1 }
  ]
}
```

**Редактирование** — `PUT /client-sessions/:id`, body аналогичен POST.
**Удаление** — `DELETE /client-sessions/:id`.

#### Экран тренера — вкладка «Свои занятия» в карточке клиента

`GET /client-sessions/trainer/client/:clientId` — только просмотр.
`GET /client-activities/trainer/client/:clientId` — справочник активностей клиента.

#### Dart-модели:
```dart
class ClientSession {
  final String id;
  final DateTime date;
  final String? notes;
  final List<ClientSessionExercise> exercises;
}

class ClientSessionExercise {
  final String id;
  final String? exerciseId;
  final String? clientActivityId;
  final int? sets;
  final int? reps;
  final double? weight;
  final double? durationMinutes;
  final int order;
  final Exercise? exercise;
  final ClientActivity? clientActivity;
}
```

---

### 7. Потраченные калории в разделе питания

В экране итогов питания за день добавить строку «Потрачено».

**Запрос:** `GET /client-sessions/burned-calories?date=2026-06-29`
```json
{ "date": "2026-06-29", "burnedCalories": 342.5 }
```

**Итоговый UI:**
```
Цель:        3 322 ккал
Потреблено:  2 100 ккал  (из /nutrition/summary)
Потрачено:   -342 ккал   (из /client-sessions/burned-calories)
──────────────────────
Осталось:    1 564 ккал
```

Для тренера — `GET /client-sessions/trainer/client/:clientId/burned-calories?date=...`

---

## Полная сводка API-эндпоинтов

| Метод | URL | Кто | Описание |
|-------|-----|-----|----------|
| POST | `/weight-log` | CLIENT | Добавить взвешивание |
| GET | `/weight-log` | CLIENT | История веса тела |
| GET | `/weight-log/analysis` | CLIENT | AI-анализ веса тела |
| DELETE | `/weight-log/:id` | CLIENT | Удалить запись |
| GET | `/weight-log/client/:id` | TRAINER | История веса клиента |
| GET | `/weight-log/client/:id/analysis` | TRAINER | AI-анализ веса клиента |
| GET | `/exercises/:id/progress` | CLIENT | Прогрессия весов упражнения |
| GET | `/exercises/:id/progress/analysis` | CLIENT | AI-анализ прогрессии |
| GET | `/exercises/:id/progress/client/:clientId` | TRAINER | Прогрессия клиента |
| GET | `/exercises/:id/progress/client/:clientId/analysis` | TRAINER | AI-анализ прогрессии клиента |
| POST | `/client-activities` | CLIENT | Создать активность в справочнике |
| GET | `/client-activities` | CLIENT | Список активностей |
| PUT | `/client-activities/:id` | CLIENT | Обновить активность |
| DELETE | `/client-activities/:id` | CLIENT | Удалить активность |
| GET | `/client-activities/trainer/client/:id` | TRAINER | Справочник клиента |
| POST | `/client-sessions` | CLIENT | Создать занятие |
| GET | `/client-sessions` | CLIENT | Свои занятия |
| GET | `/client-sessions/:id` | CLIENT | Занятие по ID |
| PUT | `/client-sessions/:id` | CLIENT | Обновить занятие |
| DELETE | `/client-sessions/:id` | CLIENT | Удалить занятие |
| GET | `/client-sessions/burned-calories?date=` | CLIENT | Ккал за день |
| GET | `/client-sessions/trainer/client/:id` | TRAINER | Занятия клиента |
| GET | `/client-sessions/trainer/client/:id/burned-calories?date=` | TRAINER | Ккал клиента |

---

## Что НЕ нужно менять

- Логика авторизации, JWT, роли — без изменений
- Существующие экраны тренировок, нутрициологии, чата — без изменений (только дополнения выше)
- Упражнения в уже существующих тренировках имеют `weightType: "WEIGHT_KG"` по умолчанию
