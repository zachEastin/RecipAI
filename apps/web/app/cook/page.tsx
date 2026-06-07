import { AppShell } from "@/components/app-shell";
import { CookScreen } from "@/components/screens";

export default function CookPage() {
  return (
    <AppShell active="cook">
      <CookScreen />
    </AppShell>
  );
}
