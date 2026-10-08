"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Item = {
  id: string;
  label: string;
  objectType: "custom" | "post" | "page";
  objectId?: string | null;
  url?: string | null;
  depth: number;
};
type Target = { id: string; title: string };
type Location = { key: string; label: string; current: string | null };

const MAX_DEPTH = 2;
const field = "rounded border border-neutral-300 px-3 py-2 text-sm";

let counter = 0;
const tempId = () => `new-${counter++}`;

export function MenuEditor({
  menuId,
  initialName,
  initialItems,
  posts,
  pages,
  locations,
}: {
  menuId: string;
  initialName: string;
  initialItems: Item[];
  posts: Target[];
  pages: Target[];
  locations: Location[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [items, setItems] = useState<Item[]>(initialItems);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [custom, setCustom] = useState({ label: "", url: "" });
  const [assigned, setAssigned] = useState(
    Object.fromEntries(locations.map((l) => [l.key, l.current === menuId])),
  );

  const patch = (i: number, change: Partial<Item>) =>
    setItems((list) => list.map((it, n) => (n === i ? { ...it, ...change } : it)));

  function move(i: number, dir: -1 | 1) {
    setItems((list) => {
      const j = i + dir;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      // keep depths valid after the swap
      let prev = -1;
      return next.map((it) => {
        const depth = Math.min(it.depth, prev + 1);
        prev = depth;
        return { ...it, depth };
      });
    });
  }

  function indent(i: number, delta: 1 | -1) {
    setItems((list) =>
      list.map((it, n) => {
        if (n !== i) return it;
        const max = Math.min(MAX_DEPTH, (list[i - 1]?.depth ?? -1) + 1);
        return { ...it, depth: Math.max(0, Math.min(max, it.depth + delta)) };
      }),
    );
  }

  const add = (item: Omit<Item, "id" | "depth">) =>
    setItems((list) => [...list, { ...item, id: tempId(), depth: 0 }]);

  async function save() {
    setMsg(null);
    const payload = {
      items: items.map(({ label, objectType, objectId, url, depth }) => ({
        label,
        objectType,
        objectId: objectType === "custom" ? null : objectId,
        url: objectType === "custom" ? url : null,
        depth,
      })),
    };
    const [nameRes, itemsRes] = await Promise.all([
      name !== initialName
        ? fetch(`/api/admin/menus/${menuId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
          })
        : Promise.resolve(null),
      fetch(`/api/admin/menus/${menuId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    ]);
    if (!itemsRes.ok || (nameRes && !nameRes.ok)) {
      const res = !itemsRes.ok ? itemsRes : nameRes!;
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      setMsg({ ok: false, text: json?.error ?? "Save failed" });
      return;
    }
    const json = (await itemsRes.json()) as { items: Item[] };
    setItems(json.items);
    setMsg({ ok: true, text: "Saved" });
    router.refresh();
  }

  async function toggleLocation(key: string, on: boolean) {
    setAssigned((a) => ({ ...a, [key]: on }));
    const res = await fetch("/api/admin/menu-locations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: key, menuId: on ? menuId : null }),
    });
    if (!res.ok) {
      setAssigned((a) => ({ ...a, [key]: !on }));
      setMsg({ ok: false, text: "Could not update location" });
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <label className="flex flex-col gap-1 text-sm">
        Menu name
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <section className="flex flex-col gap-2 text-sm">
        <h2 className="font-medium">Add items</h2>
        <div className="flex flex-wrap gap-2">
          <select
            className={field}
            defaultValue=""
            onChange={(e) => {
              const p = pages.find((x) => x.id === e.target.value);
              if (p) add({ label: p.title, objectType: "page", objectId: p.id });
              e.target.value = "";
            }}
          >
            <option value="">Add a page…</option>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <select
            className={field}
            defaultValue=""
            onChange={(e) => {
              const p = posts.find((x) => x.id === e.target.value);
              if (p) add({ label: p.title, objectType: "post", objectId: p.id });
              e.target.value = "";
            }}
          >
            <option value="">Add a post…</option>
            {posts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className={field}
            placeholder="Link text"
            value={custom.label}
            onChange={(e) => setCustom((c) => ({ ...c, label: e.target.value }))}
          />
          <input
            className={field}
            placeholder="https://… or /path"
            value={custom.url}
            onChange={(e) => setCustom((c) => ({ ...c, url: e.target.value }))}
          />
          <button
            type="button"
            className="rounded border border-neutral-300 px-3 py-2"
            disabled={!custom.label || !custom.url}
            onClick={() => {
              add({ label: custom.label, objectType: "custom", url: custom.url });
              setCustom({ label: "", url: "" });
            }}
          >
            Add link
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Structure</h2>
        {items.length === 0 ? (
          <p className="text-sm text-neutral-600">Add items above.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((it, i) => (
              <li
                key={it.id}
                style={{ marginLeft: it.depth * 24 }}
                className="flex flex-wrap items-center gap-2 border border-neutral-200 p-2 text-sm"
              >
                <input
                  className={`${field} flex-1`}
                  value={it.label}
                  onChange={(e) => patch(i, { label: e.target.value })}
                />
                <span className="text-neutral-500">{it.objectType}</span>
                <button type="button" onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                <button type="button" onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                <button type="button" onClick={() => indent(i, -1)} aria-label="Outdent">←</button>
                <button type="button" onClick={() => indent(i, 1)} aria-label="Indent">→</button>
                <button
                  type="button"
                  className="text-red-600"
                  onClick={() => setItems((l) => l.filter((_, n) => n !== i).map((x, n, arr) => ({ ...x, depth: Math.min(x.depth, (arr[n - 1]?.depth ?? -1) + 1) })))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2 text-sm">
        <h2 className="font-medium">Display location</h2>
        {locations.map((l) => (
          <label key={l.key} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!assigned[l.key]}
              onChange={(e) => toggleLocation(l.key, e.target.checked)}
            />
            {l.label}
          </label>
        ))}
      </section>

      {msg ? <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p> : null}
      <button
        type="button"
        onClick={save}
        className="w-fit rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
      >
        Save menu
      </button>
    </div>
  );
}
