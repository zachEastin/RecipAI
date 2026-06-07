import { CalendarCheck, Database, RotateCcw, ShoppingBasket } from "lucide-react";

import type { AiStructuredResult } from "@recipai/ai";
import { seedRecipes } from "@recipai/recipes";

import { AskClient } from "./ask/ask-client";
import { RecipeCard } from "./recipe-card";
import { Button, EmptyState, SectionHeader } from "./ui";

const featuredRecipe = seedRecipes[0]!;

export function AskScreen() {
  return <AskClient initialResult={sampleAiResult} recipes={seedRecipes} />;
}

export function LibraryScreen() {
  return (
    <div className="screen-stack">
      <SectionHeader
        title="Recipe library"
        action={<Button variant="secondary">Add</Button>}
      />
      <div className="recipe-list">
        {seedRecipes.map((recipe) => (
          <RecipeCard compact key={recipe.id} recipe={recipe} />
        ))}
      </div>
    </div>
  );
}

export function PlanScreen() {
  return (
    <div className="screen-stack">
      <section className="panel">
        <div className="icon-title">
          <CalendarCheck aria-hidden="true" size={24} />
          <div>
            <h2>Plan dinners</h2>
            <p>Randomly assign saved recipes across a date range.</p>
          </div>
        </div>
        <div className="plan-range">Next 14 dinners</div>
        <Button className="full-width">
          <RotateCcw aria-hidden="true" size={18} />
          Generate dinner plan
        </Button>
      </section>
      <EmptyState
        body="Generated dinners will appear here with lock and reroll controls."
        title="No plan saved yet"
      />
    </div>
  );
}

export function ShopScreen() {
  return (
    <div className="screen-stack">
      <section className="panel">
        <div className="icon-title">
          <ShoppingBasket aria-hidden="true" size={24} />
          <div>
            <h2>Shopping list</h2>
            <p>Build a grouped list from planned dinners.</p>
          </div>
        </div>
        <div className="plan-range">Default range: next 14 days</div>
        <Button className="full-width">Generate list</Button>
      </section>
      <EmptyState
        body="Items will group by grocery section and stay editable after generation."
        title="No shopping list yet"
      />
    </div>
  );
}

export function CookScreen() {
  return (
    <EmptyState
      action={<Button>Open library</Button>}
      body="Cooking mode will show large steps, timers, scaling, and screen-awake controls."
      title="Choose a recipe to cook"
    />
  );
}

export function SettingsScreen() {
  return (
    <div className="screen-stack">
      <section className="panel">
        <div className="icon-title">
          <Database aria-hidden="true" size={24} />
          <div>
            <h2>Local data</h2>
            <p>Recipes, plans, AI runs, and lists stay on this machine.</p>
          </div>
        </div>
        <dl className="settings-list">
          <div>
            <dt>Storage</dt>
            <dd>SQLite</dd>
          </div>
          <div>
            <dt>AI provider</dt>
            <dd>Configured locally</dd>
          </div>
          <div>
            <dt>Network</dt>
            <dd>Home Wi-Fi</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

const sampleAiResult: AiStructuredResult = {
  type: "recipe-result",
  title: featuredRecipe.title,
  summary: featuredRecipe.summary,
  servings: featuredRecipe.servings,
  totalMinutes: featuredRecipe.prepMinutes + featuredRecipe.cookMinutes,
  difficulty: "easy",
  tags: featuredRecipe.tags,
  ingredients: featuredRecipe.ingredients.map((item) => ({
    quantity: item.quantity,
    unit: item.unit,
    name: item.name,
    note: item.note
  })),
  steps: featuredRecipe.steps.map((item) => ({
    body: item.body,
    timerMinutes: item.timerMinutes
  })),
  tips: ["Use the yogurt sauce as a quick dip for vegetables on the side."],
  substitutions: ["Swap rice for quinoa or couscous if that is what you have."]
};
