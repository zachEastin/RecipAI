import {
  BookOpen,
  CalendarDays,
  ChefHat,
  ClipboardList,
  Settings,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type NavKey = "ask" | "library" | "plan" | "shop" | "cook" | "settings";

const navItems: Array<{
  key: NavKey;
  label: string;
  href: string;
  icon: LucideIcon;
}> = [
  { key: "library", label: "Library", href: "/library", icon: BookOpen },
  { key: "plan", label: "Plan", href: "/plan", icon: CalendarDays },
  { key: "shop", label: "Shop", href: "/shop", icon: ClipboardList },
  { key: "cook", label: "Cook", href: "/cook", icon: ChefHat },
  { key: "settings", label: "Settings", href: "/settings", icon: Settings }
];

export function AppShell({
  active,
  children
}: {
  active: NavKey;
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Local kitchen</p>
          <h1>RecipAI</h1>
        </div>
        <div className="local-status">
          <span aria-hidden="true" />
          Local
        </div>
      </header>
      <main className="main-content">{children}</main>
      <nav className="bottom-nav" aria-label="Primary navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === active;
          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={isActive ? "nav-item nav-item-active" : "nav-item"}
              href={item.href}
              key={item.key}
            >
              <Icon aria-hidden="true" size={20} strokeWidth={2.2} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
