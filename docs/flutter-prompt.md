# Flutter Frontend — Prompt для разработки

## Обзор проекта

Мобильное приложение **«Помощник тренера»** для iOS/Android на Flutter.
Два типа пользователей: **тренер** и **клиент**. Тренер составляет программы тренировок, ведёт дневник питания клиентов, общается в чате. Клиент выполняет тренировки, отслеживает КБЖУ.

---

## Подключение к серверу

| Параметр | Значение |
|----------|----------|
| Base URL (REST) | `http://144.31.189.154:8080` |
| WebSocket (чат) | `http://144.31.189.154:8080` namespace `/chat` |
| Протокол WS | Socket.IO |

> Все REST-запросы (кроме `/auth/*`) требуют заголовка:
> `Authorization: Bearer <jwt_token>`

---

## Роли пользователей

| Роль | Описание |
|------|----------|
| `TRAINER` | Только тренер |
| `CLIENT` | Только клиент |
| `TRAINER_CLIENT` | Тренер, который сам является клиентом |

---

## Аутентификация

### POST `/auth/register`
Регистрация нового пользователя.

**Body:**
```json
{
  "email": "trainer@example.com",
  "password": "password123",
  "firstName": "Иван",
  "lastName": "Петров",
  "role": "TRAINER"
}
```
`role`: `TRAINER` | `CLIENT` | `TRAINER_CLIENT`

**Response 201:**
```json
{ "access_token": "eyJhbG..." }
```

---

### POST `/auth/login`
Вход в систему.

**Body:**
```json
{
  "email": "trainer@example.com",
  "password": "password123"
}
```

**Response 200:**
```json
{ "access_token": "eyJhbG..." }
```

JWT payload: `{ sub: userId, email, iat, exp }`

---

## Пользователи

### GET `/users/me`
Получить профиль текущего пользователя.

**Response:**
```json
{
  "id": "uuid",
  "email": "trainer@example.com",
  "firstName": "Иван",
  "lastName": "Петров",
  "role": "TRAINER"
}
```

---

### PUT `/users/me/role`
Обновить роль текущего пользователя.

**Body:** `{ "role": "TRAINER_CLIENT" }`

---

### GET `/users/trainers`
Получить список всех тренеров (для клиента, чтобы выбрать тренера).

**Response:** массив пользователей с ролью TRAINER.

---

## Настройки

### GET `/settings/trainer`
Настройки тренера (лимиты сессий, тарифный план).
> Только для TRAINER / TRAINER_CLIENT.

**Response:**
```json
{
  "sessionsPerSeason": 30,
  "subscriptionPlan": "FREE"
}
```

---

### PUT `/settings/trainer`
Обновить лимит тренировок в сезоне.

**Body:** `{ "sessionsPerSeason": 30 }`

---

### PUT `/settings/trainer/plan`
Изменить тарифный план.

**Body:** `{ "plan": "BASIC" }`
`plan`: `FREE` | `BASIC` | `PRO` | `UNLIMITED`

---

### GET `/settings/client`
Настройки клиента (привязанный тренер).

---

### PUT `/settings/client/trainer`
Привязать клиента к тренеру.

**Body:** `{ "trainerId": "uuid-тренера" }` (или `null` для отвязки)

---

## Клиенты (для тренера)

### GET `/clients`
Список клиентов тренера.
> Только для TRAINER / TRAINER_CLIENT.

**Response:** массив клиентов.

---

### POST `/clients`
Добавить клиента к тренеру.

**Body:** `{ "clientId": "uuid-клиента" }`

---

### GET `/clients/:clientId`
Детальная информация о клиенте с сезонами и тренировками.

---

### DELETE `/clients/:clientId`
Удалить клиента из списка тренера.

---

## Упражнения

