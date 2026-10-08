"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PickedMedia = { id: string; url: string; alt: string; filename: string };

type Item = {
  id: string;
  url: string;
  filename: string;
  altText: string;
  mimeType: string;
};

const field = "rounded border border-neutral-300 px-3 py-1.5 text-sm";

/**
 * Reusable media library modal, controlled by the parent:
 * `<MediaPicker open={open} onClose={() => setOpen(false)} onSelect={…} />`.
 * Shows images only by default (kind="image"). The parent closes it in onSelect.
 */
export function MediaPicker({
  open,
  onClose,
  onSelect,
  kind = "image",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (media: PickedMedia) => void;
  kind?: "image" | "all";
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const sp = new URLSearchParams({ page: String(page) });
    if (q.trim()) sp.set("q", q.trim());
    if (kind === "image") sp.set("kind", "image");
    try {
      const res = await fetch(`/api/admin/media?${sp}`);
      if (!res.ok) throw new Error("Could not load media");
      const json = (await res.json()) as { media: Item[]; pages: number };
      setItems(json.media);
      setPages(json.pages);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, q, kind]);

  // open/close the native dialog from the `open` prop
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // load (debounced for typing) while open
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [open, load, q]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    for (const file of Array.from(files)) {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/admin/media", { method: "POST", body });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(`${file.name}: ${json?.error ?? "Upload failed"}`);
        return;
      }
    }
    setQ("");
    setPage(1);
    await load();
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose(); // backdrop click
      }}
      className="m-auto w-[min(56rem,92vw)] rounded border border-neutral-300 p-0 backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Media library</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-neutral-500">
            ✕
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            className={field}
            placeholder="Search files…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <label className={`${field} cursor-pointer`}>
            Upload
            <input
              type="file"
              multiple
              accept={kind === "image" ? "image/*" : undefined}
              className="sr-only"
              onChange={(e) => {
                void upload(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="min-h-48">
          {loading && items.length === 0 ? <p className="text-sm text-neutral-500">Loading…</p> : null}
          {!loading && items.length === 0 ? <p className="text-sm text-neutral-500">No files found.</p> : null}
          <ul className="grid max-h-[50vh] grid-cols-3 gap-3 overflow-y-auto md:grid-cols-5">
            {items.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="flex w-full flex-col gap-1 border border-neutral-200 p-1 text-left text-xs hover:border-neutral-900"
                  onClick={() => onSelect({ id: m.id, url: m.url, alt: m.altText, filename: m.filename })}
                >
                  {m.mimeType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt={m.altText} className="aspect-square w-full object-cover" />
                  ) : (
                    <span className="flex aspect-square items-center justify-center bg-neutral-100">{m.mimeType}</span>
                  )}
                  <span className="truncate">{m.filename}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {pages > 1 ? (
          <div className="flex items-center gap-3 text-sm">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ← Previous
            </button>
            <span>
              Page {page} of {pages}
            </span>
            <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Next →
            </button>
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
