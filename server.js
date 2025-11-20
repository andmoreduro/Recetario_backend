import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import path from "path";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();
const app = express();
const PORT = 3001;

// Configuración para __dirname en ES Modules, necesario para servir archivos estáticos.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de Middleware
const corsOptions = {
  origin: 'https://recetario-s1gx.onrender.com',
}
app.use(cors(corsOptions));
app.use(bodyParser.json());

// Middleware para servir los archivos estáticos del frontend desde la carpeta 'dist'
app.use(express.static(path.join(__dirname, "dist")));

/**
 * Genera un hash de la contraseña utilizando Argon2.
 * @param {string} password La contraseña en texto plano.
 * @returns {Promise<string>} Una promesa que resuelve con el hash de la contraseña.
 */
const hashPassword = (password) => {
  return argon2.hash(password);
};

/**
 * Verifica una contraseña comparándola con un hash de Argon2 almacenado.
 * @param {string} password La contraseña a verificar.
 * @param {string} storedHash El hash almacenado en la base de datos.
 * @returns {Promise<boolean>} Una promesa que resuelve a verdadero si la contraseña es correcta.
 */
const verifyPassword = (password, storedHash) => {
  return argon2.verify(storedHash, password);
};

// --- Definición de Endpoints de la API ---

// Endpoint para registrar un nuevo usuario.
app.post("/api/register", async (req, res) => {
  const { name, email, password, calorieGoal, phone, address, idNumber } = req.body;

  // Validación básica de campos obligatorios.
  if (!name || !email || !password || !calorieGoal || !phone || !address || !idNumber) {
    return res.status(400).json({ message: "Todos los campos son obligatorios." });
  }

  try {
    const hashedPassword = await hashPassword(password);
    const avatarUrl = `https://i.pravatar.cc/150?u=${encodeURIComponent(email)}`;

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        calorieGoal: Number(calorieGoal),
        avatar: avatarUrl,
        phone,
        address,
        idNumber,
      },
    });

    // Devuelve el objeto del nuevo usuario, excluyendo la contraseña por seguridad.
    const userToReturn = { ...newUser };
    delete userToReturn.password;

    res.status(201).json(userToReturn);
  } catch (error) {
    // Maneja el error de restricción ÚNICA para el correo electrónico.
    if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
      return res.status(409).json({ message: "Ya existe una cuenta con este correo." });
    }
    console.error(error);
    res.status(500).json({ message: "Error al registrar el usuario." });
  }
});

// Endpoint para autenticar a un usuario.
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  console.log(`[Login Attempt] Email: ${email}`);

  if (!email || !password) {
    console.log("[Login Failure] Email o contraseña no proporcionados.");
    return res.status(400).json({ message: "Correo y contraseña son obligatorios." });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log(`[Login Failure] Usuario no encontrado: ${email}`);
      return res.status(401).json({ message: "Correo o contraseña incorrectos." });
    }

    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      console.log(`[Login Failure] Contraseña incorrecta para el usuario: ${email}`);
      return res.status(401).json({ message: "Correo o contraseña incorrectos." });
    }

    // Devuelve el objeto del usuario encontrado, excluyendo la contraseña por seguridad.
    const userToReturn = { ...user };
    delete userToReturn.password;

    console.log(`[Login Success] Usuario autenticado: ${email}`);
    res.status(200).json(userToReturn);
  } catch (error) {
    console.error("[Login Error] Error inesperado durante el login:", error);
    res.status(500).json({ message: "Error del servidor." });
  }
});

// --- Endpoints de Recetas ---

