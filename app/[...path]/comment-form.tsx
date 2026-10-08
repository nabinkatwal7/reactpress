"use client";

import { useState } from "react";

export function CommentForm({ postId }: { postId: string }) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postId,
        authorName: data.get("authorName"),
        authorEmail: data.get("authorEmail"),
        content: data.get("content"),
        website: data.get("website"),
      }),
    });
    const json = (await res.json().catch(() => null)) as { error?: string; status?: string } | null;
    setBusy(false);
    if (!res.ok) {
      setMessage({ ok: false, text: json?.error ?? "Could not submit comment" });
      return;
    }
    form.reset();
    setMessage({
      ok: true,
      text: json?.status === "approved" ? "Comment posted." : "Thanks! Your comment is awaiting moderation.",
    });
  }

  const input = "rounded border border-neutral-300 px-3 py-2";
  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-3 text-sm">
      <input name="authorName" required placeholder="Name" className={input} />
      <input name="authorEmail" type="email" required placeholder="Email (not published)" className={input} />
      <textarea name="content" required rows={4} placeholder="Comment" className={input} />
      {/* honeypot: hidden from people, bots fill it */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {message ? (
        <p className={message.ok ? "text-green-700" : "text-red-600"}>{message.text}</p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="w-fit rounded bg-neutral-900 px-3 py-2 font-medium text-white disabled:opacity-60"
      >
        {busy ? "Sending…" : "Post comment"}
      </button>
    </form>
  );
}
