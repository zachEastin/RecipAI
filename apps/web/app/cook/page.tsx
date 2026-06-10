import { AppShell } from "@/components/app-shell";
import {
  CookClient,
  AI_DRAFT_STORAGE_KEY,
  WEB_DRAFT_STORAGE_KEY
} from "@/components/cook/cook-client";
import { CookScreen } from "@/components/screens";
import { getRecipeById, listMealPlanEntries, listRecipes } from "@recipai/db";
import { openAppDatabase } from "@/lib/server-db";

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default async function CookPage({
  searchParams
}: {
  searchParams: Promise<{ draft?: string; recipeId?: string }>;
}) {
  const { draft, recipeId } = await searchParams;

  if (!recipeId) {
    const today = toIsoDate(new Date());
    const db = openAppDatabase();
    const todaysMeals = listMealPlanEntries(db, today, today);
    const recipes = listRecipes(db);
    db.close();

    return (
      <AppShell active="cook">
        {draft === "ai" ? (
          <CookClient draftStorageKey={AI_DRAFT_STORAGE_KEY} />
        ) : draft === "web" ? (
          <CookClient draftStorageKey={WEB_DRAFT_STORAGE_KEY} />
        ) : (
          <CookClient recipes={recipes} today={today} todaysMeals={todaysMeals} />
        )}
      </AppShell>
    );
  }

  const db = openAppDatabase();
  const recipe = getRecipeById(db, recipeId);
  db.close();

  if (!recipe) {
    return (
      <AppShell active="cook">
        <CookScreen />
      </AppShell>
    );
  }

  return (
    <AppShell active="cook">
      <CookClient recipe={recipe} />
    </AppShell>
  );
}
