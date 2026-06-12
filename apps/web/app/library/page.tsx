import { AppShell } from "@/components/app-shell";
import { LibraryClient } from "@/components/library/library-client";
import { openAppDatabase } from "@/lib/server-db";
import { listRecipes } from "@recipai/db";

export const dynamic = "force-dynamic";

export default function LibraryPage() {
  const db = openAppDatabase();
  const recipes = listRecipes(db);
  db.close();

  return (
    <AppShell active="library">
      <LibraryClient initialRecipes={recipes} />
    </AppShell>
  );
}