// Endpoint para obtener todas las recetas.
app.get("/api/recipes", async (req, res) => {
  try {
    const recipes = await prisma.recipe.findMany({
      include: {
        ingredients: true, // Incluye los ingredientes relacionados
        steps: {
          orderBy: {
            order: 'asc', // Ordena los pasos
          },
        },
      },
    });
    res.status(200).json(recipes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener las recetas." });
  }
});



// Busca recetas que contengan un ingrediente específico.
// La búsqueda es case-insensitive gracias al `mode: 'insensitive'`, compatible con PostgreSQL.
app.get("/api/recipes/search", async (req, res) => {
  const { ingredient } = req.query;

  if (!ingredient) {
    return res.status(400).json({ message: "El parámetro 'ingredient' es requerido." });
  }

  try {
    const recipes = await prisma.recipe.findMany({
      where: {
        ingredients: {
          some: {
            name: {
              contains: ingredient,
              mode: 'insensitive',
            },
          },
        },
      },
      include: {
        ingredients: true,
        steps: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    });
    res.status(200).json(recipes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al buscar recetas." });
  }
});

// Devuelve una lista plana [string, string, ...] de todos los nombres de ingredientes
// únicos en la base de datos. Ideal para funciones de autocompletado en el frontend.
app.get("/api/ingredients/unique", async (req, res) => {
  try {
    const ingredients = await prisma.ingredient.findMany({
      distinct: ['name'],
      select: {
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
    res.status(200).json(ingredients.map(i => i.name));
  } catch (error) {
    console.error("Error al obtener ingredientes únicos:", error);
    res.status(500).json({ message: "Error al obtener ingredientes." });
  }
});

// Endpoint para obtener todos los nombres de ingredientes únicos.
app.get("/api/ingredients/unique", async (req, res) => {
  try {
    const ingredients = await prisma.ingredient.findMany({
      distinct: ['name'],
      select: {
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
    res.status(200).json(ingredients.map(i => i.name));
  } catch (error) {
    console.error("Error al obtener ingredientes únicos:", error);
    res.status(500).json({ message: "Error al obtener ingredientes." });
  }
});

// --- Endpoints del Planificador ---

// Middleware de autenticación simulado. Extrae el ID de usuario de las cabeceras.
// ATENCIÓN: Este método no es seguro para producción. En una aplicación real, se debe
// implementar un sistema de autenticación basado en tokens (ej. JWT).
const getUserId = (req) => {
  const userId = req.headers['x-user-id'];
  return userId ? parseInt(userId, 10) : null;
};

// Obtiene o crea el planificador para el día de calendario actual (en UTC).
// Utiliza `upsert` para garantizar que solo exista un `DailyPlan` por usuario y día.
app.get("/api/planner/today", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "No autorizado: ID de usuario no proporcionado." });
  }

  try {
    // Verificar si el usuario realmente existe para evitar errores de clave foránea.
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(401).json({ message: "No autorizado: El usuario no existe." });
    }

    // Normaliza la fecha a la medianoche UTC para garantizar la unicidad por día de calendario,
    // independientemente de la zona horaria del cliente o del servidor.
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const plan = await prisma.dailyPlan.upsert({
      where: {
        userId_date: {
          userId: userId,
          date: today,
        },
      },
      update: {}, // Si se encuentra, no hacer nada, solo devolverlo con sus relaciones.
      create: {
        userId: userId,
        date: today,
      },
      include: {
        entries: {
          include: {
            recipe: true,
          },
          orderBy: {
            id: 'asc',
          },
        },
      },
    });

    res.status(200).json(plan);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener el planificador diario." });
  }
});

// Endpoint para añadir una receta al planificador del día.
app.post("/api/planner/entries", async (req, res) => {
  const userId = getUserId(req);
  const { recipeId, planId } = req.body;

  if (!userId) {
    return res.status(401).json({ message: "No autorizado." });
  }
  if (!recipeId || !planId) {
    return res.status(400).json({ message: "recipeId y planId son requeridos." });
  }

  try {
    const newEntry = await prisma.planEntry.create({
      data: {
        planId,
        recipeId,
      },
      include: {
        recipe: true // Devolver la receta completa para actualizar la UI
      }
    });
    res.status(201).json(newEntry);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al añadir la receta al plan." });
  }
});

// Endpoint para eliminar una entrada del planificador.
app.delete("/api/planner/entries/:id", async (req, res) => {
  const userId = getUserId(req);
  const entryId = parseInt(req.params.id, 10);

  if (!userId) {
    return res.status(401).json({ message: "No autorizado." });
  }

  try {
    // Verificación opcional: asegurar que la entrada pertenezca al plan del usuario.
    const entry = await prisma.planEntry.findUnique({
      where: { id: entryId },
      select: { plan: { select: { userId: true } } },
    });

    if (!entry || entry.plan.userId !== userId) {
      return res.status(404).json({ message: "Entrada no encontrada o no pertenece al usuario." });
    }

    await prisma.planEntry.delete({
      where: { id: entryId },
    });
    res.status(204).send(); // 204 No Content
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar la receta del plan." });
  }
});

// --- Endpoints de Usuario ---

// Endpoint para obtener la fecha de la primera entrada del historial del usuario.
app.get("/api/users/me/first-entry-date", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "No autorizado." });
  }

  try {
    const firstPlan = await prisma.dailyPlan.findFirst({
      where: { userId },
      orderBy: {
        date: 'asc',
      },
      select: {
        date: true,
      },
    });

    res.status(200).json({ firstEntryDate: firstPlan ? firstPlan.date : null });
  } catch (error) {
    console.error("Error al obtener la primera fecha de entrada:", error);
    res.status(500).json({ message: "Error al obtener la fecha." });
  }
});

