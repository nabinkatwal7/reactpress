"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const btn = "rounded border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50";

export function ThemeActions({ slug, installed, active }: { slug: string; installed: boolean; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "install" | "activate" | "uninstall") {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/themes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, slug }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(json?.error ?? "Request failed");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!active ? (
        <button type="button" disabled={busy} onClick={() => run("activate")} className={`${btn} bg-neutral-900 text-white`}>
          Activate
        </button>
      ) : null}
      {!installed ? (
        <button type="button" disabled={busy} onClick={() => run("install")} className={btn}>
          Install
        </button>
      ) : null}
      {installed && !active ? (
        <button type="button" disabled={busy} onClick={() => run("uninstall")} className={`${btn} text-red-600`}>
          Remove
        </button>
      ) : null}
      <a href="/" target="_blank" rel="noreferrer" className="text-sm underline">
        View site
      </a>
      {error ? <span className="text-sm text-red-600">{error}</span> : null}
    </div>
  );
}
