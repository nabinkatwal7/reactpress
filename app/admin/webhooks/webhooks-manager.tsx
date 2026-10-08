"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Hook = {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  lastStatus: number | null;
  lastError: string | null;
  lastAt: string | null;
};

const input = "rounded border border-neutral-300 px-3 py-2 text-sm";
const btn = "rounded border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50";

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { ok: res.ok, json, error: res.ok ? null : String(json?.error ?? "Request failed") };
}

export function WebhooksManager({ hooks, events }: { hooks: Hook[]; events: string[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", url: "", events: new Set<string>(["post.published"]) });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ label: string; value: string } | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const r = await call("/api/admin/webhooks", "POST", { name: form.name, url: form.url, events: [...form.events] });
    if (r.error) return setError(r.error);
    setSecret({ label: "Signing secret (shown once)", value: (r.json!.webhook as { secret: string }).secret });
    setForm({ name: "", url: "", events: new Set(["post.published"]) });
    router.refresh();
  }

  async function act(label: string, p: Promise<Awaited<ReturnType<typeof call>>>, after?: (json: Record<string, unknown>) => void) {
    setError(null);
    setNotice(null);
    const r = await p;
    if (r.error) return setError(r.error);
    after?.(r.json ?? {});
    if (!after) setNotice(label);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={create} className="flex max-w-2xl flex-col gap-3 text-sm">
        <h2 className="font-medium">Add a webhook</h2>
        <div className="flex flex-wrap gap-3">
          <input className={input} placeholder="Name (optional)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input
            className={`${input} min-w-72 flex-1`}
            placeholder="https://example.com/hooks/reactpress"
            type="url"
            required
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
        </div>
        <fieldset className="flex flex-wrap gap-x-5 gap-y-1">
          <legend className="sr-only">Events</legend>
          {events.map((ev) => (
            <label key={ev} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.events.has(ev)}
                onChange={(e) => {
                  const next = new Set(form.events);
                  if (e.target.checked) next.add(ev);
                  else next.delete(ev);
                  setForm({ ...form, events: next });
                }}
              />
              {ev}
            </label>
          ))}
        </fieldset>
        <div>
          <button type="submit" className="rounded bg-neutral-900 px-4 py-2 text-white">
            Add webhook
          </button>
        </div>
      </form>

      {secret ? (
        <div className="max-w-2xl rounded border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-medium">{secret.label}</p>
          <code className="mt-1 block break-all">{secret.value}</code>
          <p className="mt-2 text-neutral-600">Copy it now: it will not be shown again. Use it to verify the signature of incoming requests.</p>
          <button type="button" className={`${btn} mt-2`} onClick={() => setSecret(null)}>
            Done
          </button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {notice ? <p className="text-sm text-green-700">{notice}</p> : null}

      <ul className="flex max-w-3xl flex-col divide-y divide-neutral-200 border border-neutral-200">
        {hooks.map((h) => (
          <li key={h.id} className="flex flex-col gap-2 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                {h.name || h.url}
                {!h.active ? <span className="ml-2 rounded bg-neutral-200 px-2 py-0.5 text-xs">Paused</span> : null}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={btn}
                  onClick={() =>
                    act("", call(`/api/admin/webhooks/${h.id}/test`, "POST"), (j) => {
                      const res = j.result as { status?: number; error?: string };
                      setNotice(res.status ? `Test sent: receiver answered HTTP ${res.status}` : "");
                      if (!res.status) setError(`Test failed: ${res.error}`);
                    })
                  }
                >
                  Send test
                </button>
                <button type="button" className={btn} onClick={() => act(h.active ? "Paused" : "Resumed", call(`/api/admin/webhooks/${h.id}`, "PATCH", { active: !h.active }))}>
                  {h.active ? "Pause" : "Resume"}
                </button>
                <button
                  type="button"
                  className={btn}
                  onClick={() =>
                    confirm("Replace the secret? Receivers must be updated.") &&
                    act("", call(`/api/admin/webhooks/${h.id}/rotate`, "POST"), (j) => setSecret({ label: "New signing secret (shown once)", value: String(j.secret) }))
                  }
                >
                  New secret
                </button>
                <button
                  type="button"
                  className={`${btn} text-red-600`}
                  onClick={() => confirm("Delete this webhook?") && act("Deleted", call(`/api/admin/webhooks/${h.id}`, "DELETE"))}
                >
                  Delete
                </button>
              </div>
            </div>
            <p className="break-all text-neutral-600">{h.url}</p>
            <p className="text-neutral-500">{h.events.join(", ")}</p>
            <p className={h.lastError ? "text-red-600" : "text-neutral-500"}>
              {h.lastAt
                ? `Last delivery ${new Date(h.lastAt).toLocaleString()}: ${h.lastError ?? `HTTP ${h.lastStatus}`}`
                : "No deliveries yet"}
            </p>
          </li>
        ))}
        {hooks.length === 0 ? <li className="p-4 text-sm text-neutral-500">No webhooks yet.</li> : null}
      </ul>
    </div>
  );
}
