import { AppShell } from "@/components/app-shell";
import { CookScreen } from "@/components/screens";
import { Button } from "@/components/ui";
import { getRecipeById } from "@recipai/db";
import { openAppDatabase } from "@/lib/server-db";

export default async function CookPage({
  searchParams
}: {
  searchParams: Promise<{ recipeId?: string }>;
}) {
  const { recipeId } = await searchParams;

  if (!recipeId) {
    return (
      <AppShell active="cook">
        <CookScreen />
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
      <div className="screen-stack">
        <section className="detail-hero">
          <div>
            <h2>{recipe.title}</h2>
            <p>{recipe.summary}</p>
          </div>
          <Button>Start timers</Button>
        </section>
        <section className="panel">
          <h2>Ingredients</h2>
          <ul className="check-list detail-list">
            {recipe.ingredients.map((item) => (
              <li key={item.id}>
                <span />
                {item.quantity ? `${item.quantity} ` : ""}
                {item.unit ? `${item.unit} ` : ""}
                {item.name}
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <h2>Steps</h2>
          <ol className="step-list detail-list">
            {recipe.steps.map((step) => (
              <li key={step.id}>{step.body}</li>
            ))}
          </ol>
        </section>
      </div>
    </AppShell>
  );
}
