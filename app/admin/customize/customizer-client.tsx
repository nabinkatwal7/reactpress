"use client";

import { MediaPicker } from "@/components/admin/media-picker";
import { useCallback, useEffect, useRef, useState } from "react";

type Field = {
  key: string;
  label: string;
  type: "color" | "text" | "image" | "select" | "checkbox";
  options?: { value: string; label: string }[];
};

type Values = {
  mods: Record<string, string | boolean>;
  homepage_mode: "latest" | "page";
  homepage_page_id: string | null;
  menus: { primary: string | null; footer: string | null };
};

const field = "rounded border border-neutral-300 px-3 py-2 text-sm";

export function CustomizerClient({
  settings,
  live,
  initialDraft,
  menus,
  pages,
}: {
  settings: Field[];
  live: Values;
  initialDraft: Values | null;
  menus: { id: string; name: string }[];
  pages: { id: string; title: string }[];
}) {
  const [values, setValues] = useState<Values>(initialDraft ?? live);
  const [hasDraft, setHasDraft] = useState(initialDraft !== null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewPath, setPreviewPath] = useState("/");
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  const first = useRef(true);

  const call = useCallback(async (method: string, url: string, body?: unknown) => {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => null)) as { error?: string } | null;
    return res.ok ? { ok: true as const } : { ok: false as const, error: json?.error ?? "Request failed" };
  }, []);

  // Autosave the draft shortly after every change, then refresh the preview.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(async () => {
      const res = await call("PUT", "/api/admin/customizer", values);
      if (res.ok) {
        setHasDraft(true);
        setStatus(null);
        setPreviewKey((k) => k + 1);
      } else {
        setStatus({ ok: false, text: res.error });
      }
    }, 500);
    return () => clearTimeout(t);
  }, [values, call]);

  const setMod = (key: string, v: string | boolean) =>
    setValues((s) => ({ ...s, mods: { ...s.mods, [key]: v } }));

  async function publish() {
    setStatus(null);
    const res = await call("POST", "/api/admin/customizer/publish");
    if (!res.ok) return setStatus({ ok: false, text: res.error });
    setHasDraft(false);
    setStatus({ ok: true, text: "Published — your changes are live." });
    setPreviewKey((k) => k + 1);
  }

  async function discard() {
    const res = await call("DELETE", "/api/admin/customizer");
    if (!res.ok) return setStatus({ ok: false, text: res.error });
    first.current = true; // do not re-save the reset values as a new draft
    setValues(live);
    setHasDraft(false);
    setStatus({ ok: true, text: "Draft discarded." });
    setPreviewKey((k) => k + 1);
  }

  return (
    <div className="grid flex-1 gap-6 lg:grid-cols-[22rem_1fr]">
      <div className="flex flex-col gap-6 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={publish}
            disabled={!hasDraft}
            className="rounded bg-neutral-900 px-3 py-2 font-medium text-white disabled:opacity-40"
          >
            Publish
          </button>
          <button type="button" onClick={discard} disabled={!hasDraft} className="rounded border border-neutral-300 px-3 py-2 disabled:opacity-40">
            Discard draft
          </button>
          <span className="text-neutral-500">{hasDraft ? "Unpublished changes" : "Matches the live site"}</span>
        </div>
        {status ? <p className={status.ok ? "text-green-700" : "text-red-600"}>{status.text}</p> : null}

        <section className="flex flex-col gap-3">
          <h2 className="font-medium">Theme options</h2>
          {settings.length === 0 ? <p className="text-neutral-500">This theme has no options.</p> : null}
          {settings.map((f) => {
            const v = values.mods[f.key];
            return (
              <label key={f.key} className="flex flex-col gap-1">
                {f.type !== "checkbox" ? f.label : null}
                {f.type === "color" ? (
                  <input
                    type="color"
                    value={typeof v === "string" ? v : "#000000"}
                    onChange={(e) => setMod(f.key, e.target.value)}
                    className="h-9 w-16"
                  />
                ) : null}
                {f.type === "text" ? (
                  <input className={field} value={typeof v === "string" ? v : ""} onChange={(e) => setMod(f.key, e.target.value)} />
                ) : null}
                {f.type === "select" ? (
                  <select className={field} value={typeof v === "string" ? v : ""} onChange={(e) => setMod(f.key, e.target.value)}>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : null}
                {f.type === "checkbox" ? (
                  <span className="flex items-center gap-2">
                    <input type="checkbox" checked={v === true} onChange={(e) => setMod(f.key, e.target.checked)} />
                    {f.label}
                  </span>
                ) : null}
                {f.type === "image" ? (
                  <span className="flex items-center gap-2">
                    {typeof v === "string" && v ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v} alt="" className="h-10 w-auto border border-neutral-200" />
                    ) : null}
                    <button type="button" className="rounded border border-neutral-300 px-3 py-1.5" onClick={() => setPickingFor(f.key)}>
                      {v ? "Replace" : "Choose image"}
                    </button>
                    {v ? (
                      <button type="button" className="text-red-600" onClick={() => setMod(f.key, "")}>
                        Remove
                      </button>
                    ) : null}
                  </span>
                ) : null}
              </label>
            );
          })}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-medium">Homepage</h2>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={values.homepage_mode === "latest"}
              onChange={() => setValues((s) => ({ ...s, homepage_mode: "latest" }))}
            />
            Latest posts
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={values.homepage_mode === "page"}
              onChange={() => setValues((s) => ({ ...s, homepage_mode: "page" }))}
            />
            A static page
          </label>
          {values.homepage_mode === "page" ? (
            <select
              className={field}
              value={values.homepage_page_id ?? ""}
              onChange={(e) => setValues((s) => ({ ...s, homepage_page_id: e.target.value || null }))}
            >
              <option value="">Select a page…</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          ) : null}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-medium">Menus</h2>
          {(["primary", "footer"] as const).map((loc) => (
            <label key={loc} className="flex flex-col gap-1">
              {loc === "primary" ? "Primary navigation" : "Footer"}
              <select
                className={field}
                value={values.menus[loc] ?? ""}
                onChange={(e) => setValues((s) => ({ ...s, menus: { ...s.menus, [loc]: e.target.value || null } }))}
              >
                <option value="">— none —</option>
                {menus.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </section>

        <section className="flex flex-col gap-1">
          <h2 className="font-medium">Preview page</h2>
          <input
            className={field}
            value={previewPath}
            onChange={(e) => setPreviewPath(e.target.value.startsWith("/") ? e.target.value : `/${e.target.value}`)}
            aria-label="Preview path"
          />
        </section>
      </div>

      <div className="flex min-h-[32rem] flex-col border border-neutral-200">
        <p className="border-b border-neutral-200 px-3 py-1.5 text-xs text-neutral-500">
          Preview {hasDraft ? "(draft)" : "(live)"}
        </p>
        <iframe
          key={previewKey}
          title="Site preview"
          src={`${previewPath}${previewPath.includes("?") ? "&" : "?"}rp_preview=1`}
          className="min-h-[32rem] w-full flex-1"
        />
      </div>

      <MediaPicker
        open={pickingFor !== null}
        onClose={() => setPickingFor(null)}
        onSelect={(m) => {
          if (pickingFor) setMod(pickingFor, m.url);
          setPickingFor(null);
        }}
      />
    </div>
  );
}
