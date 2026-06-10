import { AppShell } from "@/components/app-shell";

export default function Loading() {
  return (
    <AppShell active="library">
      <div className="empty-state">
        <h2>Loading RecipAI</h2>
        <p>Opening your local kitchen data.</p>
      </div>
    </AppShell>
  );
}
