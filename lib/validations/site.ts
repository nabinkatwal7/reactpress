import { z } from "zod";

/** Shape only; slug/domain rules are enforced (with friendly messages) by lib/network/sites.ts. */
export const siteSchema = z.object({
  name: z.string(),
  slug: z.string(),
  domain: z.string().nullish(),
});
