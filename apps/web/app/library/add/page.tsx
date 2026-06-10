import { AddRecipeWizard } from "@/components/library/add-recipe-wizard";
import { AppShell } from "@/components/app-shell";
import { openAppDatabase } from "@/lib/server-db";
import { listRecipes } from "@recipai/db";

type WizardMode = "ai" | "url" | "web" | "manual";

function parseMode(mode?: string): WizardMode {
  if (mode === "url" || mode === "web" || mode === "manual") {
    return mode;
  }

  return "ai";
}

export default async function AddRecipePage({
  searchParams
}: {
  searchParams: Promise<{ mode?: string; source?: string; url?: string }>;
}) {
  const { mode, source = "", url = "" } = await searchParams;
  const db = openAppDatabase();
  const recipes = listRecipes(db);
  db.close();

  return (
    <AppShell active="library">
      <AddRecipeWizard
        initialMode={parseMode(mode)}
        initialSource={source}
        initialUrl={url}
        recipes={recipes}
      />
    </AppShell>
  );
}
