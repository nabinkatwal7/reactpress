import { z } from "zod";

export const postStatusSchema = z.enum(["draft", "publish", "scheduled", "private", "trash"]);

export const postContentSchema = z.array(z.record(z.string(), z.unknown())).default([]);

const slugField = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case");

export const createPostSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  slug: slugField.optional(),
  status: postStatusSchema.default("draft"),
  content: postContentSchema.optional(),
  scheduledAt: z.iso.datetime().nullable().optional(),
}).superRefine(needsSchedule);

export const updatePostSchema = z.object({
  title: z.string().trim().min(1, "Title is required").optional(),
  slug: slugField.optional(),
  status: postStatusSchema.optional(),
  content: postContentSchema.optional(),
  scheduledAt: z.iso.datetime().nullable().optional(),
}).superRefine(needsSchedule);

/** Client form schema — empty slug allowed, stripped before submit. */
export const postFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  slug: z.string().trim(),
  status: postStatusSchema,
  contentText: z.string(),
  scheduledAt: z.string().optional(),
});

function needsSchedule(v: { status?: string; scheduledAt?: string | null }, ctx: z.RefinementCtx) {
  if (v.status !== "scheduled") return;
  if (!v.scheduledAt) {
    ctx.addIssue({ code: "custom", path: ["scheduledAt"], message: "Schedule date is required" });
  } else if (new Date(v.scheduledAt).getTime() <= Date.now()) {
    ctx.addIssue({ code: "custom", path: ["scheduledAt"], message: "Schedule date must be in the future" });
  }
}

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type PostFormValues = z.infer<typeof postFormSchema>;
