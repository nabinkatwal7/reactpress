import { z } from "zod";

export const entityTypeSchema = z.enum(["post", "page"]);

export const autosaveSchema = z.object({
  type: entityTypeSchema,
  id: z.string().min(1),
  title: z.string().trim().min(1, "Title is required"),
  content: z.array(z.record(z.string(), z.unknown())).default([]),
});