// Endpoint para actualizar el perfil del usuario.
app.put("/api/users/me", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "No autorizado." });
  }

  // Se extraen solo los campos que permitimos actualizar.
  const { name, calorieGoal, phone, address, idNumber } = req.body;

  // Validación básica
  if (!name || !calorieGoal || !phone || !address || !idNumber) {
    return res.status(400).json({ message: "Todos los campos son obligatorios." });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        calorieGoal: Number(calorieGoal),
        phone,
        address,
        idNumber,
      },
    });

    // Se elimina la contraseña del objeto antes de devolverlo.
    const userToReturn = { ...updatedUser };
    delete userToReturn.password;

    res.status(200).json(userToReturn);
  } catch (error) {
    console.error("Error al actualizar el perfil:", error);
    res.status(500).json({ message: "Error al actualizar el perfil." });
  }
});

// Recomienda recetas al usuario basándose en los ingredientes de su despensa.
// Calcula un "match score" para cada receta y devuelve las que mejor coinciden.
app.get("/api/users/me/recommended-recipes", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "No autorizado." });
  }

  const take = parseInt(req.query.take) || 3;

  try {
    // Paso 1: Obtener los ingredientes actuales de la despensa del usuario.
    const pantryItems = await prisma.userPantryItem.findMany({
      where: { userId },
      select: { ingredientName: true },
    });
    const pantrySet = new Set(pantryItems.map(item => item.ingredientName));

    if (pantrySet.size === 0) {
      // Si la despensa está vacía, la lógica de recomendación no puede funcionar.
      // Se devuelve un conjunto de recetas aleatorias como fallback.
      const fallbackRecipes = await prisma.recipe.findMany({
        take,
        include: { ingredients: true, steps: { orderBy: { order: 'asc' } } },
      });
      return res.status(200).json(fallbackRecipes);
    }

    // Paso 2: Obtener todas las recetas y los nombres de sus ingredientes.
    // Se seleccionan solo los nombres para optimizar la consulta.
    const allRecipes = await prisma.recipe.findMany({
      include: {
        ingredients: {
          select: { name: true },
        },
      },
    });

    // Paso 3: Calcular un "match score" para cada receta.
    // El score es el porcentaje de ingredientes que el usuario tiene en su despensa.
    // (Ingredientes que coinciden / Total de ingredientes de la receta)
    const scoredRecipes = allRecipes.map(recipe => {
      const recipeIngredients = new Set(recipe.ingredients.map(ing => ing.name));
      let matchCount = 0;
      for (const pantryIng of pantrySet) {
        if (recipeIngredients.has(pantryIng)) {
          matchCount++;
        }
      }
      const score = matchCount / recipeIngredients.size;
      return { ...recipe, score };
    });

    // Paso 4: Ordenar las recetas por su score de mayor a menor y tomar las mejores.
    const sortedRecipes = scoredRecipes.sort((a, b) => b.score - a.score);
    const topRecipeIds = sortedRecipes.slice(0, take).map(r => r.id);

    // Paso 5: Con los IDs de las mejores recetas, se realiza una segunda consulta
    // para obtener todos sus detalles (pasos, etc.) y enviarlos al frontend.
    const recommendedRecipes = await prisma.recipe.findMany({
      where: {
        id: { in: topRecipeIds },
      },
      include: {
        ingredients: true,
        steps: { orderBy: { order: 'asc' } },
      },
    });

    // La búsqueda con `in` no garantiza el orden, por lo que se reordena el resultado final
    // para asegurar que las recetas con el score más alto aparezcan primero.
    const finalOrder = recommendedRecipes.sort((a, b) => {
      const scoreA = sortedRecipes.find(r => r.id === a.id)?.score || 0;
      const scoreB = sortedRecipes.find(r => r.id === b.id)?.score || 0;
      return scoreB - scoreA;
    });

    res.status(200).json(finalOrder);
  } catch (error) {
    console.error("Error al obtener recetas recomendadas:", error);
    res.status(500).json({ message: "Error al obtener recomendaciones." });
  }
});

