import { z } from "zod";

export const updateMediaSchema = z.object({
  altText: z.string().trim().max(500).optional(),
  title: z.string().trim().max(200).optional(),
});
