import { AppShell } from "@/components/app-shell";
import { PlanClient } from "@/components/plan/plan-client";
import { listMealPlanEntries, listRecipes } from "@recipai/db";
import { defaultDinnerPlanRange } from "@recipai/meal-planning";
import { openAppDatabase } from "@/lib/server-db";

export default function PlanPage() {
  const range = defaultDinnerPlanRange();
  const db = openAppDatabase();
  const entries = listMealPlanEntries(db, range.startDate, range.endDate);
  const recipes = listRecipes(db);
  db.close();

  return (
    <AppShell active="plan">
      <PlanClient
        endDate={range.endDate}
        initialEntries={entries}
        recipes={recipes}
        startDate={range.startDate}
      />
    </AppShell>
  );
}
