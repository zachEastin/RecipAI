import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { Button, SectionHeader } from "@/components/ui";

export default async function ImportRecipePage({
  searchParams
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const { url = "" } = await searchParams;

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
        {url ? (
          <section className="panel import-review">
            <h2>Review before saving</h2>
            <p>
              URL parsing is staged here for the next implementation pass. For now, use this as
              the review checkpoint, then add the recipe manually with the source URL preserved.
            </p>
            <dl className="settings-list">
              <div>
                <dt>Source</dt>
                <dd>{url}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>Parser placeholder</dd>
              </div>
            </dl>
            <Link href={`/library/new?source=${encodeURIComponent(url)}`}>
              <Button className="full-width">Continue in editor</Button>
            </Link>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
