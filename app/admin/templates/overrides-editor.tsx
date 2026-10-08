"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Override = { template: string; target: string };

const field = "rounded border border-neutral-300 px-3 py-2 text-sm";
/** Hierarchy names worth offering; any other name (page-about, category-news…) can be typed. */
const COMMON = ["home", "front-page", "single", "page", "archive", "category", "tag", "search", "404"];

export function OverridesEditor({ templates, overrides }: { templates: string[]; overrides: Override[] }) {
  const router = useRouter();
  const [template, setTemplate] = useState("page");
  const [target, setTarget] = useState(templates.find((t) => t !== "page" && t !== "index") ?? templates[0] ?? "");
  const [error, setError] = useState<string | null>(null);

  async function call(method: "PUT" | "DELETE", body: object) {
    setError(null);
    const res = await fetch("/api/admin/template-overrides", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(json?.error ?? "Request failed");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6 text-sm">
      {overrides.length === 0 ? (
        <p className="text-neutral-600">No overrides — the theme picks every template itself.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 border border-neutral-200">
          {overrides.map((o) => (
            <li key={o.template} className="flex items-center justify-between gap-4 px-4 py-3">
              <span>
                Where <code>{o.template}</code> would be used, use <code>{o.target}</code>
              </span>
              <button type="button" className="text-red-600 hover:underline" onClick={() => call("DELETE", { template: o.template })}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void call("PUT", { template, target });
        }}
      >
        <label className="flex flex-col gap-1">
          When the theme would use
          <input
            className={field}
            list="common-templates"
            value={template}
            onChange={(e) => setTemplate(e.target.value.trim().toLowerCase())}
          />
          <datalist id="common-templates">
            {COMMON.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1">
          use
          <select className={field} value={target} onChange={(e) => setTarget(e.target.value)}>
            {templates.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded bg-neutral-900 px-3 py-2 font-medium text-white">
          Save override
        </button>
      </form>
      {error ? <p className="text-red-600">{error}</p> : null}
    </div>
  );
}
