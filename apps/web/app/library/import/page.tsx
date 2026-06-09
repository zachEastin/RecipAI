import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { RecipeEditor } from "@/components/library/recipe-editor";
import { Button, SectionHeader } from "@/components/ui";
import { parseRecipeUrl } from "@/lib/recipe-url-parser";

export default async function ImportRecipePage({
  searchParams
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const { url = "" } = await searchParams;
  const review = url ? await parseRecipeUrl(url) : null;

  return (
    <AppShell active="library">
      <div className="screen-stack">
        <SectionHeader title="Import recipe URL" />
        <section className="panel">
          <form className="import-form" action="/library/import">
            <label>
              Recipe URL
              <input
                defaultValue={url}
                name="url"
                placeholder="https://example.com/favorite-dinner"
                type="url"
              />
            </label>
            <Button className="full-width" type="submit">
              Review import
            </Button>
          </form>
        </section>
        {review ? (
          <section className="panel import-review">
            <h2>Review before saving</h2>
            <p>{review.parserNotes.join(" ")}</p>
            <dl className="settings-list">
              <div>
                <dt>Source</dt>
                <dd>{review.source}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{review.parserStatus}</dd>
              </div>
            </dl>
          </section>
        ) : null}
        {review ? (
          <RecipeEditor
            initialDraft={{
              title: review.title,
              summary: review.summary,
              source: review.source,
              servings: review.servings,
              prepMinutes: review.prepMinutes,
              cookMinutes: review.cookMinutes,
              tags: review.tags,
              ingredients: review.ingredients,
              steps: review.steps,
              provenance: "url-import"
            }}
          />
        ) : (
          <section className="panel import-review">
            <h2>Review before saving</h2>
            <p>Paste a recipe URL to parse common recipe metadata, then edit every field before saving.</p>
            <Link href="/library/new">
              <Button className="full-width" variant="secondary">
                Add manually instead
              </Button>
            </Link>
          </section>
        )}
      </div>
    </AppShell>
  );
}
