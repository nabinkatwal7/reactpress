"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string };
type Group = { heading?: string; items: Item[] };

export const NAV: Group[] = [
  { items: [{ href: "/admin", label: "Dashboard" }] },
  {
    heading: "Content",
    items: [
      { href: "/admin/posts", label: "Posts" },
      { href: "/admin/pages", label: "Pages" },
      { href: "/admin/media", label: "Media" },
      { href: "/admin/comments", label: "Comments" },
    ],
  },
  {
    heading: "Organise",
    items: [
      { href: "/admin/terms/category", label: "Categories" },
      { href: "/admin/terms/tag", label: "Tags" },
      { href: "/admin/types", label: "Content types" },
    ],
  },
  {
    heading: "Appearance",
    items: [
      { href: "/admin/themes", label: "Themes" },
      { href: "/admin/customize", label: "Customize" },
      { href: "/admin/parts", label: "Header & footer" },
      { href: "/admin/templates", label: "Template overrides" },
      { href: "/admin/menus", label: "Menus" },
      { href: "/admin/widgets", label: "Widgets" },
    ],
  },
  {
    heading: "System",
    items: [
      { href: "/admin/users", label: "Users" },
      { href: "/admin/plugins", label: "Plugins" },
      { href: "/admin/settings", label: "Settings" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ pluginItems = [] }: { pluginItems?: Item[] }) {
  const pathname = usePathname();
  const groups = pluginItems.length
    ? [...NAV.slice(0, -1), { heading: "Plugin pages", items: pluginItems }, NAV[NAV.length - 1]]
    : NAV;
  return (
    <nav aria-label="Admin" className="flex flex-col gap-4 text-sm">
      {groups.map((group, i) => (
        <div key={i} className="flex flex-col gap-1">
          {group.heading ? (
            <p className="px-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
              {group.heading}
            </p>
          ) : null}
          {group.items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded px-2 py-1.5 ${
                  active
                    ? "bg-neutral-900 font-medium text-white"
                    : "text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
