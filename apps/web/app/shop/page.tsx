import { AppShell } from "@/components/app-shell";
import { ShopClient } from "@/components/shopping/shop-client";
import { getLatestShoppingList } from "@recipai/db";
import { defaultDinnerPlanRange } from "@recipai/meal-planning";
import { openAppDatabase } from "@/lib/server-db";

export const dynamic = "force-dynamic";

export default function ShopPage() {
  const range = defaultDinnerPlanRange();
  const db = openAppDatabase();
  const latestList = getLatestShoppingList(db);
  db.close();

  return (
    <AppShell active="shop">
      <ShopClient
        endDate={range.endDate}
        initialList={latestList}
        startDate={range.startDate}
      />
    </AppShell>
  );
}
