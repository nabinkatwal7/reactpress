"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Values = {
  site_title: string;
  tagline: string;
  homepage_mode: "latest" | "page";
  homepage_page_id: string | null;
  posts_per_page: number;
  post_base: string;
};

const field = "rounded border border-neutral-300 px-3 py-2";

export function SettingsForm({
  initial,
  pages,
  postBases,
}: {
  initial: Values;
  pages: { id: string; title: string }[];
  postBases: string[];
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Values>(key: K, value: Values[K]) => setV((s) => ({ ...s, [key]: value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...v,
        homepage_page_id: v.homepage_mode === "page" ? v.homepage_page_id : null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      setMsg({ ok: false, text: json?.error ?? "Save failed" });
      return;
    }
    setMsg({ ok: true, text: "Settings saved" });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="flex max-w-xl flex-col gap-4 text-sm">
      <label className="flex flex-col gap-1">
        Site title
        <input className={field} value={v.site_title} onChange={(e) => set("site_title", e.target.value)} />
      </label>
      <label className="flex flex-col gap-1">
        Tagline
        <input className={field} value={v.tagline} onChange={(e) => set("tagline", e.target.value)} />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1">Homepage displays</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={v.homepage_mode === "latest"}
            onChange={() => set("homepage_mode", "latest")}
          />
          Latest posts
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={v.homepage_mode === "page"}
            onChange={() => set("homepage_mode", "page")}
          />
          A static page
        </label>
        {v.homepage_mode === "page" ? (
          <select
            className={field}
            value={v.homepage_page_id ?? ""}
            onChange={(e) => set("homepage_page_id", e.target.value || null)}
          >
            <option value="">Select a page…</option>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        ) : null}
      </fieldset>

      <label className="flex flex-col gap-1">
        Posts per page
        <input
          type="number"
          min={1}
          max={100}
          className={`${field} w-24`}
          value={v.posts_per_page}
          onChange={(e) => set("posts_per_page", Number(e.target.value))}
        />
      </label>

      <label className="flex flex-col gap-1">
        Permalinks — post URL
        <select className={field} value={v.post_base} onChange={(e) => set("post_base", e.target.value)}>
          {postBases.map((b) => (
            <option key={b} value={b}>
              /{b}/post-name
            </option>
          ))}
        </select>
      </label>

      {msg ? <p className={msg.ok ? "text-green-700" : "text-red-600"}>{msg.text}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="w-fit rounded bg-neutral-900 px-3 py-2 font-medium text-white disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
