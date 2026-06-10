"use client";

import { ChefHat, Heart, Plus, Search, Star, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { Recipe } from "@recipai/recipes";

import { Button } from "../ui";
import { filterRecipes } from "./recipe-filters";

export function LibraryClient({ initialRecipes }: { initialRecipes: Recipe[] }) {
  const [recipes, setRecipes] = useState(initialRecipes);
  const [query, setQuery] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [tagFilter, setTagFilter] = useState("all");
  const [minRating, setMinRating] = useState(0);
  const [recentOnly, setRecentOnly] = useState(false);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [ingredientThreshold, setIngredientThreshold] = useState(1);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    for (const recipe of recipes) {
      for (const tag of recipe.tags) {
        tags.add(tag);
      }
    }

    return [...tags].sort((a, b) => a.localeCompare(b));
  }, [recipes]);

  const availableIngredients = useMemo(() => {
    const ingredients = new Map<string, string>();

    for (const recipe of recipes) {
      for (const ingredient of recipe.ingredients) {
        const trimmedName = ingredient.name.trim();

        if (trimmedName) {
          ingredients.set(trimmedName.toLowerCase(), trimmedName);
        }
      }
    }

    return [...ingredients.values()].sort((a, b) => a.localeCompare(b));
  }, [recipes]);

  const ingredientOptions = useMemo(
    () => availableIngredients.filter((ingredient) => !selectedIngredients.includes(ingredient)),
    [availableIngredients, selectedIngredients],
  );

  const filteredRecipes = useMemo(() => {
    return filterRecipes(recipes, {
      favoriteOnly,
      ingredientThreshold,
      minRating,
      query,
      recentOnly,
      selectedIngredients,
      tagFilter
    });
  }, [
    favoriteOnly,
    ingredientThreshold,
    minRating,
    query,
    recentOnly,
    recipes,
    selectedIngredients,
    tagFilter
  ]);

  function addIngredientFilter(ingredient: string) {
    if (ingredient === "all") {
      return;
    }

    setSelectedIngredients((current) =>
      current.includes(ingredient) ? current : [...current, ingredient],
    );
    setIngredientThreshold((current) => Math.max(1, current));
  }

  function removeIngredientFilter(ingredient: string) {
    setSelectedIngredients((current) => current.filter((item) => item !== ingredient));
  }

  function clearFilters() {
    setFavoriteOnly(false);
    setTagFilter("all");
    setMinRating(0);
    setRecentOnly(false);
    setSelectedIngredients([]);
    setIngredientThreshold(1);
  }

  async function updateFavorite(recipe: Recipe) {
    const response = await fetch(`/api/recipes/${recipe.id}/favorite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: !recipe.favorite })
    });
    const payload = (await response.json()) as { recipe: Recipe };
    setRecipes((current) =>
      current.map((item) => (item.id === payload.recipe.id ? payload.recipe : item)),
    );
  }

  async function updateRating(recipe: Recipe, rating: number) {
    const response = await fetch(`/api/recipes/${recipe.id}/rating`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating })
    });
    const payload = (await response.json()) as { recipe: Recipe };
    setRecipes((current) =>
      current.map((item) => (item.id === payload.recipe.id ? payload.recipe : item)),
    );
  }

  return (
    <div className="screen-stack">
      <div className="library-toolbar">
        <form className="search-form" onSubmit={(event) => event.preventDefault()}>
          <Search aria-hidden="true" size={18} />
          <input
            aria-label="Search recipes"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search recipes"
            value={query}
          />
        </form>
        <Link className="icon-action" href="/library/add" aria-label="Add recipe">
          <Plus aria-hidden="true" size={22} />
        </Link>
      </div>
      <div className="filter-bar" aria-label="Recipe filters">
        <button
          aria-pressed={favoriteOnly}
          onClick={() => setFavoriteOnly((value) => !value)}
          type="button"
        >
          Favorites
        </button>
        <button
          aria-pressed={recentOnly}
          onClick={() => setRecentOnly((value) => !value)}
          type="button"
        >
          Recent
        </button>
        <label>
          Tag
          <select onChange={(event) => setTagFilter(event.target.value)} value={tagFilter}>
            <option value="all">All</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
        {selectedIngredients.length > 0 ? (
          <label>
            Match
            <select
              aria-label="Ingredient match threshold"
              onChange={(event) => setIngredientThreshold(Number(event.target.value))}
              value={Math.min(ingredientThreshold, selectedIngredients.length)}
            >
              {selectedIngredients.map((ingredient, index) => (
                <option key={ingredient} value={index + 1}>
                  {index + 1}+
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          Rating
          <select
            onChange={(event) => setMinRating(Number(event.target.value))}
            value={minRating}
          >
            <option value={0}>Any</option>
            <option value={3}>3+</option>
            <option value={4}>4+</option>
            <option value={5}>5</option>
          </select>
        </label>
        <label className="filter-wide">
          Ingredient
          <select
            aria-label="Add ingredient filter"
            onChange={(event) => addIngredientFilter(event.target.value)}
            value="all"
          >
            <option value="all">Add</option>
            {ingredientOptions.map((ingredient) => (
              <option key={ingredient} value={ingredient}>
                {ingredient}
              </option>
            ))}
          </select>
        </label>
        {favoriteOnly ||
        tagFilter !== "all" ||
        minRating > 0 ||
        recentOnly ||
        selectedIngredients.length > 0 ? (
          <button className="filter-clear" onClick={clearFilters} type="button">
            Clear
          </button>
        ) : null}
      </div>

      {selectedIngredients.length > 0 ? (
        <div className="selected-filter-row" aria-label="Selected ingredient filters">
          {selectedIngredients.map((ingredient) => (
            <button
              aria-label={`Remove ${ingredient}`}
              key={ingredient}
              onClick={() => removeIngredientFilter(ingredient)}
              type="button"
            >
              {ingredient}
              <X aria-hidden="true" size={14} />
            </button>
          ))}
        </div>
      ) : null}

      <div className="recipe-list">
        {filteredRecipes.map(({ ingredientMatchCount, recipe }) => (
          <article className="library-recipe-card" key={recipe.id}>
            <Link className="library-card-main" href={`/library/${recipe.id}`}>
              <h2>{recipe.title}</h2>
              <p>{recipe.summary}</p>
              <div className="meta-row">
                <span>{recipe.prepMinutes + recipe.cookMinutes} min</span>
                <span>{recipe.servings} servings</span>
              </div>
              <div className="tag-row">
                {recipe.tags.slice(0, 3).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              {selectedIngredients.length > 0 ? (
                <div className="ingredient-match-badge">
                  {ingredientMatchCount}/{selectedIngredients.length} ingredients
                </div>
              ) : null}
            </Link>
            <div className="library-card-actions">
              <button
                aria-label={recipe.favorite ? "Remove favorite" : "Add favorite"}
                className={recipe.favorite ? "icon-toggle icon-toggle-active" : "icon-toggle"}
                onClick={() => void updateFavorite(recipe)}
                type="button"
              >
                <Heart aria-hidden="true" fill={recipe.favorite ? "currentColor" : "none"} />
              </button>
              <div className="rating-control" aria-label={`${recipe.rating} star rating`}>
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    aria-label={`Rate ${rating}`}
                    key={rating}
                    onClick={() => void updateRating(recipe, rating)}
                    type="button"
                  >
                    <Star
                      aria-hidden="true"
                      fill={rating <= recipe.rating ? "currentColor" : "none"}
                      size={17}
                    />
                  </button>
                ))}
              </div>
              <Link className="text-link" href={`/cook?recipeId=${recipe.id}`}>
                <ChefHat aria-hidden="true" size={16} />
                Cook
              </Link>
              <Link className="text-link" href={`/library/${recipe.id}/edit`}>
                Edit
              </Link>
            </div>
          </article>
        ))}
      </div>

      {filteredRecipes.length === 0 ? (
        <div className="empty-state">
          <h2>No recipes found</h2>
          <p>Try a different search, clear a filter, or add a recipe manually.</p>
          <Link href="/library/add">
            <Button>Add recipe</Button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
