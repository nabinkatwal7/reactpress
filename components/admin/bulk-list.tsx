"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Row = { id: string; node: React.ReactNode };
type Action = { value: string; label: string; confirm?: string };
type Result = { error?: string; count?: number } | void;

/** Rows with checkboxes plus a bulk-action bar. Row content is rendered by the server page. */
export function BulkList({
  rows,
  actions,
  onApply,
  layout = "list",
}: {
  rows: Row[];
  actions: Action[];
  onApply: (ids: string[], action: string) => Promise<Result>;
  layout?: "list" | "grid";
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [action, setAction] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const all = rows.length > 0 && selected.size === rows.length;
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  function apply() {
    const chosen = actions.find((a) => a.value === action);
    if (!chosen || selected.size === 0) return;
    if (chosen.confirm && !window.confirm(chosen.confirm)) return;
    setMsg(null);
    startTransition(async () => {
      const res = await onApply([...selected], action);
      if (res && res.error) {
        setMsg({ ok: false, text: res.error });
        return;
      }
      setMsg({ ok: true, text: `${res?.count ?? selected.size} item(s) updated` });
      setSelected(new Set());
      setAction("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={all}
            onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))}
          />
          Select all
        </label>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="rounded border border-neutral-300 px-2 py-1.5"
          aria-label="Bulk action"
        >
          <option value="">Bulk actions</option>
          {actions.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={apply}
          disabled={!action || selected.size === 0 || pending}
          className="rounded border border-neutral-300 px-3 py-1.5 disabled:opacity-50"
        >
          Apply{selected.size ? ` (${selected.size})` : ""}
        </button>
        {msg ? <span className={msg.ok ? "text-green-700" : "text-red-600"}>{msg.text}</span> : null}
      </div>

      <ul
        className={
          layout === "grid"
            ? "grid grid-cols-2 gap-4 md:grid-cols-4"
            : "divide-y divide-neutral-200 border border-neutral-200"
        }
      >
        {rows.map((row) => (
          <li
            key={row.id}
            className={
              layout === "grid"
                ? "flex flex-col gap-2 border border-neutral-200 p-2 text-sm"
                : "flex items-start gap-3 px-4 py-3 text-sm"
            }
          >
            <input
              type="checkbox"
              checked={selected.has(row.id)}
              onChange={() => toggle(row.id)}
              aria-label="Select item"
              className="mt-1"
            />
            <div className="min-w-0 flex-1">{row.node}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
