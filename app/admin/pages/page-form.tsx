"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { pageFormSchema, type PageFormValues } from "@/lib/validations/page";
import { createPageAction, updatePageAction } from "./actions";

type Props = {
  mode: "create" | "edit";
  pageId?: string;
  defaults?: {
    title: string;
    slug: string;
    status: "draft" | "publish" | "private" | "trash";
    contentText: string;
  };
};

export function PageForm({ mode, pageId, defaults }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PageFormValues>({
    resolver: zodResolver(pageFormSchema),
    defaultValues: {
      title: defaults?.title ?? "",
      slug: defaults?.slug ?? "",
      status: defaults?.status ?? "draft",
      contentText: defaults?.contentText ?? "",
    },
  });

  async function onSubmit(values: PageFormValues) {
    setServerError(null);
    setSaved(false);

    let content: Record<string, unknown>[] = [];
    if (values.contentText.trim()) {
      try {
        const parsed = JSON.parse(values.contentText) as unknown;
        if (!Array.isArray(parsed)) {
          setServerError("Content must be a JSON array");
          return;
        }
        content = parsed as Record<string, unknown>[];
      } catch {
        setServerError("Content must be valid JSON");
        return;
      }
    }

    const slug = values.slug.trim() || undefined;
    if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setServerError("Slug must be lowercase kebab-case");
      return;
    }

    const payload = {
      title: values.title,
      slug,
      status: values.status,
      content,
    };

    if (mode === "create") {
      const result = await createPageAction(payload);
      if (result?.error) setServerError(result.error);
      return;
    }

    if (!pageId) return;
    const result = await updatePageAction(pageId, payload);
    if (result?.error) {
      setServerError(result.error);
      return;
    }
    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-xl flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1 text-sm">
        Title
        <input
          className="rounded border border-neutral-300 px-3 py-2"
          {...register("title")}
        />
        {errors.title ? (
          <span className="text-red-600">{errors.title.message}</span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Slug
        <input
          className="rounded border border-neutral-300 px-3 py-2 font-mono text-sm"
          placeholder="auto from title"
          {...register("slug")}
        />
        {errors.slug ? (
          <span className="text-red-600">{errors.slug.message}</span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Status
        <select
          className="rounded border border-neutral-300 px-3 py-2"
          {...register("status")}
        >
          <option value="draft">Draft</option>
          <option value="publish">Publish</option>
          <option value="private">Private</option>
          <option value="trash">Trash</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Content (JSON array)
        <textarea
          rows={8}
          className="rounded border border-neutral-300 px-3 py-2 font-mono text-sm"
          placeholder='[{"type":"paragraph","text":"Hello"}]'
          {...register("contentText")}
        />
      </label>

      {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
      {saved ? <p className="text-sm text-green-700">Saved</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-fit rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isSubmitting ? "Saving…" : mode === "create" ? "Create page" : "Update page"}
      </button>
    </form>
  );
}
