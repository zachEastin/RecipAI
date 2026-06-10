import { CalendarDays, ChefHat, Clock, Heart, Pencil, Star, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getRecipeById } from "@recipai/db";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui";
import { openAppDatabase } from "@/lib/server-db";

export default async function RecipeDetailPage({
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
      <article className="recipe-detail screen-stack">
        <header className="detail-hero">
          <div>
            <div className="detail-flags">
              {recipe.favorite ? (
                <span>
                  <Heart aria-hidden="true" fill="currentColor" size={14} />
                  Favorite
                </span>
              ) : null}
              <span>
                <Star aria-hidden="true" fill="currentColor" size={14} />
                {recipe.rating}
              </span>
            </div>
            <h2>{recipe.title}</h2>
            <p>{recipe.summary}</p>
          </div>
          <div className="detail-actions">
            <Link href={`/cook?recipeId=${recipe.id}`}>
              <Button>
                <ChefHat aria-hidden="true" size={17} />
                Cook
              </Button>
            </Link>
            <Link href={`/library/${recipe.id}/edit`}>
              <Button variant="secondary">
                <Pencil aria-hidden="true" size={17} />
                Edit
              </Button>
            </Link>
          </div>
        </header>

        <div className="meta-panel">
          <span>
            <Clock aria-hidden="true" size={17} />
            {recipe.prepMinutes + recipe.cookMinutes} min
          </span>
          <span>
            <Users aria-hidden="true" size={17} />
            {recipe.servings} servings
          </span>
          <span>
            <CalendarDays aria-hidden="true" size={17} />
            {recipe.mealSlots.map((slot) => slot[0]!.toUpperCase() + slot.slice(1)).join(", ")}
          </span>
        </div>

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
      </article>
    </AppShell>
  );
}
