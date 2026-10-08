"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/network", label: "Sites" },
  { href: "/network/users", label: "Users" },
  { href: "/network/themes", label: "Themes" },
  { href: "/network/plugins", label: "Plugins" },
  { href: "/network/marketplace", label: "Marketplace" },
];

export function NetworkNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Network" className="flex flex-col gap-1 text-sm">
      {ITEMS.map((item) => {
        const active = item.href === "/network" ? pathname === "/network" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded px-2 py-1.5 ${
              active ? "bg-neutral-900 font-medium text-white" : "text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
