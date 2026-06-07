import { AppShell } from "@/components/app-shell";
import { LibraryScreen } from "@/components/screens";

export default function LibraryPage() {
  return (
    <AppShell active="library">
      <LibraryScreen />
    </AppShell>
  );
}
