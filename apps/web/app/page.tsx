import { AppShell } from "@/components/app-shell";
import { AskScreen } from "@/components/screens";

export default function HomePage() {
  return (
    <AppShell active="ask">
      <AskScreen />
    </AppShell>
  );
}
