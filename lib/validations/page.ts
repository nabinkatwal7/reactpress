import { z } from "zod";

export const pageStatusSchema = z.enum(["draft", "publish", "scheduled", "private", "trash"]);

const blocksSchema = z.array(z.object({ type: z.string().min(1) }).passthrough());

/** Create: missing content means an empty document. */
export const pageContentSchema = blocksSchema.default([]);

const slugField = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case");

export const createPageSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  slug: slugField.optional(),
  status: pageStatusSchema.default("draft"),
  content: pageContentSchema.optional(),
  scheduledAt: z.iso.datetime().nullable().optional(),
  parentId: z.string().min(1).nullable().optional(),
}).superRefine(needsSchedule);

export const updatePageSchema = z.object({
  title: z.string().trim().min(1, "Title is required").optional(),
  slug: slugField.optional(),
  status: pageStatusSchema.optional(),
  content: blocksSchema.optional(),
  scheduledAt: z.iso.datetime().nullable().optional(),
  parentId: z.string().min(1).nullable().optional(),
}).superRefine(needsSchedule);

/** Client form schema — empty slug allowed, stripped before submit. */
export const pageFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  slug: z.string().trim(),
  status: pageStatusSchema,
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

export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;
export type PageFormValues = z.infer<typeof pageFormSchema>;
