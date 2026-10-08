import { z } from "zod";

/**
 * ReactPress site export, format version 1.
 *
 * One site as plain JSON. Rows refer to each other by the ids in the file (not database ids);
 * import creates new ids. What is NOT exported on purpose: users and passwords (people live at the
 * network level; authors are matched by email), memberships, API tokens, webhooks (their targets and
 * secrets belong to one environment), revisions, comment IP addresses and user agents.
 */

export const EXPORT_FORMAT = "reactpress-export";
export const EXPORT_VERSION = 1;

const status = z.enum(["draft", "publish", "scheduled", "private", "trash"]);
const commentStatus = z.enum(["pending", "approved", "spam", "trash"]);
const blocks = z.array(z.object({ type: z.string().min(1) }).passthrough()).max(5000);
const id = z.string().min(1).max(100);
const date = z.iso.datetime();
const key = z.string().min(1).max(100);
const text = (max: number) => z.string().max(max);
/** URL-safe slug, like the ones slugify() produces. Keeps odd paths out of imports. */
const slug = z.string().min(1).max(300).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase letters, digits and dashes");
const opt = <T extends z.ZodType>(t: T) => t.nullish();

const author = { author_email: opt(z.string().max(200)) };

export const exportSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  version: z.literal(EXPORT_VERSION),
  exported_at: date,
  site: z.object({ name: z.string().max(200), slug: z.string().max(100) }),
  settings: z.record(z.string(), z.unknown()).default({}),

  taxonomies: z.array(z.object({ key, label: text(100), singular: text(100), hierarchical: z.boolean() })).max(200).default([]),
  post_types: z.array(z.object({ key, label: text(100), singular: text(100), taxonomies: z.array(key).max(50) })).max(200).default([]),
  terms: z
    .array(z.object({ id, taxonomy: key, name: text(200), slug, description: opt(text(2000)), parent_id: opt(id) }))
    .max(100_000)
    .default([]),

  media: z
    .array(
      z.object({
        id,
        filename: text(200),
        path: text(300),
        mime_type: text(100),
        size: z.number().int().nonnegative(),
        alt: text(500).default(""),
        title: text(200).default(""),
        created_at: date,
        /** base64 file contents; present only when exported with media. */
        data: z.string().optional(),
      }),
    )
    .max(50_000)
    .default([]),

  posts: z
    .array(
      z.object({
        id,
        type: key,
        title: text(500),
        slug,
        status,
        content: blocks,
        published_at: opt(date),
        scheduled_at: opt(date),
        created_at: date,
        updated_at: date,
        featured_media_id: opt(id),
        term_ids: z.array(id).max(1000).default([]),
        ...author,
      }),
    )
    .max(200_000)
    .default([]),

  pages: z
    .array(
      z.object({
        id,
        parent_id: opt(id),
        title: text(500),
        slug,
        status,
        content: blocks,
        published_at: opt(date),
        scheduled_at: opt(date),
        created_at: date,
        updated_at: date,
        ...author,
      }),
    )
    .max(50_000)
    .default([]),

  comments: z
    .array(
      z.object({
        id,
        post_id: id,
        parent_id: opt(id),
        user_email: opt(z.string().max(200)),
        author_name: text(200),
        author_email: text(200),
        content: text(10_000),
        status: commentStatus,
        created_at: date,
      }),
    )
    .max(500_000)
    .default([]),

  menus: z
    .array(
      z.object({
        id,
        name: text(200),
        items: z
          .array(
            z.object({
              id,
              parent_id: opt(id),
              label: text(200),
              object_type: z.enum(["custom", "post", "page"]),
              object_id: opt(id),
              url: opt(text(2000)),
              position: z.number().int(),
            }),
          )
          .max(5000),
      }),
    )
    .max(200)
    .default([]),
  /** location -> menu id */
  menu_locations: z.record(z.string(), id).default({}),

  widget_areas: z
    .array(
      z.object({
        key,
        name: text(200),
        widgets: z.array(z.object({ type: key, settings: z.record(z.string(), z.unknown()).default({}), position: z.number().int() })).max(500),
      }),
    )
    .max(100)
    .default([]),

  themes: z
    .object({
      installs: z.array(z.object({ slug: key, version: text(40), active: z.boolean() })).max(100).default([]),
      mods: z.array(z.object({ theme: key, published: z.record(z.string(), z.unknown()), draft: z.record(z.string(), z.unknown()).nullish() })).max(100).default([]),
      parts: z.array(z.object({ theme: key, slug: key, content: blocks })).max(500).default([]),
      overrides: z.array(z.object({ theme: key, template: key, target: key })).max(500).default([]),
    })
    .default({ installs: [], mods: [], parts: [], overrides: [] }),

  plugins: z
    .object({
      installs: z.array(z.object({ slug: key, version: text(40), active: z.boolean(), settings: z.record(z.string(), z.unknown()).default({}) })).max(200).default([]),
      data: z.array(z.object({ plugin: key, key, value: z.unknown() })).max(100_000).default([]),
    })
    .default({ installs: [], data: [] }),
});

export type SiteExport = z.infer<typeof exportSchema>;

export type ImportMode = "merge" | "replace";

export type ImportReport = {
  mode: ImportMode;
  counts: Record<string, number>;
  warnings: string[];
};
