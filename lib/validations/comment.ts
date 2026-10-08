import { z } from "zod";

export const commentStatusSchema = z.enum(["pending", "approved", "spam", "trash"]);

export const submitCommentSchema = z.object({
  postId: z.string().min(1),
  parentId: z.string().min(1).nullable().optional(),
  authorName: z.string().trim().min(1, "Name is required").max(100),
  authorEmail: z.string().trim().email("Valid email is required").max(200),
  content: z.string().trim().min(1, "Comment is required").max(5000),
  /** Honeypot: real users leave this empty. */
  website: z.string().optional(),
});

export const moderateCommentSchema = z.object({
  status: commentStatusSchema,
});

export type SubmitCommentInput = z.infer<typeof submitCommentSchema>;
