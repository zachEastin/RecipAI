import { AppShell } from "@/components/app-shell";
import { SettingsClient } from "@/components/settings/settings-client";

export default function SettingsPage() {
  return (
    <AppShell active="settings">
      <SettingsClient />
    </AppShell>
  );
}
