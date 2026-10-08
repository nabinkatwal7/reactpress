"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Report = { mode: string; counts: Record<string, number>; warnings: string[] };

const btn = "rounded border border-neutral-300 px-4 py-2 text-sm disabled:opacity-50";

export function ToolsPanel() {
  const router = useRouter();
  const [withMedia, setWithMedia] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  async function runImport(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    setReport(null);
    const res = await fetch(`/api/admin/import?mode=${mode}${mode === "replace" ? "&confirm=replace" : ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await file.text(),
    });
    const json = (await res.json().catch(() => null)) as { error?: string; report?: Report } | null;
    setBusy(false);
    if (!res.ok) return setError(json?.error ?? "Import failed");
    setReport(json!.report!);
    setConfirmed(false);
    router.refresh();
  }

  return (
    <div className="flex max-w-2xl flex-col gap-10 text-sm">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Export</h2>
        <p className="text-neutral-600">
          Download this site (content, settings, menus, widgets, theme and plugin settings) as one ReactPress JSON file. Users, passwords,
          webhooks and comment IP addresses are never included.
        </p>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={withMedia} onChange={(e) => setWithMedia(e.target.checked)} />
          Include uploaded files (up to 50 MB)
        </label>
        <div>
          <a className={`${btn} inline-block bg-neutral-900 text-white`} href={`/api/admin/export${withMedia ? "?media=1" : ""}`}>
            Download export
          </a>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Import</h2>
        <form onSubmit={runImport} className="flex flex-col gap-3">
          <input type="file" accept="application/json,.json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <fieldset className="flex flex-col gap-2">
            <label className="flex items-start gap-2">
              <input type="radio" checked={mode === "merge"} onChange={() => setMode("merge")} className="mt-1" />
              <span>
                <strong>Add to this site.</strong> Posts, pages, terms, media and comments are added; names that exist get a number
                (hello-2). Settings, menus, widgets, themes and plugins stay as they are.
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} className="mt-1" />
              <span>
                <strong>Replace this site.</strong> Deletes the current content, media, menus, widgets and settings first, then imports
                everything from the file.
              </span>
            </label>
          </fieldset>
          {mode === "replace" ? (
            <label className="flex items-center gap-2 text-red-700">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              I understand this permanently deletes what is on this site now
            </label>
          ) : null}
          <div>
            <button type="submit" disabled={!file || busy || (mode === "replace" && !confirmed)} className={`${btn} bg-neutral-900 text-white`}>
              {busy ? "Importing…" : "Import"}
            </button>
          </div>
        </form>
        {error ? <p className="text-red-600">{error}</p> : null}
        {report ? (
          <div className="rounded border border-green-300 bg-green-50 p-3">
            <p className="font-medium">Import finished ({report.mode}).</p>
            <p>{Object.entries(report.counts).map(([k, v]) => `${v} ${k.replace("_", " ")}`).join(", ") || "Nothing to import."}</p>
            {report.warnings.length ? (
              <ul className="mt-2 list-disc pl-5 text-neutral-700">
                {report.warnings.slice(0, 50).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
                {report.warnings.length > 50 ? <li>and {report.warnings.length - 50} more</li> : null}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
