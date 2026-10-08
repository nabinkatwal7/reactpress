"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SiteRow = { id: string; name: string; slug: string; domain: string | null; isDefault: boolean };

const input = "rounded border border-neutral-300 px-3 py-2 text-sm";
const btn = "rounded border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50";

async function call(url: string, method: string, body?: unknown): Promise<string | null> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.ok) return null;
  const json = (await res.json().catch(() => null)) as { error?: string } | null;
  return json?.error ?? "Request failed";
}

function SiteForm({
  initial,
  submitLabel,
  lockSlug,
  onSubmit,
  onCancel,
}: {
  initial: { name: string; slug: string; domain: string };
  submitLabel: string;
  lockSlug?: boolean;
  onSubmit: (v: { name: string; slug: string; domain: string | null }) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await onSubmit({ name: v.name, slug: v.slug, domain: v.domain.trim() || null });
    setBusy(false);
    if (err) setError(err);
    else if (!onCancel) setV({ name: "", slug: "", domain: "" });
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input className={input} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Slug
        <input
          className={input}
          value={v.slug}
          disabled={lockSlug}
          onChange={(e) => setV({ ...v, slug: e.target.value })}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Domain (optional)
        <input
          className={input}
          placeholder="blog.example.com"
          value={v.domain}
          onChange={(e) => setV({ ...v, domain: e.target.value })}
        />
      </label>
      <button type="submit" disabled={busy} className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50">
        {submitLabel}
      </button>
      {onCancel ? (
        <button type="button" onClick={onCancel} className={btn}>
          Cancel
        </button>
      ) : null}
      {error ? <span className="text-sm text-red-600">{error}</span> : null}
    </form>
  );
}

export function SitesManager({ sites }: { sites: SiteRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(site: SiteRow) {
    if (!confirm(`Delete "${site.name}" and all its content? This cannot be undone.`)) return;
    const err = await call(`/api/network/sites/${site.id}`, "DELETE");
    if (err) setError(err);
    else router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Add a site</h2>
        <SiteForm
          initial={{ name: "", slug: "", domain: "" }}
          submitLabel="Create site"
          onSubmit={async (v) => {
            const err = await call("/api/network/sites", "POST", v);
            if (!err) router.refresh();
            return err;
          }}
        />
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ul className="flex flex-col divide-y divide-neutral-200 border border-neutral-200">
        {sites.map((s) => (
          <li key={s.id} className="flex flex-col gap-3 p-4">
            {editing === s.id ? (
              <SiteForm
                initial={{ name: s.name, slug: s.slug, domain: s.domain ?? "" }}
                submitLabel="Save"
                lockSlug={s.isDefault}
                onCancel={() => setEditing(null)}
                onSubmit={async (v) => {
                  const err = await call(`/api/network/sites/${s.id}`, "PATCH", v);
                  if (!err) {
                    setEditing(null);
                    router.refresh();
                  }
                  return err;
                }}
              />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {s.name}
                    {s.isDefault ? <span className="ml-2 rounded bg-neutral-900 px-2 py-0.5 text-xs text-white">Main</span> : null}
                  </p>
                  <p className="text-sm text-neutral-500">
                    /{s.slug}
                    {s.domain ? ` · ${s.domain}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className={btn} onClick={() => setEditing(s.id)}>
                    Edit
                  </button>
                  {!s.isDefault ? (
                    <button type="button" className={`${btn} text-red-600`} onClick={() => remove(s)}>
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
