import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

/**
 * Conjunto de datos de recetas simuladas (mock) para poblar la base de datos.
 * Las imágenes son solo nombres de archivo; el frontend deberá resolver la ruta.
 */
const MOCK_RECIPES = [
  {
    title: "Ensalada de pollo y vegetales",
    description: "Receta ligera y saludable de pollo con vegetales frescos.",
    kcal: 350,
    time: "20 min",
    level: "Fácil",
    ingredients: ["pollo", "lechuga", "tomate", "pepino"],
    steps: [
      "Cocina 1 pechuga de pollo a la plancha a fuego medio durante 6–8 minutos por cada lado hasta que esté bien cocida y córtala en tiras",
      "Lava y trocea 2 tazas de lechuga, 1 tomate y 1/2 pepino",
      "Mezcla todos los ingredientes en un bol grande",
      "Añade 1 cucharada de aceite de oliva, una pizca de sal y el jugo de medio limón al gusto",
    ],
    image: "EnsaladadePollo.jpg",
  },
  {
    title: "Tortilla de espinacas",
    description: "Ideal para desayunar o una cena ligera con huevo y espinacas.",
    kcal: 250,
    time: "15 min",
    level: "Fácil",
    ingredients: ["huevo", "espinaca", "cebolla"],
    steps: [
      "Bate 2 huevos en un bol con una pizca de sal y pimienta",
      "Saltea 1 taza de espinaca y 1/4 de cebolla picada en una sartén antiadherente con 1 cucharadita de aceite durante 2 minutos",
      "Añade los huevos batidos y cocina a fuego medio durante 3–4 minutos hasta que cuaje",
      "Voltea la tortilla con cuidado y cocina 1 minuto más antes de servir",
    ],
    image: "TortilladeEspinaca.jpg",
  },
  {
    title: "Sopa de lentejas",
    description: "Sopa reconfortante con lentejas y verduras, económica y nutritiva.",
    kcal: 300,
    time: "40 min",
    level: "Media",
    ingredients: ["lentejas", "zanahoria", "papa", "cebolla"],
    steps: [
      "Enjuaga 1 taza de lentejas y ponlas a cocer en 4 tazas de agua en una olla",
      "Añade 1 zanahoria picada, 1 papa en cubos y 1/2 cebolla picada",
      "Deja hervir a fuego medio durante 30 minutos o hasta que las lentejas estén tiernas",
      "Ajusta la sal al gusto y sirve caliente",
    ],
    image: "SopaLentejas.jpg",
  },
  {
    title: "Smoothie de avena y frutas",
    description: "Bebida nutritiva con avena, banana y frutos rojos.",
    kcal: 200,
    time: "10 min",
    level: "Fácil",
    ingredients: ["avena", "banana", "frutos rojos", "leche"],
    steps: [
      "Remoja 1/4 de taza de avena en 1/2 taza de leche durante 5 minutos",
      "Licúa la avena remojada con 1 banana y 1/2 taza de frutos rojos",
      "Añade 1/2 taza de hielo y licúa nuevamente hasta obtener una textura suave",
      "Sirve frío inmediatamente y disfruta",
    ],
    image: "SmoothiedeAvenayFrutos.jpg",
  },
  {
    title: "Salteado de quinoa con verduras",
    description: "Plato completo y ligero a base de quinoa y vegetales.",
    kcal: 400,
    time: "25 min",
    level: "Media",
    ingredients: ["quinoa", "zanahoria", "brócoli", "pimiento"],
    steps: [
      "Cocina 1 taza de quinoa según las indicaciones del paquete (aproximadamente 15 minutos en agua hirviendo)",
      "Saltea 1 zanahoria en tiras, 1 taza de brócoli en floretes y 1/2 pimiento en tiras en una sartén con 1 cucharada de aceite durante 5 minutos",
      "Añade la quinoa cocida y mezcla bien",
      "Condimenta con sal, pimienta y 2 cucharadas de salsa de soja ligera; cocina 2 minutos más y sirve",
    ],
    image: "SalteadodeQuinoa.jpg",
  },
  {
    title: "Huevos revueltos con tomate",
    description: "Receta rápida y económica para un desayuno completo.",
    kcal: 220,
    time: "10 min",
    level: "Fácil",
    ingredients: ["huevo", "tomate", "cebolla"],
    steps: [
      "Pica 1 tomate mediano y 1/4 de cebolla finamente",
      "Bate 2 huevos en un bol con una pizca de sal",
      "Saltea la cebolla y el tomate en una sartén con 1 cucharadita de aceite durante 2–3 minutos hasta que se ablanden",
      "Añade los huevos batidos y revuelve suavemente a fuego medio hasta que cuajen (aproximadamente 2–3 minutos)",
    ],
    image: "HuevoRevuelto.jpg",
  },
  {
    title: "Pasta con Atún y Tomate",
    description: "Una comida rápida, económica y satisfactoria para cualquier día de la semana.",
    kcal: 450,
    time: "20 min",
    level: "Fácil",
    ingredients: ["pasta", "atún", "tomate", "cebolla", "aceite de oliva"],
    steps: [
      "Cocina 150g de pasta según las instrucciones del paquete.",
      "Mientras tanto, pica finamente 1/2 cebolla y 1 tomate.",
      "En una sartén, sofríe la cebolla en 1 cucharada de aceite de oliva hasta que esté transparente.",
      "Añade el tomate picado y cocina por 5 minutos.",
      "Escurre una lata de atún y añádelo a la sartén. Mezcla bien y sazona con sal y pimienta.",
      "Escurre la pasta cocida y mézclala con la salsa de atún y tomate. Sirve caliente.",
    ],

  },
  {
    title: "Batido Verde Detox",
    description: "Un batido refrescante y lleno de nutrientes para empezar el día con energía.",
    kcal: 180,
    time: "5 min",
    level: "Fácil",
    ingredients: ["espinaca", "pepino", "manzana verde", "limón", "jengibre"],
    steps: [
      "Lava bien 1 taza de espinacas frescas.",
      "Pela y corta 1/2 pepino y 1 manzana verde en trozos.",
      "Añade las espinacas, el pepino y la manzana a la licuadora.",
      "Agrega el jugo de 1/2 limón y una rodaja pequeña de jengibre fresco.",
      "Añade 1 taza de agua fría y licúa todo hasta que esté suave. Sirve inmediatamente.",
    ],

  },
  {
    title: "Tostadas de Aguacate y Huevo",
    description: "Un desayuno clásico, nutritivo y delicioso que te mantendrá lleno.",
    kcal: 320,
    time: "10 min",
    level: "Fácil",
    ingredients: ["pan integral", "aguacate", "huevo", "limón"],
    steps: [
      "Tuesta 2 rebanadas de pan integral a tu gusto.",
      "Mientras tanto, cocina 2 huevos a la plancha o pochados.",
      "Machaca la pulpa de 1 aguacate maduro en un bol. Añade unas gotas de jugo de limón, sal y pimienta.",
      "Unta el aguacate machacado sobre las tostadas calientes.",
      "Coloca un huevo cocido sobre cada tostada. Opcional: decora con chile en hojuelas o cilantro.",
    ],

  },
];

