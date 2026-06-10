import Link from "next/link";

import { Button, EmptyState } from "./ui";

export function CookScreen() {
  return (
    <EmptyState
      action={
        <Link href="/library">
          <Button>Open library</Button>
        </Link>
      }
      body="Open a saved recipe, planned dinner, or AI result to use large steps, timers, scaling, and notes."
      title="Choose a recipe to cook"
    />
  );
}
