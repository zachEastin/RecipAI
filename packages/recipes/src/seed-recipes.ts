import type { Recipe } from "./types";

const categories = {
  protein: "Protein",
  produce: "Produce",
  pantry: "Pantry",
  dairy: "Dairy",
  spice: "Spices",
  frozen: "Frozen"
} as const;

function ingredient(
  recipeId: string,
  index: number,
  name: string,
  quantity: number | null,
  unit: string | null,
  groceryCategory: string,
  note: string | null = null,
) {
  return {
    id: `${recipeId}-ingredient-${index}`,
    recipeId,
    quantity,
    unit,
    name,
    note,
    groceryCategory,
    sortOrder: index
  };
}

function step(
  recipeId: string,
  index: number,
  body: string,
  timerMinutes: number | null = null,
) {
  return {
    id: `${recipeId}-step-${index}`,
    recipeId,
    body,
    timerMinutes,
    sortOrder: index
  };
}

export const seedRecipes: Recipe[] = [
  {
    id: "lemon-herb-chicken-bowls",
    title: "Lemon Herb Chicken Bowls",
    summary: "Bright chicken, rice, cucumber, and a quick yogurt sauce.",
    source: null,
    servings: 4,
    prepMinutes: 15,
    cookMinutes: 25,
    rating: 5,
    tags: ["weeknight", "chicken", "fresh"],
    favorite: true,
    lastCookedAt: null,
    imageUrl: null,
    provenance: "seed",
    ingredients: [
      ingredient("lemon-herb-chicken-bowls", 1, "boneless chicken thighs", 1.5, "lb", categories.protein),
      ingredient("lemon-herb-chicken-bowls", 2, "jasmine rice", 1.5, "cups", categories.pantry),
      ingredient("lemon-herb-chicken-bowls", 3, "cucumber", 1, null, categories.produce),
      ingredient("lemon-herb-chicken-bowls", 4, "plain Greek yogurt", 0.75, "cup", categories.dairy),
      ingredient("lemon-herb-chicken-bowls", 5, "lemon", 1, null, categories.produce),
      ingredient("lemon-herb-chicken-bowls", 6, "dried oregano", 1, "tsp", categories.spice)
    ],
    steps: [
      step("lemon-herb-chicken-bowls", 1, "Cook the rice according to package directions.", 18),
      step("lemon-herb-chicken-bowls", 2, "Season chicken with lemon zest, oregano, salt, and pepper."),
      step("lemon-herb-chicken-bowls", 3, "Sear chicken until browned and cooked through.", 12),
      step("lemon-herb-chicken-bowls", 4, "Mix yogurt with lemon juice and salt, then assemble bowls.")
    ]
  },
  {
    id: "turkey-taco-skillet",
    title: "Turkey Taco Skillet",
    summary: "One-pan taco filling with beans, corn, and melty cheese.",
    source: null,
    servings: 5,
    prepMinutes: 10,
    cookMinutes: 20,
    rating: 4,
    tags: ["one-pan", "kid-friendly", "fast"],
    favorite: false,
    lastCookedAt: null,
    imageUrl: null,
    provenance: "seed",
    ingredients: [
      ingredient("turkey-taco-skillet", 1, "ground turkey", 1, "lb", categories.protein),
      ingredient("turkey-taco-skillet", 2, "black beans", 15, "oz", categories.pantry),
      ingredient("turkey-taco-skillet", 3, "frozen corn", 1, "cup", categories.frozen),
      ingredient("turkey-taco-skillet", 4, "shredded cheddar", 1, "cup", categories.dairy),
      ingredient("turkey-taco-skillet", 5, "taco seasoning", 2, "tbsp", categories.spice)
    ],
    steps: [
      step("turkey-taco-skillet", 1, "Brown turkey in a large skillet.", 8),
      step("turkey-taco-skillet", 2, "Stir in beans, corn, seasoning, and a splash of water."),
      step("turkey-taco-skillet", 3, "Simmer until saucy, then top with cheese.", 8)
    ]
  },
  {
    id: "creamy-tomato-gnocchi",
    title: "Creamy Tomato Gnocchi",
    summary: "Soft gnocchi in a tomato cream sauce with spinach.",
    source: null,
    servings: 4,
    prepMinutes: 5,
    cookMinutes: 15,
    rating: 5,
    tags: ["vegetarian", "comfort", "15-minute"],
    favorite: true,
    lastCookedAt: null,
    imageUrl: null,
    provenance: "seed",
    ingredients: [
      ingredient("creamy-tomato-gnocchi", 1, "shelf-stable gnocchi", 16, "oz", categories.pantry),
      ingredient("creamy-tomato-gnocchi", 2, "marinara sauce", 1.5, "cups", categories.pantry),
      ingredient("creamy-tomato-gnocchi", 3, "heavy cream", 0.5, "cup", categories.dairy),
      ingredient("creamy-tomato-gnocchi", 4, "baby spinach", 3, "cups", categories.produce),
      ingredient("creamy-tomato-gnocchi", 5, "parmesan", 0.5, "cup", categories.dairy)
    ],
    steps: [
      step("creamy-tomato-gnocchi", 1, "Simmer marinara and cream in a wide skillet.", 4),
      step("creamy-tomato-gnocchi", 2, "Add gnocchi and cook until tender.", 6),
      step("creamy-tomato-gnocchi", 3, "Fold in spinach and parmesan before serving.")
    ]
  },
  {
    id: "sheet-pan-sausage-peppers",
    title: "Sheet Pan Sausage and Peppers",
    summary: "Roasted sausage, peppers, onions, and potatoes with mustard sauce.",
    source: null,
    servings: 4,
    prepMinutes: 15,
    cookMinutes: 30,
    rating: 4,
    tags: ["sheet-pan", "low-effort", "family"],
    favorite: false,
    lastCookedAt: null,
    imageUrl: null,
    provenance: "seed",
    ingredients: [
      ingredient("sheet-pan-sausage-peppers", 1, "smoked sausage", 14, "oz", categories.protein),
      ingredient("sheet-pan-sausage-peppers", 2, "bell peppers", 3, null, categories.produce),
      ingredient("sheet-pan-sausage-peppers", 3, "red onion", 1, null, categories.produce),
      ingredient("sheet-pan-sausage-peppers", 4, "baby potatoes", 1.5, "lb", categories.produce),
      ingredient("sheet-pan-sausage-peppers", 5, "Dijon mustard", 2, "tbsp", categories.pantry)
    ],
    steps: [
      step("sheet-pan-sausage-peppers", 1, "Heat oven to 425F and slice sausage and vegetables."),
      step("sheet-pan-sausage-peppers", 2, "Toss everything with oil, mustard, salt, and pepper."),
      step("sheet-pan-sausage-peppers", 3, "Roast until potatoes are tender and sausage is browned.", 30)
    ]
  },
  {
    id: "salmon-rice-cucumber-plates",
    title: "Salmon Rice Cucumber Plates",
    summary: "Simple roasted salmon with rice, cucumbers, and soy-lime drizzle.",
    source: null,
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 18,
    rating: 5,
    tags: ["fish", "fresh", "quick"],
    favorite: true,
    lastCookedAt: null,
    imageUrl: null,
    provenance: "seed",
    ingredients: [
      ingredient("salmon-rice-cucumber-plates", 1, "salmon fillets", 1.25, "lb", categories.protein),
      ingredient("salmon-rice-cucumber-plates", 2, "rice", 1.5, "cups", categories.pantry),
      ingredient("salmon-rice-cucumber-plates", 3, "English cucumber", 1, null, categories.produce),
      ingredient("salmon-rice-cucumber-plates", 4, "soy sauce", 3, "tbsp", categories.pantry),
      ingredient("salmon-rice-cucumber-plates", 5, "lime", 1, null, categories.produce)
    ],
    steps: [
      step("salmon-rice-cucumber-plates", 1, "Cook rice and heat oven to 400F.", 18),
      step("salmon-rice-cucumber-plates", 2, "Roast seasoned salmon until just cooked.", 12),
      step("salmon-rice-cucumber-plates", 3, "Slice cucumber and stir soy sauce with lime juice."),
      step("salmon-rice-cucumber-plates", 4, "Serve salmon over rice with cucumber and drizzle.")
    ]
  }
];
