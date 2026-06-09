"use client";

import { Heart, Link as LinkIcon, Plus, Search, Star } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

import type { Recipe } from "@recipai/recipes";

import { Button } from "../ui";

export function LibraryClient({ initialRecipes }: { initialRecipes: Recipe[] }) {
  const [recipes, setRecipes] = useState(initialRecipes);
  const [query, setQuery] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [tagFilter, setTagFilter] = useState("all");
  const [minRating, setMinRating] = useState(0);
  const [recentOnly, setRecentOnly] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    for (const recipe of recipes) {
      for (const tag of recipe.tags) {
        tags.add(tag);
      }
    }

    return [...tags].sort((a, b) => a.localeCompare(b));
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      if (favoriteOnly && !recipe.favorite) {
        return false;
      }

      if (tagFilter !== "all" && !recipe.tags.includes(tagFilter)) {
        return false;
      }

      if (recipe.rating < minRating) {
        return false;
      }

      if (recentOnly && !recipe.lastCookedAt) {
        return false;
      }

      return true;
    });
  }, [favoriteOnly, minRating, recentOnly, recipes, tagFilter]);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSearching(true);

    try {
      const response = await fetch(`/api/recipes?q=${encodeURIComponent(query)}`);
      const payload = (await response.json()) as { recipes: Recipe[] };
      setRecipes(payload.recipes);
    } finally {
      setIsSearching(false);
    }
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
        <form className="search-form" onSubmit={search}>
          <Search aria-hidden="true" size={18} />
          <input
            aria-label="Search recipes"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search recipes"
            value={query}
          />
          <button type="submit">{isSearching ? "..." : "Go"}</button>
        </form>
        <Link className="icon-action" href="/library/new" aria-label="Add recipe">
          <Plus aria-hidden="true" size={22} />
        </Link>
      </div>
      <div className="library-secondary-actions">
        <Link href="/library/import">
          <LinkIcon aria-hidden="true" size={17} />
          Import URL
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
        <button
          aria-pressed={recentOnly}
          onClick={() => setRecentOnly((value) => !value)}
          type="button"
        >
          Recent
        </button>
      </div>

      <div className="recipe-list">
        {filteredRecipes.map((recipe) => (
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
          <Link href="/library/new">
            <Button>Add recipe</Button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
