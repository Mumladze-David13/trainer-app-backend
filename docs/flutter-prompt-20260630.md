# Flutter промт: залы и адреса (2026-06-30)

Используй этот промт для Flutter-разработчика / AI-агента.

---

## Промт

Ты Flutter-разработчик. Нужно реализовать управление залами и адресами в мобильном приложении «Помощник тренера» (iOS/Android). API: `http://144.31.189.154:8080/api`. Авторизация: `Authorization: Bearer <token>`.

---

### 1. Справочник залов (тренер)

Тренер управляет списком залов, в которых работает. Доступно только ролям `TRAINER` и `TRAINER_CLIENT`.

#### Dart-модели

```dart
class Address {
  final String? country;
  final String? region;
  final String? city;
  final String? street;
  final String? building;
  final String? unit;   // строение, квартира, офис

  Address({this.country, this.region, this.city, this.street, this.building, this.unit});

  factory Address.fromJson(Map<String, dynamic> json) => Address(
    country: json['country'],
    region: json['region'],
    city: json['city'],
    street: json['street'],
    building: json['building'],
    unit: json['unit'],
  );

  Map<String, dynamic> toJson() => {
    if (country != null) 'country': country,
    if (region != null) 'region': region,
    if (city != null) 'city': city,
    if (street != null) 'street': street,
    if (building != null) 'building': building,
    if (unit != null) 'unit': unit,
  };

  String get displayShort => [city, street, building].whereType<String>().join(', ');
  String get displayFull => [country, region, city, street, building, unit].whereType<String>().join(', ');
}

class Gym {
  final String id;
  final String name;
  final Address? address;
  final DateTime createdAt;
  final DateTime updatedAt;

  Gym({required this.id, required this.name, this.address, required this.createdAt, required this.updatedAt});

  factory Gym.fromJson(Map<String, dynamic> json) => Gym(
    id: json['id'],
    name: json['name'],
    address: json['address'] != null ? Address.fromJson(json['address']) : null,
    createdAt: DateTime.parse(json['createdAt']),
    updatedAt: DateTime.parse(json['updatedAt']),
  );
}
```

#### API-вызовы

```dart
// Список залов
GET /gyms
Response: [ { "id": "uuid", "name": "Техника тела", "address": { "country": "Россия", "region": "...", "city": "Москва", "street": "...", "building": "16", "unit": null }, "createdAt": "...", "updatedAt": "..." } ]

// Создать зал
POST /gyms
Body: { "name": "Техника тела", "address": { "country": "Россия", "city": "Москва", "street": "Льва Толстого", "building": "16" } }
Response 201: объект Gym

// Обновить зал
PATCH /gyms/:id
Body: любое подмножество полей name и/или address

// Удалить зал
DELETE /gyms/:id
```

#### Экран «Залы»

Раздел в настройках тренера (или отдельная вкладка):

- **Список залов** — карточка с названием и коротким адресом (`city, street, building`)
- **FAB «+»** → bottom sheet / экран «Создать зал»
- Свайп по карточке → кнопки «Редактировать» и «Удалить»
- При удалении — диалог подтверждения

**Форма создания/редактирования зала:**
- Поле «Название зала» (обязательное)
- Поле адреса с автодополнением (см. раздел 2 ниже)

---

### 2. Автодополнение адреса через Dadata

Для ввода адреса использовать наш эндпоинт-прокси к Dadata. Не вызывать Dadata напрямую — ключ хранится на сервере.

#### Эндпоинт

```
GET /gyms/address/suggest?q=<поисковый текст>
```

Ответ:
```json
{
  "suggestions": [
    {
      "value": "г Москва, ул Льва Толстого, д 16",
      "unrestricted_value": "119021, г Москва, р-н Хамовники, ул Льва Толстого, д 16",
      "data": {
        "country": "Россия",
        "region_with_type": "г Москва",
        "city": "Москва",
        "street_with_type": "ул Льва Толстого",
        "house": "16",
        "flat": null,
        "block": null,
        "postal_code": "119021"
      }
    }
  ]
}
```

#### Виджет адресного поля

```dart
class AddressSearchField extends StatefulWidget {
  final Address? initialValue;
  final ValueChanged<Address> onSelected;
}
```

Логика:
1. Пользователь начинает вводить текст → через 300 мс debounce вызов `GET /gyms/address/suggest?q=<текст>`
2. Под полем выпадающий список из `suggestions[].value`
3. При выборе варианта — маппинг `data` в наш `Address`:

```dart
Address addressFromDadata(Map<String, dynamic> data) => Address(
  country: data['country'],
  region: data['region_with_type'],
  city: data['city'] ?? data['settlement'],
  street: data['street_with_type'],
  building: data['house'],
  unit: data['flat'] ?? data['block'],
);
```

4. Выбранный адрес отображается в поле как `address.displayFull`
5. Кнопка «✕» сбрасывает выбор и позволяет ввести заново

**Минимум 3 символа** для начала поиска — не спамить запросами.

---

### 3. Поля зал и адрес в профиле пользователя

В модели `User` появились два новых необязательных поля. Обнови Dart-модель:

```dart
class User {
  // ... существующие поля ...
  final String? gymId;       // ID зала
  final Address? address;    // личный адрес пользователя
  // gym объект не возвращается в /users/me — только gymId
}
```

Ответ `GET /users/me` теперь содержит:
```json
{
  "id": "uuid",
  "email": "...",
  "firstName": "...",
  "lastName": "...",
  "role": "TRAINER",
  "gymId": "uuid-зала-или-null",
  "address": null,
  "createdAt": "..."
}
```

> На текущий момент редактирование `gymId` и `address` пользователя через UI не требуется — поля только отображаются если нужно. Эндпоинтов `PATCH /users/me` пока нет.

---

### 4. Сводная таблица новых эндпоинтов

| Метод | URL | Кто | Описание |
|-------|-----|-----|----------|
| GET | `/gyms` | TRAINER | Список залов |
| GET | `/gyms/:id` | TRAINER | Зал по ID |
| POST | `/gyms` | TRAINER | Создать зал |
| PATCH | `/gyms/:id` | TRAINER | Обновить зал |
| DELETE | `/gyms/:id` | TRAINER | Удалить зал |
| GET | `/gyms/address/suggest?q=` | TRAINER | Подсказки адресов |

**Коды ответов:**
- `201` — зал создан
- `404` — зал не найден
- `409` — зал с таким именем уже существует

---

### Что НЕ нужно менять

- Логика авторизации, JWT, роли — без изменений
- Все существующие экраны — без изменений
- Все существующие пользователи уже имеют `gymId` зала «Техника тела» — это нормально, поле необязательное
