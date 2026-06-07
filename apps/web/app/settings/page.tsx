import { AppShell } from "@/components/app-shell";
import { SettingsScreen } from "@/components/screens";

export default function SettingsPage() {
  return (
    <AppShell active="settings">
      <SettingsScreen />
    </AppShell>
  );
}
