import { z } from "zod";

export const MAX_MENU_DEPTH = 3;

export const createMenuSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
});

export const updateMenuSchema = createMenuSchema;

export const menuItemInputSchema = z
  .object({
    label: z.string().trim().min(1, "Label is required").max(200),
    objectType: z.enum(["custom", "post", "page"]),
    objectId: z.string().min(1).nullable().optional(),
    url: z.string().trim().max(2000).nullable().optional(),
    depth: z.number().int().min(0).max(MAX_MENU_DEPTH - 1),
  })
  .superRefine((v, ctx) => {
    if (v.objectType === "custom") {
      // only http(s), mailto, tel or site-relative links; blocks javascript: and friends
      if (!v.url || !/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(v.url)) {
        ctx.addIssue({ code: "custom", path: ["url"], message: "Custom links need a valid URL" });
      }
    } else if (!v.objectId) {
      ctx.addIssue({ code: "custom", path: ["objectId"], message: "Choose a target" });
    }
  });

/** Flat list in display order; `depth` encodes nesting (first item must be depth 0, each step down at most +1). */
export const saveMenuItemsSchema = z
  .object({ items: z.array(menuItemInputSchema).max(200) })
  .superRefine((v, ctx) => {
    let prev = -1;
    v.items.forEach((item, i) => {
      if (item.depth > prev + 1) {
        ctx.addIssue({
          code: "custom",
          path: ["items", i, "depth"],
          message: "Item is nested too deeply under its predecessor",
        });
      }
      prev = item.depth;
    });
  });

export const setLocationSchema = z.object({
  location: z.string().trim().min(1),
  menuId: z.string().min(1).nullable(),
});

export type MenuItemInput = z.infer<typeof menuItemInputSchema>;
