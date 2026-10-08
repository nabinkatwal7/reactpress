"use client";

import { postFormSchema, type PostFormValues } from "@/lib/validations/post";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { MediaPicker } from "@/components/admin/media-picker";
import { BlockEditor } from "@/components/admin/block-editor";
import { toBlocks, type Block } from "@/lib/blocks";
import { useForm } from "react-hook-form";
import { createPostAction, updatePostAction } from "./actions";

type Props = {
  mode: "create" | "edit";
  postId?: string;
  postType?: string;
  featuredUrl?: string;
  defaults?: {
    title: string;
    slug: string;
    status: "draft" | "publish" | "scheduled" | "private" | "trash";
    contentText: string;
    scheduledAt?: string;
    featuredMediaId?: string;
  };
};

export function PostForm({ mode, postId, postType, featuredUrl, defaults }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [picking, setPicking] = useState(false);
  const [featured, setFeatured] = useState<{ id: string; url: string } | null>(
    defaults?.featuredMediaId && featuredUrl ? { id: defaults.featuredMediaId, url: featuredUrl } : null,
  );
  const [blocks, setBlocks] = useState<Block[]>(() => {
    try {
      return toBlocks(JSON.parse(defaults?.contentText || "[]"));
    } catch {
      return [];
    }
  });
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues: {
      title: defaults?.title ?? "",
      slug: defaults?.slug ?? "",
      status: defaults?.status ?? "draft",
      contentText: defaults?.contentText ?? "",
      scheduledAt: defaults?.scheduledAt ?? "",
      featuredMediaId: defaults?.featuredMediaId ?? "",
    },
  });

  async function onSubmit(values: PostFormValues) {
    setServerError(null);
    setSaved(false);

    const content = blocks;

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
      featuredMediaId: values.featuredMediaId || null,
      ...(mode === "create" && postType ? { type: postType } : {}),
      scheduledAt:
        values.status === "scheduled" && values.scheduledAt
          ? new Date(values.scheduledAt).toISOString()
          : null,
    };

    if (mode === "create") {
      const result = await createPostAction(payload);
      if (result?.error) setServerError(result.error);
      return;
    }

    if (!postId) return;
    const result = await updatePostAction(postId, payload);
    if (result?.error) {
      setServerError(result.error);
      return;
    }
    setSaved(true);
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex max-w-3xl flex-col gap-4"
      noValidate
    >
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
          <option value="scheduled">Scheduled</option>
          <option value="private">Private</option>
          <option value="trash">Trash</option>
        </select>
      </label>

      {watch("status") === "scheduled" ? (
        <label className="flex flex-col gap-1 text-sm">
          Publish at
          <input
            type="datetime-local"
            className="rounded border border-neutral-300 px-3 py-2"
            {...register("scheduledAt")}
          />
        </label>
      ) : null}

      <div className="flex flex-col gap-2 text-sm">
        Featured image
        {featured ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={featured.url} alt="" className="max-h-40 w-fit" />
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-neutral-300 px-3 py-2"
            onClick={() => setPicking(true)}
          >
            {featured ? "Replace" : "Choose image"}
          </button>
          {featured ? (
            <button
              type="button"
              className="text-red-600"
              onClick={() => {
                setFeatured(null);
                setValue("featuredMediaId", "");
              }}
            >
              Remove
            </button>
          ) : null}
        </div>
        <MediaPicker
          open={picking}
          onClose={() => setPicking(false)}
          onSelect={(m) => {
            setFeatured({ id: m.id, url: m.url });
            setValue("featuredMediaId", m.id);
            setPicking(false);
          }}
        />
      </div>

      <div className="flex flex-col gap-1 text-sm">
        Content
        <BlockEditor value={blocks} onChange={setBlocks} />
      </div>

      {serverError ? (
        <p className="text-sm text-red-600">{serverError}</p>
      ) : null}
      {saved ? <p className="text-sm text-green-700">Saved</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-fit rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isSubmitting
          ? "Saving…"
          : mode === "create"
            ? "Create post"
            : "Update post"}
      </button>
    </form>
  );
}
