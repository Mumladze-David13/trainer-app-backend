# Полная документация API (актуальная, v3, 2026-06-30)

---

## Содержание изменений

1. Упражнения — `weightType` (3 типа) + `metValue`
2. Тренировки — блокировка завершённых + `durationMinutes`
3. Журнал веса тела — `/weight-log`
4. Прогрессия весов в упражнениях — `/exercises/:id/progress`
5. Справочник активностей клиента — `/client-activities`
6. Самостоятельные занятия клиента — `/client-sessions`
7. Потраченные калории — `/client-sessions/burned-calories`
8. Справочник залов — `/gyms` + подсказки адресов Dadata
9. Поля зал и адрес у пользователя (`gymId`, `address`)

---

## 1. Упражнения — тип веса

### Модель Exercise (обновлена)

| Поле | Тип | Описание |
|------|-----|----------|
| `weightType` | `"WEIGHT_KG"` \| `"BODYWEIGHT"` \| `"MACHINE"` | По умолчанию `WEIGHT_KG` |
| `metValue` | `double?` | MET-коэффициент для расчёта ккал |

### POST/PUT `/exercises`

```json
{ "name": "Подтягивания", "weightType": "BODYWEIGHT" }
{ "name": "Жим в тренажёре", "weightType": "MACHINE" }
{ "name": "Бег", "weightType": "WEIGHT_KG", "metValue": 8.0 }
```

### GET `/exercises` — ответ

```json
[
  { "id": "uuid", "name": "Жим лёжа", "weightType": "WEIGHT_KG", "metValue": null, "trainerId": "uuid" },
  { "id": "uuid", "name": "Подтягивания", "weightType": "BODYWEIGHT", "metValue": null, "trainerId": "uuid" },
  { "id": "uuid", "name": "Жим в тренажёре", "weightType": "MACHINE", "metValue": null, "trainerId": "uuid" }
]
```

---

## 2. Тренировки

### Блокировка редактирования завершённой тренировки

`PUT /workouts/:id` если `isCompleted == true` → **403**:
```json
{ "statusCode": 403, "message": "Тренировка уже завершена клиентом и не может быть изменена" }
```

### Новое поле durationMinutes в упражнении тренировки

```json
{
  "exerciseId": "uuid",
  "sets": 3, "reps": 10, "weight": 80,
  "durationMinutes": 20,
  "order": 0
}
```

---

## 3. Журнал веса тела

### POST `/weight-log` (CLIENT)

Body: `{ "weightKg": 82.5, "notes": "Утром натощак" }`

Response 201: `{ "id": "uuid", "clientId": "uuid", "weightKg": 82.5, "date": "...", "notes": "Утром натощак" }`

### GET `/weight-log` (CLIENT)

```json
[
  { "id": "uuid", "weightKg": 85.0, "date": "2026-06-01T...", "notes": null },
  { "id": "uuid", "weightKg": 82.5, "date": "2026-06-15T...", "notes": "После курса" }
]
```
Сортировка: от старых к новым (для графика).

### GET `/weight-log/analysis` (CLIENT)

```json
{
  "logs": [...],
  "stats": {
    "firstWeight": 85.0, "lastWeight": 82.5, "totalChange": -2.5,
    "weeklyRate": -0.42, "periodDays": 42, "entriesCount": 7
  },
  "analysis": "За 6 недель вес снизился на 2.5 кг..."
}
```

Если записей < 2: `{ "logs": [], "analysis": "Недостаточно данных..." }`

### DELETE `/weight-log/:id` (CLIENT) → `{ "message": "Запись удалена" }`

### GET `/weight-log/client/:clientId` (TRAINER) — аналогично GET /weight-log

### GET `/weight-log/client/:clientId/analysis` (TRAINER) — аналогично GET /weight-log/analysis

---

## 4. Прогрессия весов в упражнениях

### GET `/exercises/:exerciseId/progress` (CLIENT)

```json
{
  "exercise": { "id": "uuid", "name": "Жим лёжа", "weightType": "WEIGHT_KG", "metValue": null },
  "history": [
    {
      "date": "2026-05-01T10:00:00.000Z",
      "workoutId": "uuid",
      "weight": 80,
      "sets": 4,
      "reps": 8,
      "setWeights": [75, 80, 80, 80],
      "setReps": [10, 8, 8, 6]
    },
    {
      "date": "2026-05-15T10:00:00.000Z",
      "workoutId": "uuid",
      "weight": 85,
      "sets": 4,
      "reps": 6,
      "setWeights": null,
      "setReps": null
    }
  ]
}
```

`weight` — максимальный вес в сессии (из `setWeights` или общего `weight`).

### GET `/exercises/:exerciseId/progress/analysis` (CLIENT)