### GET `/exercises`
Список упражнений тренера.
> Только для TRAINER / TRAINER_CLIENT.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Жим лёжа",
    "description": "...",
    "muscleGroup": "chest"
  }
]
```

---

### POST `/exercises`
Создать новое упражнение.

**Body:**
```json
{
  "name": "Жим лёжа",
  "description": "Описание техники",
  "muscleGroup": "chest"
}
```

---

### PUT `/exercises/:id`
Обновить упражнение.

**Body:** аналогично POST.

---

### DELETE `/exercises/:id`
Удалить упражнение.

---

## Сезоны

Сезон — период тренировок клиента (например, «Летний цикл»).

### GET `/clients/:clientId/seasons`
Все сезоны клиента.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Летний цикл 2026",
    "startDate": "2026-06-01",
    "endDate": "2026-08-31",
    "workouts": [...]
  }
]
```

---

### POST `/clients/:clientId/seasons`
Создать новый сезон.

**Body:**
```json
{
  "name": "Летний цикл 2026",
  "startDate": "2026-06-01",
  "endDate": "2026-08-31"
}
```
`name` и `endDate` — опциональные.

---

### PUT `/clients/:clientId/seasons/:seasonId`
Обновить сезон. Body аналогичен POST.

---

## Тренировки

### POST `/workouts`
Создать тренировку в сезоне.
> Только для TRAINER / TRAINER_CLIENT.

**Body:**
```json
{
  "seasonId": "uuid-сезона",
  "notes": "Акцент на ноги",
  "exercises": [
    {
      "exerciseId": "uuid",
      "sets": 3,
      "reps": 10,
      "weight": 80,
      "setWeights": [70, 80, 80],
      "supersetGroup": 1,
      "supersetOrder": 1,
      "order": 0
    }
  ]
}
```
`weight`, `setWeights`, `supersetGroup`, `supersetOrder` — опциональные.

---

### GET `/workouts/:id`
Получить тренировку по ID с упражнениями.

---

### PUT `/workouts/:id`
Обновить тренировку (полностью заменяет список упражнений).

**Body:** аналогично POST (без `seasonId`).

---

### DELETE `/workouts/:id`
Удалить тренировку.

---

### PATCH `/workouts/:id/progress`
Сохранить прогресс выполнения (без завершения тренировки).
> Только для CLIENT / TRAINER_CLIENT.

**Body:**
```json
{ "doneExerciseIds": ["uuid-1", "uuid-2"] }
```

---

### POST `/workouts/:id/complete`
Завершить тренировку. Требует ≥50% выполненных упражнений.
> Только для CLIENT / TRAINER_CLIENT.

**Body:**
```json
{ "doneExerciseIds": ["uuid-1", "uuid-2"] }
```

**Response 400** если выполнено < 50%: `{ "message": "Not enough exercises done" }`

---

### GET `/workouts/client/:trainerId/seasons`
Клиент получает свои сезоны от конкретного тренера.
> Только для CLIENT / TRAINER_CLIENT.

---

## Нутрициология (КБЖУ)

### POST `/nutrition/profile`
Создать или обновить профиль питания клиента.
> Только тренер.

**Body:**
```json
{
  "clientId": "uuid-клиента",
  "gender": "male",
  "age": 28,
  "weightKg": 85.0,
  "heightCm": 180.0,
  "activityLevel": "moderate",
  "goal": "gain_muscle",
  "targetWeeklyChange": 0.5
}
```
`gender`: `male` | `female`
`activityLevel`: `sedentary` | `light` | `moderate` | `active` | `very_active`
`goal`: `lose_fat` | `gain_muscle` | `maintain`
`targetWeeklyChange`: кг/неделю (опционально, используется при `lose_fat`)

---

### GET `/nutrition/profile/:clientId`
Получить профиль питания с расчётами КБЖУ.

**Response:**
```json
{
  "profile": { "gender": "male", "weightKg": 85, ... },
  "calculations": {
    "bmr": 1950,
    "tdee": 3022,
    "targetCalories": 3322,
    "macros": { "protein": 170, "fat": 85, "carbs": 384 }
  }
}
```

---

### GET `/nutrition/meal-plan/:clientId?date=2026-07-01`
Получить план питания на дату. Если плана нет — создаётся автоматически.

