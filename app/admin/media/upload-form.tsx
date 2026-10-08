"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function UploadForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const files = (form.elements.namedItem("file") as HTMLInputElement).files;
    if (!files?.length) return;

    setBusy(true);
    for (const file of Array.from(files)) {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/admin/media", { method: "POST", body });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(`${file.name}: ${json?.error ?? "Upload failed"}`);
        break;
      }
    }
    setBusy(false);
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 text-sm">
      <input type="file" name="file" multiple required />
      {error ? <p className="text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="w-fit rounded bg-neutral-900 px-3 py-2 font-medium text-white disabled:opacity-60"
      >
        {busy ? "Uploading…" : "Upload"}
      </button>
    </form>
  );
}
