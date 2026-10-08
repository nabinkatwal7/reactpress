"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const btn = "rounded border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50";

export function PluginActions({
  slug,
  installed,
  active,
  hasConfig,
}: {
  slug: string;
  installed: boolean;
  active: boolean;
  hasConfig: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "install" | "activate" | "deactivate" | "delete") {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/plugins", {
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
      {active ? (
        <button type="button" disabled={busy} onClick={() => run("deactivate")} className={btn}>
          Deactivate
        </button>
      ) : (
        <button type="button" disabled={busy} onClick={() => run("activate")} className={`${btn} bg-neutral-900 text-white`}>
          Activate
        </button>
      )}
      {!installed ? (
        <button type="button" disabled={busy} onClick={() => run("install")} className={btn}>
          Install
        </button>
      ) : null}
      {installed && !active ? (
        <button type="button" disabled={busy} onClick={() => run("delete")} className={`${btn} text-red-600`}>
          Delete
        </button>
      ) : null}
      {installed && hasConfig ? (
        <Link href={`/admin/plugins/${slug}`} className="text-sm underline">
          Settings
        </Link>
      ) : null}
      {error ? <span className="text-sm text-red-600">{error}</span> : null}
    </div>
  );
}
