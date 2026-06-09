import { redirect } from "next/navigation";

export default async function ImportRecipePage({
  searchParams
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const { url = "" } = await searchParams;
  const params = new URLSearchParams({ mode: "url" });

  if (url) {
    params.set("url", url);
  }

  redirect(`/library/add?${params.toString()}`);
}
