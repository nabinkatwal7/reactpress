"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Field = {
  key: string;
  label: string;
  type: "color" | "text" | "image" | "select" | "checkbox";
  options?: { value: string; label: string }[];
};
type Values = Record<string, string | boolean>;

const input = "rounded border border-neutral-300 px-3 py-2";

export function PluginSettingsForm({ slug, fields, initial }: { slug: string; fields: Field[]; initial: Values }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (key: string, v: string | boolean) => setValues((s) => ({ ...s, [key]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/plugins/${slug}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
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
      {fields.map((f) => {
        const v = values[f.key];
        return (
          <label key={f.key} className={f.type === "checkbox" ? "flex items-center gap-2" : "flex flex-col gap-1"}>
            {f.type === "checkbox" ? (
              <>
                <input type="checkbox" checked={v === true} onChange={(e) => set(f.key, e.target.checked)} />
                {f.label}
              </>
            ) : (
              <>
                {f.label}
                {f.type === "select" ? (
                  <select className={input} value={typeof v === "string" ? v : ""} onChange={(e) => set(f.key, e.target.value)}>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={input}
                    type={f.type === "color" ? "color" : "text"}
                    placeholder={f.type === "image" ? "Media URL" : undefined}
                    value={typeof v === "string" ? v : ""}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                )}
              </>
            )}
          </label>
        );
      })}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50">
          {busy ? "Saving…" : "Save settings"}
        </button>
        {msg ? <span className={msg.ok ? "text-green-700" : "text-red-600"}>{msg.text}</span> : null}
      </div>
    </form>
  );
}
