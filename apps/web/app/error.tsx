"use client";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui";

export default function Error({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppShell active="ask">
      <div className="error-panel">
        <strong>Something went wrong</strong>
        <p>RecipAI hit a local app error. Your SQLite data is still local on this machine.</p>
        <Button onClick={reset} type="button">
          Try again
        </Button>
      </div>
    </AppShell>
  );
}
