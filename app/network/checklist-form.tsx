"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Item = { slug: string; name: string; description: string };

/** Pick a subset of items and PUT `{ [field]: slugs }` to `endpoint`. */
export function ChecklistForm({
  items,
  initial,
  endpoint,
  field,
  hint,
}: {
  items: Item[];
  initial: string[];
  endpoint: string;
  field: string;
  hint: string;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState(new Set(initial));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: [...picked] }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      setMsg({ ok: false, text: json?.error ?? "Save failed" });
      return;
    }
    setMsg({ ok: true, text: "Saved" });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="flex max-w-2xl flex-col gap-4 text-sm">
      <p className="text-neutral-600">{hint}</p>
      <ul className="flex flex-col divide-y divide-neutral-200 border border-neutral-200">
        {items.map((it) => (
          <li key={it.slug}>
            <label className="flex items-start gap-3 p-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={picked.has(it.slug)}
                onChange={(e) => {
                  const next = new Set(picked);
                  if (e.target.checked) next.add(it.slug);
                  else next.delete(it.slug);
                  setPicked(next);
                }}
              />
              <span>
                <span className="font-medium">{it.name}</span>
                <span className="block text-neutral-500">{it.description}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50">
          {busy ? "Saving…" : "Save"}
        </button>
        {msg ? <span className={msg.ok ? "text-green-700" : "text-red-600"}>{msg.text}</span> : null}
      </div>
    </form>
  );
}
