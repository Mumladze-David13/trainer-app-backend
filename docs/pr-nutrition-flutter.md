# feat: Nutrition module — питание, КБЖУ, дневник еды

### Что добавлено на бэкенде

Полный модуль нутрициологии: профиль питания клиента, дневник еды по дням, справочник продуктов, расчёты BMR/TDEE/КБЖУ.

---

### Новые REST endpoints

Base URL: `/nutrition` — все требуют `Authorization: Bearer <token>`

#### Профиль питания

```
POST /nutrition/profile
Body: {
  clientId: string,
  gender: "male" | "female",
  age: number,
  weightKg: number,
  heightCm: number,
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active",
  goal: "lose_fat" | "maintain" | "gain_muscle",
  targetWeeklyChange?: number   // кг/нед, отрицательное = похудение
}
// Создаёт или обновляет профиль (только тренер)
```

```
GET /nutrition/profile/:clientId
// Возвращает профиль + расчёты:
{
  profile: { ... },
  calculations: {
    bmr: number,           // базовый обмен, ккал
    tdee: number,          // суточная норма с учётом активности
    targetCalories: number,
    macros: { protein: number, fat: number, carbs: number }  // граммы
  }
}
```

#### Дневник питания

```
GET /nutrition/meal-plan/:clientId?date=2026-07-01
// Возвращает план на дату. Если плана нет — создаёт автоматически с целевыми КБЖУ.
// Ответ: { id, date, targetCalories, targetProtein, targetCarbs, targetFat, meals: [...] }
```

```
POST /nutrition/meal-plan/:mealPlanId/meals
Body: { type: "breakfast" | "lunch" | "dinner" | "snack", time?: "08:30", notes?: string }
// Добавляет приём пищи в план
```

```
POST /nutrition/meals/:mealId/items
Body: { foodItemId: string, amountGrams: number }
// Добавляет продукт в приём пищи
```

```
DELETE /nutrition/meal-items/:itemId
// Удаляет продукт из приёма пищи
```

#### Итоги дня

```
GET /nutrition/summary/:clientId?date=2026-07-01
// Возвращает:
{
  targetCalories: number,
  targetProtein: number,
  targetCarbs: number,
  targetFat: number,
  consumedCalories: number,
  consumedProtein: number,
  consumedCarbs: number,
  consumedFat: number,
  percentCalories: number,    // % от нормы
  meals: [
    {
      id, type, time, notes,
      subtotal: { calories, protein, carbs, fat },
      items: [
        {
          id, amountGrams,
          foodItem: { name, caloriesPer100g, ... },
          computed: { calories, protein, carbs, fat }  // уже посчитано под amountGrams
        }
      ]
    }
  ]
}
```

#### Справочник продуктов

```
GET /nutrition/food?q=курица
// Поиск по названию (регистронезависимый), возвращает до 20 результатов
// [{ id, name, caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g, category }]

POST /nutrition/food
Body: { name, caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g, category? }
// Добавить свой продукт
```

---

### Что нужно реализовать во Flutter

- [ ] Экран профиля питания клиента (форма + отображение TDEE/КБЖУ)
- [ ] Дневник питания: список приёмов пищи на выбранную дату
- [ ] Добавление приёма пищи (тип + время)
- [ ] Поиск и добавление продуктов в приём пищи (поле ввода граммов)
- [ ] Круговая/полосовая диаграмма прогресса КБЖУ за день (`summary` endpoint)
- [ ] Экран/модалка поиска продуктов с возможностью добавить свой

---

### Примечания

- В БД уже есть **37 базовых продуктов** (мясо, молочка, крупы, овощи, фрукты, орехи, протеин)
- Тренер создаёт/редактирует профиль питания клиента; клиент читает свой профиль и ведёт дневник
- При запросе плана на дату без существующего плана — бэкенд создаёт его автоматически, ничего дополнительно делать не нужно