// Endpoint para obtener el historial calórico para un rango de 7 días que comienza en una fecha específica.
app.get("/api/users/me/calorie-history", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "No autorizado." });
  }

  const startDateString = req.query.startDate;
  const timezoneOffset = req.query.timezoneOffset ? parseInt(req.query.timezoneOffset, 10) : 0;

  if (!startDateString) {
    return res.status(400).json({ message: "startDate es requerido." });
  }

  // Se construye un string de fecha ISO 8601 que incluye el offset de la zona horaria del cliente.
  // Esto asegura que la fecha se interprete correctamente como la medianoche en la zona horaria del usuario.
  // El signo del offset de getTimezoneOffset() está invertido (positivo para zonas detrás de UTC),
  // por lo que un offset positivo (ej: 300 para UTC-5) se convierte en un signo '-' en el string ISO.
  const offsetSign = timezoneOffset > 0 ? '-' : '+';
  const offsetHours = String(Math.floor(Math.abs(timezoneOffset) / 60)).padStart(2, '0');
  const offsetMinutes = String(Math.abs(timezoneOffset) % 60).padStart(2, '0');
  const isoString = `${startDateString}T00:00:00${offsetSign}${offsetHours}:${offsetMinutes}`;

  const startDate = new Date(isoString);

  if (isNaN(startDate.getTime())) {
    return res.status(400).json({ message: "Formato de fecha u offset inválido." });
  }

  // La fecha de fin son 6 días después, terminando al final de ese día.
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);

  try {
    const plans = await prisma.dailyPlan.findMany({
      where: { userId },
      include: {
        entries: {
          include: {
            recipe: { select: { kcal: true } },
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Paso 1: Consolidar los datos. Pueden existir múltiples planes para un mismo día
    // con diferentes timestamps. Se agrupan por día de calendario (YYYY-MM-DD) y se
    // suman las calorías para obtener un total diario único.
    const dailyTotals = new Map();
    plans.forEach(plan => {
      const dateKey = new Date(plan.date).toISOString().split('T')[0];
      const calories = plan.entries.reduce((sum, entry) => sum + entry.recipe.kcal, 0);
      dailyTotals.set(dateKey, (dailyTotals.get(dateKey) || 0) + calories);
    });

    if (dailyTotals.size === 0) {
      return res.status(200).json([]);
    }

    // Crea un rango de fechas continuo desde el primer día hasta hoy.
    const sortedDates = Array.from(dailyTotals.keys()).sort();
    const startDate = new Date(sortedDates[0]);
    const endDate = new Date(); // Hoy
    const history = [];

    // Paso 3: Rellenar los datos. Se itera sobre el rango de fechas continuo y,
    // para cada día, se usa el total de calorías si existe, o 0 si no hay registro.
    // Esto asegura que el gráfico no tenga días faltantes.
    for (let d = startDate; d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      history.push({
        date: dateKey,
        totalCalories: dailyTotals.get(dateKey) || 0,
      });
    }

    res.status(200).json(history);
  } catch (error) {
    console.error("Error al obtener el historial calórico:", error);
    res.status(500).json({ message: "Error al obtener el historial." });
  }
});

// Devuelve el historial calórico completo del usuario, rellenando los días sin registros.
app.get("/api/users/me/full-calorie-history", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "No autorizado." });
  }

  try {
    const plans = await prisma.dailyPlan.findMany({
      where: {
        userId,
      },
      include: {
        entries: {
          include: {
            recipe: {
              select: {
                kcal: true,
              },
            },
          },
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Agrupa los planes por fecha de calendario (YYYY-MM-DD) y suma las calorías.
    const dailyTotals = new Map();
    plans.forEach(plan => {
      const dateKey = plan.date.toISOString().split('T')[0];
      const calories = plan.entries.reduce((sum, entry) => sum + entry.recipe.kcal, 0);
      dailyTotals.set(dateKey, (dailyTotals.get(dateKey) || 0) + calories);
    });

    if (dailyTotals.size === 0) {
      return res.status(200).json([]);
    }

    // Paso 2: Generar una línea de tiempo continua. Se crea un rango de fechas
    // desde el primer registro del usuario hasta el día de hoy.
    const sortedDates = Array.from(dailyTotals.keys()).sort();
    const startDate = new Date(sortedDates[0]);
    const endDate = new Date(); // Hoy
    const history = [];

    // Normalizar startDate y endDate a medianoche UTC para evitar problemas de bucle infinito.
    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(0, 0, 0, 0);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      history.push({
        date: dateKey,
        totalCalories: dailyTotals.get(dateKey) || 0,
      });
    }

    res.status(200).json(history);
  } catch (error) {
    console.error("Error al obtener el historial calórico completo:", error);
    res.status(500).json({ message: "Error al obtener el historial completo." });
  }
});

// Obtiene la lista de ingredientes en la despensa del usuario actual.
app.get("/api/users/me/pantry", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "No autorizado." });
  }

  try {
    const pantryItems = await prisma.userPantryItem.findMany({
      where: { userId },
      select: { ingredientName: true },
      orderBy: { ingredientName: 'asc' },
    });
    res.status(200).json(pantryItems.map(item => item.ingredientName));
  } catch (error) {
    console.error("Error al obtener la despensa:", error);
    res.status(500).json({ message: "Error al obtener la despensa." });
  }
});

