import { AppShell } from "@/components/app-shell";
import { RecipeEditor } from "@/components/library/recipe-editor";
import { SectionHeader } from "@/components/ui";

export default async function NewRecipePage({
  searchParams
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const { source = "" } = await searchParams;

  return (
    <AppShell active="library">
      <div className="screen-stack">
        <SectionHeader title="Add recipe" />
        <RecipeEditor initialSource={source} />
      </div>
    </AppShell>
  );
}