**Response:**
```json
{
  "id": "uuid",
  "date": "2026-07-01T00:00:00.000Z",
  "targetCalories": 3322,
  "targetProtein": 170,
  "targetCarbs": 384,
  "targetFat": 85,
  "meals": [
    {
      "id": "uuid",
      "type": "breakfast",
      "time": "08:30",
      "notes": null,
      "items": [
        {
          "id": "uuid",
          "amountGrams": 150,
          "foodItem": {
            "id": "uuid",
            "name": "Овсянка",
            "caloriesPer100g": 370,
            "proteinPer100g": 13,
            "carbsPer100g": 67,
            "fatPer100g": 7
          }
        }
      ]
    }
  ]
}
```

---

### POST `/nutrition/meal-plan/:mealPlanId/meals`
Добавить приём пищи в план.

**Body:**
```json
{
  "type": "breakfast",
  "time": "08:30",
  "notes": "После кардио"
}
```
`type`: `breakfast` | `lunch` | `dinner` | `snack`
`time`, `notes` — опциональные.

---

### PATCH `/nutrition/meals/:mealId`
Редактировать приём пищи.

**Body (все поля опциональные):**
```json
{
  "type": "lunch",
  "time": "13:00",
  "notes": "Основной приём"
}
```

---

### DELETE `/nutrition/meals/:mealId`
Удалить приём пищи (каскадно удаляет все продукты в нём).

---

### POST `/nutrition/meals/:mealId/items`
Добавить продукт в приём пищи.

**Body:**
```json
{
  "foodItemId": "uuid-продукта",
  "amountGrams": 150
}
```

---

### PATCH `/nutrition/meal-items/:itemId`
Изменить количество грамм продукта в приёме пищи.

**Body:**
```json
{ "amountGrams": 200 }
```

---

### DELETE `/nutrition/meal-items/:itemId`
Удалить продукт из приёма пищи.

---

### GET `/nutrition/summary/:clientId?date=2026-07-01`
Итоги дня — сколько съедено КБЖУ.

**Response:**
```json
{
  "targetCalories": 3322,
  "targetProtein": 170,
  "targetCarbs": 384,
  "targetFat": 85,
  "consumedCalories": 2100,
  "consumedProtein": 120,
  "consumedCarbs": 250,
  "consumedFat": 60,
  "percentCalories": 63,
  "meals": [
    {
      "id": "uuid",
      "type": "breakfast",
      "time": "08:30",
      "notes": null,
      "items": [
        {
          "id": "uuid",
          "amountGrams": 150,
          "foodItem": { ... },
          "computed": {
            "calories": 555,
            "protein": 20,
            "carbs": 100,
            "fat": 11
          }
        }
      ],
      "subtotal": { "calories": 555, "protein": 20, "carbs": 100, "fat": 11 }
    }
  ]
}
```

---

### GET `/nutrition/food?q=овсянка`
Поиск продуктов по названию (до 20 результатов).

**Response:** массив `FoodItem`.

---

### POST `/nutrition/food`
Добавить новый продукт в справочник.

**Body:**
```json
{
  "name": "Куриная грудка",
  "caloriesPer100g": 165,
  "proteinPer100g": 31,
  "carbsPer100g": 0,
  "fatPer100g": 3.6,
  "category": "meat"
}
```
`category`: `meat` | `dairy` | `grains` | `vegetables` | `fruits` | `nuts` | `other` (опционально)

---

### PATCH `/nutrition/food/:id`
Редактировать продукт в справочнике.

**Body (все поля опциональные):**
```json
{
  "name": "Куриная грудка (варёная)",
  "caloriesPer100g": 150
}
```

---

### DELETE `/nutrition/food/:id`
Удалить продукт из справочника.

**Response:** `{ "message": "Food item deleted" }`

---

## Чат

### REST-эндпоинты

#### GET `/conversations`
Список диалогов текущего пользователя с последним сообщением.

#### POST `/conversations/with/:userId`
Найти или создать диалог с пользователем (по ID собеседника).

**Response:**
```json
{ "id": "uuid-диалога", "trainerId": "...", "clientId": "..." }
```

#### GET `/conversations/:conversationId/messages?limit=50&cursor=uuid`
Сообщения диалога с пагинацией (cursor-based, от новых к старым).