// Reemplaza completamente la despensa del usuario con la lista proporcionada.
app.put("/api/users/me/pantry", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "No autorizado." });
  }

  const { ingredients } = req.body;
  if (!Array.isArray(ingredients)) {
    return res.status(400).json({ message: "Se esperaba un array de ingredientes." });
  }

  try {
    // Se utiliza una transacción de Prisma para garantizar la atomicidad de la operación:
    // o se completan ambas acciones (borrar y crear), o no se realiza ninguna.
    // Esto previene estados inconsistentes en la base de datos.
    await prisma.$transaction([
      // Acción 1: Borrar todos los ingredientes existentes para este usuario.
      prisma.userPantryItem.deleteMany({
        where: { userId },
      }),
      // Acción 2: Crear los nuevos registros con la lista de ingredientes proporcionada.
      prisma.userPantryItem.createMany({
        data: ingredients.map(name => ({
          userId,
          ingredientName: name,
        })),
      }),
    ]);

    res.status(204).send(); // 204 No Content, la operación fue exitosa.
  } catch (error) {
    console.error("Error al actualizar la despensa:", error);
    res.status(500).json({ message: "Error al actualizar la despensa." });
  }
});



// --- Endpoint de Depuración Temporal ---
// Para obtener todos los nombres de ingredientes únicos en la BD.
app.get("/api/debug/all-ingredients", async (req, res) => {
  try {
    const ingredients = await prisma.ingredient.findMany({
      distinct: ['name'],
      select: {
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
    res.status(200).json(ingredients.map(i => i.name));
  } catch (error) {
    console.error("Error en el endpoint de depuración de ingredientes:", error);
    res.status(500).json({ message: "Error del servidor durante la depuración." });
  }
});

// --- Endpoint de Depuración Temporal ---
// Para probar la búsqueda de recetas.
app.get("/api/debug/search", async (req, res) => {
  const { ingredient } = req.query;
  if (!ingredient) {
    return res.status(400).json({ message: "El parámetro 'ingredient' es requerido." });
  }

  try {
    console.log(`DEBUG: Buscando ingrediente: "${ingredient}"`);
    const recipes = await prisma.recipe.findMany({
      where: {
        ingredients: {
          some: {
            name: {
              contains: ingredient,
            },
          },
        },
      },
      include: {
        ingredients: true,
      },
    });
    console.log(`DEBUG: Se encontraron ${recipes.length} recetas.`);
    res.status(200).json(recipes);
  } catch (error) {
    console.error("Error en el endpoint de depuración de búsqueda:", error);
    res.status(500).json({ message: "Error del servidor durante la depuración." });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});
