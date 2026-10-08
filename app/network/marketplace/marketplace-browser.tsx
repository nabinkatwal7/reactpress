"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Item = {
  type: "theme" | "plugin";
  slug: string;
  name: string;
  version: string;
  author: string;
  description: string;
  homepage?: string;
  registry: string;
  registryName: string;
  status: "available" | "installed" | "update" | "bundled";
  installedVersion: string | null;
};

const input = "rounded border border-neutral-300 px-3 py-2 text-sm";
const btn = "rounded border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50";

const STATUS_LABEL: Record<Item["status"], string> = {
  available: "",
  installed: "Installed",
  update: "Update available",
  bundled: "Included with ReactPress",
};

export function MarketplaceBrowser({
  registries,
  items,
  errors,
}: {
  registries: string[];
  items: Item[];
  errors: { registry: string; error: string }[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"all" | "theme" | "plugin">("all");
  const [query, setQuery] = useState("");
  const [list, setList] = useState(registries);
  const [newUrl, setNewUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const shown = items.filter(
    (i) =>
      (tab === "all" || i.type === tab) &&
      (!query || `${i.name} ${i.slug} ${i.description} ${i.author}`.toLowerCase().includes(query.toLowerCase())),
  );

  async function saveRegistries(next: string[]) {
    setError(null);
    const res = await fetch("/api/network/registries", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registries: next }),
    });
    const json = (await res.json().catch(() => null)) as { registries?: string[]; error?: string } | null;
    if (!res.ok) return setError(json?.error ?? "Could not save");
    setList(json!.registries!);
    setNewUrl("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex max-w-3xl flex-col gap-3 text-sm">
        <h2 className="font-medium">Registries</h2>
        {list.length === 0 ? (
          <p className="text-neutral-500">
            No registries yet. A registry is a JSON catalog of themes and plugins that anyone can host; add its URL to browse it here.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {list.map((u) => (
              <li key={u} className="flex items-center justify-between gap-3 border border-neutral-200 px-3 py-2">
                <span className="break-all">{u}</span>
                <button type="button" className="text-red-600 hover:underline" onClick={() => saveRegistries(list.filter((x) => x !== u))}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveRegistries([...list, newUrl]);
          }}
        >
          <input className={`${input} min-w-80 flex-1`} type="url" required placeholder="https://example.com/registry.json" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
          <button type="submit" className="rounded bg-neutral-900 px-4 py-2 text-white">
            Add registry
          </button>
        </form>
        {error ? <p className="text-red-600">{error}</p> : null}
        {errors.map((e) => (
          <p key={e.registry} className="text-red-600">
            {e.error}
          </p>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {(["all", "theme", "plugin"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded px-3 py-1.5 ${tab === t ? "bg-neutral-900 text-white" : "border border-neutral-300"}`}
            >
              {t === "all" ? "All" : t === "theme" ? "Themes" : "Plugins"}
            </button>
          ))}
          <input className={input} placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button type="button" className={btn} onClick={() => fetch("/api/network/marketplace?fresh=1").then(() => router.refresh())}>
            Refresh
          </button>
        </div>
        <ul className="grid gap-4 md:grid-cols-2">
          {shown.map((i) => (
            <li key={`${i.registry}|${i.type}|${i.slug}`} className="flex flex-col gap-2 border border-neutral-200 p-4 text-sm">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium">
                  {i.name} <span className="font-normal text-neutral-500">v{i.version}</span>
                </h3>
                <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs capitalize">{i.type}</span>
              </div>
              <p className="text-neutral-600">{i.description}</p>
              <p className="text-xs text-neutral-500">
                By {i.author} · {i.registryName}
                {i.homepage ? (
                  <>
                    {" "}
                    ·{" "}
                    <a href={i.homepage} target="_blank" rel="noreferrer noopener" className="underline">
                      Website
                    </a>
                  </>
                ) : null}
              </p>
              {STATUS_LABEL[i.status] ? (
                <p className="text-xs font-medium text-neutral-700">
                  {STATUS_LABEL[i.status]}
                  {i.installedVersion ? ` (v${i.installedVersion})` : ""}
                </p>
              ) : null}
            </li>
          ))}
          {shown.length === 0 ? <li className="text-sm text-neutral-500">Nothing to show.</li> : null}
        </ul>
      </section>
    </div>
  );
}
