# Обновление API: нутрициология и тренировки (коммиты f6b0ab1, fa9ed70)

Все требуют заголовка `Authorization: Bearer <token>`.

---

## 1. Редактировать продукт в справочнике

**PATCH** `/nutrition/food/:id`

Все поля опциональные — передавай только то, что меняется.

```json
{
  "name": "Куриная грудка (варёная)",
  "caloriesPer100g": 150,
  "proteinPer100g": 29,
  "carbsPer100g": 0,
  "fatPer100g": 3.2,
  "category": "meat"
}
```

**Response 200:** обновлённый объект `FoodItem`.
**Response 404:** продукт не найден.

---

## 2. Удалить продукт из справочника

**DELETE** `/nutrition/food/:id`

**Response 200:** `{ "message": "Food item deleted" }`
**Response 404:** продукт не найден.

---

## 3. Редактировать приём пищи

**PATCH** `/nutrition/meals/:mealId`

Все поля опциональные.

```json
{
  "type": "lunch",
  "time": "13:00",
  "notes": "Основной приём"
}
```

`type`: `breakfast` | `lunch` | `dinner` | `snack`

**Response 200:** обновлённый `Meal` с вложенными `items` и `foodItem`.
**Response 403:** нет доступа к этому клиенту.
**Response 404:** приём пищи не найден.

---

## 4. Удалить приём пищи

**DELETE** `/nutrition/meals/:mealId`

Каскадно удаляет все продукты (MealItem) внутри приёма.

**Response 200:** `{ "message": "Meal deleted" }`
**Response 403:** нет доступа.
**Response 404:** приём пищи не найден.

---

## 5. Изменить количество продукта в приёме пищи

**PATCH** `/nutrition/meal-items/:itemId`

```json
{
  "amountGrams": 200
}
```

`amountGrams` — обязательное, минимум 1.

**Response 200:** обновлённый `MealItem` с вложенным `foodItem`.
**Response 403:** нет доступа.
**Response 404:** запись не найдена.

---

## 6. Поиск еды с сортировкой по рейтингу использования

**GET** `/nutrition/food?q=курица&clientId=uuid-клиента`

| Параметр | Обязательный | Описание |
|----------|-------------|----------|
| `q` | нет | Фильтр по названию (регистр не важен) |
| `clientId` | нет | UUID клиента для сортировки по частоте |

**Поведение:**
- Без `clientId` — возвращает до 20 продуктов, отсортированных по алфавиту (старое поведение)
- С `clientId` — те же 20 продуктов, но сначала идут те, которые клиент добавлял в приёмы пищи чаще всего
- `q` можно не передавать — тогда вернутся топ-20 продуктов клиента без фильтра

**Рекомендуемое использование во Flutter:**
```
// При открытии экрана поиска — сразу показать топ клиента
GET /api/nutrition/food?clientId={clientId}

// При вводе текста — поиск с приоритетом любимых продуктов
GET /api/nutrition/food?q=кур&clientId={clientId}
```

**Response 200:** массив `FoodItem`, отсортированный по убыванию частоты использования, затем по алфавиту.

---

## 7. Исправление: прогресс клиента сохраняется при редактировании тренировки

**PUT** `/workouts/:id` — поведение изменилось.

**Раньше:** при обновлении списка упражнений все записи удалялись и создавались заново → клиент терял отметки выполненных упражнений (`isDone`).

**Теперь:** упражнения сопоставляются по `exerciseId`:
- Упражнение уже есть в тренировке → обновляются `sets/reps/weight/order`, **`isDone` сохраняется**
- Упражнение новое → создаётся с `isDone: false`
- Упражнение убрал тренер → удаляется

Со стороны Flutter ничего менять не нужно — изменение прозрачное.

---

## Итог всех изменений

| Сущность | Create | Read | Update | Delete |
|----------|--------|------|--------|--------|
| FoodItem (справочник) | `POST /nutrition/food` | `GET /nutrition/food?q=&clientId=` | **`PATCH /nutrition/food/:id`** | **`DELETE /nutrition/food/:id`** |
| Meal (приём пищи) | `POST /nutrition/meal-plan/:id/meals` | внутри meal-plan | **`PATCH /nutrition/meals/:id`** | **`DELETE /nutrition/meals/:id`** |
| MealItem (продукт в приёме) | `POST /nutrition/meals/:id/items` | внутри meal-plan | **`PATCH /nutrition/meal-items/:id`** | `DELETE /nutrition/meal-items/:id` |
