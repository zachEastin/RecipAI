import { Clock, Star, Users } from "lucide-react";

import type { Recipe } from "@recipai/recipes";

import { Button } from "./ui";

export function RecipeCard({
  recipe,
  compact = false
}: {
  recipe: Recipe;
  compact?: boolean;
}) {
  const totalMinutes = recipe.prepMinutes + recipe.cookMinutes;

  return (
    <article className={compact ? "recipe-card recipe-card-compact" : "recipe-card"}>
      <div className="recipe-card-header">
        <div>
          <h3>{recipe.title}</h3>
          <p>{recipe.summary}</p>
        </div>
        <div className="rating-badge" aria-label={`${recipe.rating} star rating`}>
          <Star aria-hidden="true" size={15} fill="currentColor" />
          {recipe.rating}
        </div>
      </div>
      <div className="meta-row">
        <span>
          <Clock aria-hidden="true" size={15} />
          {totalMinutes} min
        </span>
        <span>
          <Users aria-hidden="true" size={15} />
          {recipe.servings}
        </span>
      </div>
      <div className="tag-row">
        {recipe.tags.slice(0, 3).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      {!compact ? (
        <div className="ingredient-preview">
          {recipe.ingredients.slice(0, 4).map((ingredient) => (
            <span key={ingredient.id}>{ingredient.name}</span>
          ))}
        </div>
      ) : null}
      <div className="card-actions">
        <Button variant="secondary">Save recipe</Button>
        <Button>Start cooking</Button>
      </div>
    </article>
  );
}
