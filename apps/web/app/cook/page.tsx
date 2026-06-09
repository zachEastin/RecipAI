import { AppShell } from "@/components/app-shell";
import { CookClient, AI_DRAFT_STORAGE_KEY } from "@/components/cook/cook-client";
import { CookScreen } from "@/components/screens";
import { getRecipeById } from "@recipai/db";
import { openAppDatabase } from "@/lib/server-db";

export default async function CookPage({
  searchParams
}: {
  searchParams: Promise<{ draft?: string; recipeId?: string }>;
}) {
  const { draft, recipeId } = await searchParams;

  if (!recipeId) {
    return (
      <AppShell active="cook">
        {draft === "ai" ? (
          <CookClient draftStorageKey={AI_DRAFT_STORAGE_KEY} />
        ) : (
          <CookScreen />
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
