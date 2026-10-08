"use client";

type Option = { slug: string; name: string };

/** Switch the site the admin is working on. `/<slug>/admin` sets the site cookie (see proxy.ts). */
export function SiteSwitcher({ sites, currentSlug }: { sites: Option[]; currentSlug: string }) {
  if (sites.length < 2) return null;
  return (
    <label className="flex items-center gap-2 text-neutral-600">
      Site
      <select
        className="rounded border border-neutral-300 px-2 py-1"
        value={currentSlug}
        onChange={(e) => {
          window.location.href = `/${e.target.value}/admin`;
        }}
      >
        {sites.map((s) => (
          <option key={s.slug} value={s.slug}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}
