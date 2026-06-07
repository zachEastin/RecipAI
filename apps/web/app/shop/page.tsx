import { AppShell } from "@/components/app-shell";
import { ShopScreen } from "@/components/screens";

export default function ShopPage() {
  return (
    <AppShell active="shop">
      <ShopScreen />
    </AppShell>
  );
}