```json
{
  "exercise": { ... },
  "history": [ ... ],
  "stats": {
    "firstWeight": 75.0,
    "lastWeight": 90.0,
    "totalGain": 15.0,
    "periodDays": 60,
    "sessionsCount": 8
  },
  "analysis": "За 2 месяца рабочий вес вырос на 15 кг..."
}
```

Если данных < 2: `{ "exercise": {...}, "history": [], "analysis": "Недостаточно данных..." }`

### GET `/exercises/:exerciseId/progress/client/:clientId` (TRAINER)
### GET `/exercises/:exerciseId/progress/client/:clientId/analysis` (TRAINER)

Аналогичный ответ, тренер смотрит данные клиента.

---

## 5. Справочник активностей клиента

### POST `/client-activities` (CLIENT)

Body:
```json
{ "name": "Бег", "metValue": 8.0, "description": "Бег в умеренном темпе" }
```

Response 201:
```json
{ "id": "uuid", "clientId": "uuid", "name": "Бег", "metValue": 8.0, "description": "...", "createdAt": "...", "updatedAt": "..." }
```

### GET `/client-activities` (CLIENT)

```json
[
  { "id": "uuid", "name": "Бег", "metValue": 8.0, "description": "Умеренный темп" },
  { "id": "uuid", "name": "Велосипед", "metValue": 6.0, "description": null },
  { "id": "uuid", "name": "Ходьба", "metValue": 3.5, "description": null }
]
```

Сортировка по имени.

### PUT `/client-activities/:id` (CLIENT)

Body: `{ "name": "Ходьба быстрая", "metValue": 4.5 }` (все поля необязательны)

### DELETE `/client-activities/:id` (CLIENT) → `{ "message": "Активность удалена" }`

### GET `/client-activities/trainer/client/:clientId` (TRAINER)

Тренер смотрит справочник клиента, только чтение.

---

## 6. Самостоятельные занятия клиента

### POST `/client-sessions` (CLIENT)

Body:
```json
{
  "notes": "Утренняя тренировка",
  "exercises": [
    { "clientActivityId": "uuid-из-справочника", "durationMinutes": 30, "order": 0 },
    { "exerciseId": "uuid-из-библиотеки", "sets": 3, "reps": 10, "weight": null, "order": 1 }
  ]
}
```

Для каждого упражнения одно из двух:
- `clientActivityId` — из справочника клиента
- `exerciseId` — из библиотеки тренера

Response 201:
```json
{
  "id": "uuid",
  "clientId": "uuid",
  "date": "2026-06-29T10:00:00.000Z",
  "notes": "Утренняя тренировка",
  "exercises": [
    {
      "id": "uuid",
      "sessionId": "uuid",
      "exerciseId": null,
      "clientActivityId": "uuid",
      "sets": null,
      "reps": null,
      "weight": null,
      "durationMinutes": 30,
      "order": 0,
      "exercise": null,
      "clientActivity": { "id": "uuid", "name": "Бег", "metValue": 8.0 }
    }
  ]
}
```

### GET `/client-sessions` (CLIENT)

Массив занятий, сортировка от новых к старым. Структура как в POST response.

### GET `/client-sessions/:id` (CLIENT)

Одно занятие.

### PUT `/client-sessions/:id` (CLIENT)

Body аналогичен POST. Упражнения полностью заменяются.

### DELETE `/client-sessions/:id` (CLIENT) → `{ "message": "Занятие удалено" }`

### GET `/client-sessions/burned-calories?date=2026-06-29` (CLIENT)

```json
{ "date": "2026-06-29", "burnedCalories": 342.5 }
```

Учитывает: завершённые тренировки тренера + самостоятельные занятия клиента за дату.
Калории считаются через MET × вес(кг) × время(ч).

### GET `/client-sessions/trainer/client/:clientId` (TRAINER)

Тренер смотрит занятия клиента, только чтение.

### GET `/client-sessions/trainer/client/:clientId/burned-calories?date=2026-06-29` (TRAINER)

```json
{ "date": "2026-06-29", "burnedCalories": 342.5 }
```

---

## 8. Справочник залов

> Роли: только `TRAINER` и `TRAINER_CLIENT`. Все эндпоинты требуют JWT.

### Модель Gym

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `String` | UUID |
| `name` | `String` | Название зала (уникальное) |
| `address` | `Address?` | Адрес (объект, см. ниже) |
| `createdAt` | `DateTime` | |
| `updatedAt` | `DateTime` | |

### Модель Address (вложенный объект)

