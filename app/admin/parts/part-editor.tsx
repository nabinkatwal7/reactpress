"use client";

import { BlockEditor } from "@/components/admin/block-editor";
import type { Block } from "@/lib/blocks";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PartEditor({
  slug,
  label,
  initial,
  customised,
}: {
  slug: string;
  label: string;
  initial: Block[];
  customised: boolean;
}) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // bumping the key remounts the block editor so it picks up the reset content
  const [version, setVersion] = useState(0);

  async function call(method: "PUT" | "DELETE") {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/template-parts/${slug}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "PUT" ? JSON.stringify({ content: blocks }) : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      setMsg({ ok: false, text: json?.error ?? "Request failed" });
      return false;
    }
    return true;
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">{label}</h2>
      <BlockEditor key={version} value={blocks} onChange={setBlocks} />
      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          disabled={busy}
          className="rounded bg-neutral-900 px-3 py-2 font-medium text-white disabled:opacity-60"
          onClick={async () => {
            if (await call("PUT")) {
              setMsg({ ok: true, text: "Saved" });
              router.refresh();
            }
          }}
        >
          Save {slug}
        </button>
        {customised ? (
          <button
            type="button"
            disabled={busy}
            className="text-red-600"
            onClick={async () => {
              if (await call("DELETE")) {
                setBlocks([]);
                setVersion((v) => v + 1);
                setMsg({ ok: true, text: "Reset to theme default" });
                router.refresh();
              }
            }}
          >
            Reset to default
          </button>
        ) : null}
        {msg ? <span className={msg.ok ? "text-green-700" : "text-red-600"}>{msg.text}</span> : null}
      </div>
    </section>
  );
}