async function main() {
  console.log('Iniciando la siembra de datos...');

  // 1. Limpiar la base de datos para evitar duplicados.
  // La relación `onDelete: Cascade` asegura que al borrar una receta, sus ingredientes y pasos también se borren.
  console.log('Limpiando datos existentes de recetas...');
  await prisma.recipe.deleteMany({});
  console.log('Limpiando usuarios de prueba...');
  await prisma.user.deleteMany({
    where: {
      email: {
        in: ['admin@recetario.com', 'historico@recetario.com'],
      },
    },
  });
  
  // 2. Crear un usuario administrador de prueba.
  // Todas las recetas deben estar asociadas a un autor.
  console.log('Creando usuario administrador...');
  const hashedPassword = await argon2.hash('contraseña');
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@recetario.com',
      name: 'Admin Recetario',
      password: hashedPassword,
      calorieGoal: 2000,
      phone: '123-456-7890',
      address: 'Calle Falsa 123',
      idNumber: '000000000',
    },
  });

  // 3. Crear las recetas de prueba.
  // Se utiliza una escritura anidada de Prisma para crear la receta,
  // sus ingredientes y sus pasos en una sola operación.
  console.log(`Creando ${MOCK_RECIPES.length} recetas de prueba...`);
  for (const recipe of MOCK_RECIPES) {
    await prisma.recipe.create({
      data: {
        title: recipe.title,
        description: recipe.description,
        kcal: recipe.kcal,
        time: recipe.time,
        level: recipe.level,
        image: recipe.image,
        authorId: adminUser.id,
        ingredients: {
          create: recipe.ingredients.map((name) => ({ name })),
        },
        steps: {
          create: recipe.steps.map((description, index) => ({
            description,
            order: index + 1, // El orden de los pasos es importante
          })),
        },
      },
    });
  }

  // --- Crear usuario con datos históricos ---
  console.log('Creando usuario con historial...');
  const historicUserPassword = await argon2.hash('contraseña');
  const historicUser = await prisma.user.create({
    data: {
      email: 'historico@recetario.com',
      name: 'Usuario Histórico',
      password: historicUserPassword,
      calorieGoal: 2200,
      phone: '987-654-3210',
      address: 'Avenida Siempreviva 742',
      idNumber: '111111111',
    },
  });

  // Obtener algunas recetas para asignar al historial.
  const recipesForHistory = await prisma.recipe.findMany({ take: 3 });
  if (recipesForHistory.length > 0) {
    console.log('Creando historial de planes para los últimos 5 días...');
    for (let i = 1; i <= 5; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i); // Restar i días a la fecha actual.

      const plan = await prisma.dailyPlan.create({
        data: {
          userId: historicUser.id,
          date: date,
        },
      });

      // Añadir entre 1 y 3 recetas al plan de este día.
      const entriesToCreate = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < entriesToCreate; j++) {
        const randomRecipe =
          recipesForHistory[
            Math.floor(Math.random() * recipesForHistory.length)
          ];
        await prisma.planEntry.create({
          data: {
            planId: plan.id,
            recipeId: randomRecipe.id,
          },
        });
      }
    }
  }

  console.log('¡Siembra de datos completada exitosamente!');
}

main()
  .catch((e) => {
    console.error('Error durante la siembra de datos:', e);
    process.exit(1);
  })
  .finally(async () => {
    // Cerrar la conexión con la base de datos
    await prisma.$disconnect();
  });