| Поле | Тип | Описание |
|------|-----|----------|
| `country` | `String?` | Страна |
| `region` | `String?` | Регион / область |
| `city` | `String?` | Город |
| `street` | `String?` | Улица |
| `building` | `String?` | Дом |
| `unit` | `String?` | Строение / квартира / офис |

### GET `/gyms` (TRAINER)

Список всех залов, сортировка по имени.

```json
[
  {
    "id": "uuid",
    "name": "Техника тела",
    "address": {
      "country": "Россия",
      "region": "Москва",
      "city": "Москва",
      "street": "Льва Толстого",
      "building": "16",
      "unit": null
    },
    "createdAt": "2026-06-30T...",
    "updatedAt": "2026-06-30T..."
  }
]
```

### GET `/gyms/:id` (TRAINER)

Один зал по ID. 404 если не найден.

### POST `/gyms` (TRAINER)

Body:
```json
{
  "name": "Техника тела",
  "address": {
    "country": "Россия",
    "region": "Москва",
    "city": "Москва",
    "street": "Льва Толстого",
    "building": "16",
    "unit": null
  }
}
```

Response 201: объект зала. 409 если зал с таким именем уже существует.

### PATCH `/gyms/:id` (TRAINER)

Body: любое подмножество полей `name` и/или `address`. 404 / 409 аналогично POST.

### DELETE `/gyms/:id` (TRAINER)

Удаляет зал. При удалении у всех пользователей поле `gymId` становится `null` (onDelete: SetNull). 404 если не найден.

---

## 9. Подсказки адресов — Dadata

### GET `/gyms/address/suggest?q=Москва Льва` (TRAINER)

Прокси к Dadata Suggestions API. Возвращает до 10 вариантов адреса.

> Для работы на сервере нужна переменная окружения `DADATA_API_KEY`. Без ключа возвращает `{ "suggestions": [] }`.

Ответ (формат Dadata):
```json
{
  "suggestions": [
    {
      "value": "г Москва, ул Льва Толстого, д 16",
      "unrestricted_value": "119021, г Москва, ул Льва Толстого, д 16",
      "data": {
        "country": "Россия",
        "region": "Москва",
        "city": "Москва",
        "street": "Льва Толстого",
        "house": "16",
        "flat": null,
        "postal_code": "119021"
      }
    }
  ]
}
```

**Рекомендуемый флоу на Flutter:**
1. Пользователь вводит адрес → запрос к `GET /gyms/address/suggest?q=<текст>`
2. Пользователь выбирает вариант из выпадающего списка
3. Из `data` объекта формируем наш `Address` и отправляем в `POST/PATCH /gyms`

Маппинг полей Dadata → наш Address:

| Dadata `data.*` | Наш `address.*` |
|-----------------|-----------------|
| `country` | `country` |
| `region_with_type` | `region` |
| `city` или `settlement` | `city` |
| `street_with_type` | `street` |
| `house` | `building` |
| `flat` или `block` | `unit` |

---

## 10. Поля зал и адрес у пользователя

В модели `User` добавлены два необязательных поля:

| Поле | Тип | Описание |
|------|-----|----------|
| `gymId` | `String?` | FK на Gym (зал пользователя) |
| `address` | `Address?` | Личный адрес пользователя |

При миграции все существующие пользователи получили `gymId` = ID зала "Техника тела".

---

## Полная таблица всех эндпоинтов

| Метод | URL | Роль | Описание |
|-------|-----|------|----------|
| POST | `/weight-log` | CLIENT | Добавить взвешивание |
| GET | `/weight-log` | CLIENT | История веса тела |
| GET | `/weight-log/analysis` | CLIENT | AI-анализ веса тела |
| DELETE | `/weight-log/:id` | CLIENT | Удалить запись |
| GET | `/weight-log/client/:id` | TRAINER | История веса клиента |
| GET | `/weight-log/client/:id/analysis` | TRAINER | AI-анализ клиента |
| GET | `/exercises/:id/progress` | CLIENT | Прогрессия весов |
| GET | `/exercises/:id/progress/analysis` | CLIENT | AI-анализ прогрессии |
| GET | `/exercises/:id/progress/client/:clientId` | TRAINER | Прогрессия клиента |
| GET | `/exercises/:id/progress/client/:clientId/analysis` | TRAINER | AI-анализ прогрессии |
| POST | `/client-activities` | CLIENT | Создать активность |
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
| GET | `/gyms` | TRAINER | Список залов |
| GET | `/gyms/:id` | TRAINER | Зал по ID |
| POST | `/gyms` | TRAINER | Создать зал |
| PATCH | `/gyms/:id` | TRAINER | Обновить зал |
| DELETE | `/gyms/:id` | TRAINER | Удалить зал |
| GET | `/gyms/address/suggest?q=` | TRAINER | Подсказки адресов (Dadata) |
