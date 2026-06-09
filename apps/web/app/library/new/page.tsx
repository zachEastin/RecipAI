import { AppShell } from "@/components/app-shell";
import { RecipeEditor } from "@/components/library/recipe-editor";
import { SectionHeader } from "@/components/ui";

export default function NewRecipePage() {
  return (
    <AppShell active="library">
      <div className="screen-stack">
        <SectionHeader title="Add recipe" />
        <RecipeEditor />
      </div>
    </AppShell>
  );
}