#### POST `/conversations/:conversationId/messages`
Отправить сообщение (HTTP-вариант, дублирует WS).

**Body:** `{ "text": "Привет!" }`

#### PATCH `/conversations/:conversationId/read`
Отметить сообщения диалога как прочитанные.

---

### WebSocket (Socket.IO)

**URL:** `http://144.31.189.154:8080/chat`

**Аутентификация при подключении:**
```js
socket = io('http://144.31.189.154:8080/chat', {
  auth: { token: 'eyJhbG...' }
});
```

После подключения сервер автоматически добавляет клиента во все его комнаты диалогов.

#### Клиент → Сервер

| Событие | Payload | Описание |
|---------|---------|----------|
| `joinConversation` | `{ conversationId }` | Войти в комнату диалога |
| `sendMessage` | `{ conversationId, text }` | Отправить сообщение |
| `markRead` | `{ conversationId }` | Отметить как прочитанное |

#### Сервер → Клиент

| Событие | Payload | Описание |
|---------|---------|----------|
| `joinedConversation` | `{ conversationId }` | Подтверждение входа в комнату |
| `newMessage` | объект сообщения | Новое сообщение в диалоге |
| `messagesRead` | `{ conversationId, userId }` | Кто-то прочитал сообщения |
| `error` | `{ message }` | Ошибка |

---

## AI — генерация программы

### POST `/ai/generate-program`
Генерация программы тренировок через Claude AI (предпросмотр, не сохраняет).
> Только для TRAINER / TRAINER_CLIENT.

**Body:**
```json
{
  "clientId": "uuid-клиента",
  "goal": "gain_muscle",
  "level": "intermediate",
  "daysPerWeek": 3,
  "equipment": "тренажёрный зал",
  "notes": "болит левое плечо"
}
```
`goal`: `lose_fat` | `gain_muscle` | `maintain` | `strength` | `endurance`
`level`: `beginner` | `intermediate` | `advanced`
`equipment`: `штанга и гантели` | `тренажёрный зал` | `только собственный вес` | `дома с гантелями`

**Response 201:**
```json
{
  "workouts": [ { "date": "2026-07-01", "notes": "День 1 — ноги", "exercises": [...] } ],
  "recommendations": "...",
  "usage": { "inputTokens": 500, "outputTokens": 800 }
}
```

**Response 403** — исчерпан месячный лимит токенов тарифа.

---

### POST `/ai/save-program`
Сохранить сгенерированную программу в сезон.

**Body:**
```json
{
  "seasonId": "uuid-сезона",
  "workouts": [
    {
      "date": "2026-07-01",
      "notes": "День 1 — ноги",
      "exercises": [
        {
          "exerciseId": "uuid",
          "sets": 3,
          "reps": 10,
          "weight": 80,
          "order": 0
        }
      ]
    }
  ]
}
```

---

### GET `/ai/usage`
Статистика использования AI: токены, стоимость, последние 20 запросов.

---

## Push-уведомления (FCM)

### PATCH `/users/me/fcm-token`
Сохранить FCM-токен устройства. Вызывать при каждом запуске приложения.

**Body:** `{ "token": "fcm-device-token-xxx" }`

---

## Общие коды ошибок

| Код | Причина |
|-----|---------|
| 400 | Невалидные данные / бизнес-ограничение |
| 401 | Не авторизован (нет/протух токен) |
| 403 | Нет доступа (чужой клиент / исчерпан лимит) |
| 404 | Объект не найден |
| 409 | Конфликт (email занят, дубликат) |

Формат ошибки:
```json
{ "statusCode": 404, "message": "...", "error": "Not Found" }
```

---

## Рекомендуемые Flutter-пакеты

| Назначение | Пакет |
|------------|-------|
| HTTP-запросы | `dio` + `retrofit` |
| WebSocket (Socket.IO) | `socket_io_client` |
| State management | `riverpod` или `bloc` |
| Хранение токена | `flutter_secure_storage` |
| Push-уведомления | `firebase_messaging` |
| Навигация | `go_router` |
