import { AppShell } from "@/components/app-shell";
import { PlanScreen } from "@/components/screens";

export default function PlanPage() {
  return (
    <AppShell active="plan">
      <PlanScreen />
    </AppShell>
  );
}
