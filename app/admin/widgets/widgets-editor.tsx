"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Widget = { id: string; type: string; settings: Record<string, unknown> };
type Area = { key: string; name: string; widgets: Widget[] };
type TypeInfo = { key: string; label: string };

const field = "rounded border border-neutral-300 px-3 py-2 text-sm";

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.ok) return null;
  const json = (await res.json().catch(() => null)) as { error?: string } | null;
  return json?.error ?? "Request failed";
}

function WidgetCard({
  widget,
  label,
  first,
  last,
  onChanged,
  onMove,
}: {
  widget: Widget;
  label: string;
  first: boolean;
  last: boolean;
  onChanged: (error: string | null) => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const [settings, setSettings] = useState(widget.settings);
  const set = (key: string, value: unknown) => setSettings((s) => ({ ...s, [key]: value }));

  return (
    <li className="flex flex-col gap-2 border border-neutral-200 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">{label}</span>
        <span className="flex gap-2">
          <button type="button" disabled={first} onClick={() => onMove(-1)} aria-label="Move up">↑</button>
          <button type="button" disabled={last} onClick={() => onMove(1)} aria-label="Move down">↓</button>
          <button
            type="button"
            className="text-red-600"
            onClick={async () => onChanged(await call(`/api/admin/widgets/${widget.id}`, "DELETE"))}
          >
            Remove
          </button>
        </span>
      </div>
      <input
        className={field}
        placeholder="Title"
        value={String(settings.title ?? "")}
        onChange={(e) => set("title", e.target.value)}
      />
      {widget.type === "text" ? (
        <textarea
          className={field}
          rows={3}
          placeholder="Text"
          value={String(settings.body ?? "")}
          onChange={(e) => set("body", e.target.value)}
        />
      ) : null}
      {widget.type === "recent_posts" ? (
        <label className="flex items-center gap-2">
          Number of posts
          <input
            type="number"
            min={1}
            max={20}
            className={`${field} w-20`}
            value={Number(settings.count ?? 5)}
            onChange={(e) => set("count", Number(e.target.value))}
          />
        </label>
      ) : null}
      <button
        type="button"
        className="w-fit rounded bg-neutral-900 px-3 py-1.5 font-medium text-white"
        onClick={async () => onChanged(await call(`/api/admin/widgets/${widget.id}`, "PATCH", { settings }))}
      >
        Save
      </button>
    </li>
  );
}

export function WidgetsEditor({ areas, types }: { areas: Area[]; types: TypeInfo[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const done = (err: string | null) => {
    setError(err);
    if (!err) router.refresh();
  };
  const labelOf = (type: string) => types.find((t) => t.key === type)?.label ?? type;

  async function move(area: Area, index: number, dir: -1 | 1) {
    const ids = area.widgets.map((w) => w.id);
    const j = index + dir;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    done(await call(`/api/admin/widget-areas/${area.key}/order`, "PUT", { ids }));
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {areas.map((area) => (
        <section key={area.key} className="flex flex-col gap-3">
          <h2 className="font-medium">{area.name}</h2>
          {area.widgets.length === 0 ? (
            <p className="text-sm text-neutral-600">No widgets.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {area.widgets.map((w, i) => (
                <WidgetCard
                  key={`${w.id}:${JSON.stringify(w.settings)}`}
                  widget={w}
                  label={labelOf(w.type)}
                  first={i === 0}
                  last={i === area.widgets.length - 1}
                  onChanged={done}
                  onMove={(dir) => move(area, i, dir)}
                />
              ))}
            </ul>
          )}
          <select
            className={`${field} w-fit`}
            defaultValue=""
            onChange={async (e) => {
              const type = e.target.value;
              e.target.value = "";
              if (type) done(await call("/api/admin/widgets", "POST", { area: area.key, type }));
            }}
          >
            <option value="">Add widget…</option>
            {types.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </section>
      ))}
    </div>
  );
}
