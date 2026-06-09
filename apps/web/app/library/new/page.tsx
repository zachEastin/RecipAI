import { redirect } from "next/navigation";

export default async function NewRecipePage({
  searchParams
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const { source = "" } = await searchParams;
  const params = new URLSearchParams({ mode: "manual" });

  if (source) {
    params.set("source", source);
  }

  redirect(`/library/add?${params.toString()}`);
}
