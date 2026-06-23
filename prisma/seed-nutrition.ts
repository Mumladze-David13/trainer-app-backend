import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const foods = [
  // Мясо
  { name: 'Куриная грудка варёная', caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6, category: 'meat' },
  { name: 'Говядина варёная', caloriesPer100g: 254, proteinPer100g: 28, carbsPer100g: 0, fatPer100g: 15, category: 'meat' },
  { name: 'Яйцо куриное', caloriesPer100g: 157, proteinPer100g: 13, carbsPer100g: 1.1, fatPer100g: 11, category: 'meat' },
  { name: 'Тунец консервированный', caloriesPer100g: 96, proteinPer100g: 22, carbsPer100g: 0, fatPer100g: 0.8, category: 'meat' },
  { name: 'Лосось', caloriesPer100g: 208, proteinPer100g: 20, carbsPer100g: 0, fatPer100g: 13, category: 'meat' },
  { name: 'Индейка варёная', caloriesPer100g: 170, proteinPer100g: 29, carbsPer100g: 0, fatPer100g: 5, category: 'meat' },
  { name: 'Свинина нежирная', caloriesPer100g: 242, proteinPer100g: 27, carbsPer100g: 0, fatPer100g: 14, category: 'meat' },
  // Молочные
  { name: 'Творог 5%', caloriesPer100g: 121, proteinPer100g: 17, carbsPer100g: 3, fatPer100g: 5, category: 'dairy' },
  { name: 'Творог 0%', caloriesPer100g: 70, proteinPer100g: 18, carbsPer100g: 3, fatPer100g: 0, category: 'dairy' },
  { name: 'Кефир 1%', caloriesPer100g: 40, proteinPer100g: 3.4, carbsPer100g: 4.7, fatPer100g: 1, category: 'dairy' },
  { name: 'Молоко 2.5%', caloriesPer100g: 52, proteinPer100g: 2.8, carbsPer100g: 4.7, fatPer100g: 2.5, category: 'dairy' },
  { name: 'Йогурт натуральный', caloriesPer100g: 68, proteinPer100g: 5, carbsPer100g: 7, fatPer100g: 1.5, category: 'dairy' },
  { name: 'Сыр твёрдый', caloriesPer100g: 380, proteinPer100g: 25, carbsPer100g: 0, fatPer100g: 30, category: 'dairy' },
  // Крупы
  { name: 'Гречка варёная', caloriesPer100g: 110, proteinPer100g: 4, carbsPer100g: 21, fatPer100g: 1, category: 'grains' },
  { name: 'Рис варёный', caloriesPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28, fatPer100g: 0.3, category: 'grains' },
  { name: 'Овсянка варёная', caloriesPer100g: 88, proteinPer100g: 3, carbsPer100g: 15, fatPer100g: 1.7, category: 'grains' },
  { name: 'Макароны варёные', caloriesPer100g: 158, proteinPer100g: 5.5, carbsPer100g: 31, fatPer100g: 0.9, category: 'grains' },
  { name: 'Хлеб цельнозерновой', caloriesPer100g: 247, proteinPer100g: 9, carbsPer100g: 40, fatPer100g: 3.5, category: 'grains' },
  { name: 'Перловка варёная', caloriesPer100g: 109, proteinPer100g: 3.6, carbsPer100g: 22, fatPer100g: 0.4, category: 'grains' },
  // Овощи
  { name: 'Брокколи', caloriesPer100g: 34, proteinPer100g: 2.8, carbsPer100g: 7, fatPer100g: 0.4, category: 'vegetables' },
  { name: 'Огурец', caloriesPer100g: 15, proteinPer100g: 0.7, carbsPer100g: 3, fatPer100g: 0.1, category: 'vegetables' },
  { name: 'Помидор', caloriesPer100g: 20, proteinPer100g: 0.9, carbsPer100g: 4.2, fatPer100g: 0.2, category: 'vegetables' },
  { name: 'Картофель варёный', caloriesPer100g: 82, proteinPer100g: 2, carbsPer100g: 17, fatPer100g: 0.1, category: 'vegetables' },
  { name: 'Шпинат', caloriesPer100g: 23, proteinPer100g: 2.9, carbsPer100g: 3.6, fatPer100g: 0.4, category: 'vegetables' },
  { name: 'Капуста белокочанная', caloriesPer100g: 27, proteinPer100g: 1.8, carbsPer100g: 6, fatPer100g: 0.1, category: 'vegetables' },
  { name: 'Морковь', caloriesPer100g: 41, proteinPer100g: 0.9, carbsPer100g: 10, fatPer100g: 0.2, category: 'vegetables' },
  // Фрукты
  { name: 'Банан', caloriesPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 23, fatPer100g: 0.3, category: 'fruits' },
  { name: 'Яблоко', caloriesPer100g: 52, proteinPer100g: 0.3, carbsPer100g: 14, fatPer100g: 0.2, category: 'fruits' },
  { name: 'Апельсин', caloriesPer100g: 47, proteinPer100g: 0.9, carbsPer100g: 12, fatPer100g: 0.1, category: 'fruits' },
  { name: 'Груша', caloriesPer100g: 57, proteinPer100g: 0.4, carbsPer100g: 15, fatPer100g: 0.1, category: 'fruits' },
  // Орехи / масла
  { name: 'Миндаль', caloriesPer100g: 579, proteinPer100g: 21, carbsPer100g: 22, fatPer100g: 50, category: 'nuts' },
  { name: 'Грецкий орех', caloriesPer100g: 654, proteinPer100g: 15, carbsPer100g: 14, fatPer100g: 65, category: 'nuts' },
  { name: 'Масло оливковое', caloriesPer100g: 884, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 100, category: 'other' },
  { name: 'Масло подсолнечное', caloriesPer100g: 899, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 100, category: 'other' },
  // Спортивное питание
  { name: 'Протеин сывороточный', caloriesPer100g: 380, proteinPer100g: 75, carbsPer100g: 8, fatPer100g: 5, category: 'other' },
  { name: 'Арахисовое масло', caloriesPer100g: 589, proteinPer100g: 25, carbsPer100g: 20, fatPer100g: 50, category: 'nuts' },
];

async function main() {
  for (const food of foods) {
    await prisma.foodItem.upsert({
      where: { name: food.name },
      update: {},
      create: food,
    });
  }
  console.log(`Seeded ${foods.length} food items`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
