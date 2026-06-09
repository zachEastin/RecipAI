import { notFound } from "next/navigation";

import { getRecipeById } from "@recipai/db";

import { AppShell } from "@/components/app-shell";
import { RecipeEditor } from "@/components/library/recipe-editor";
import { SectionHeader } from "@/components/ui";
import { openAppDatabase } from "@/lib/server-db";

export default async function EditRecipePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = openAppDatabase();
  const recipe = getRecipeById(db, id);
  db.close();

  if (!recipe) {
    notFound();
  }

  return (
    <AppShell active="library">
      <div className="screen-stack">
        <SectionHeader title="Edit recipe" />
        <RecipeEditor recipe={recipe} />
      </div>
    </AppShell>
  );
}
