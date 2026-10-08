# Export, import, WordPress import and backups

All of these live under **Admin > Tools** (needs the `manage_options` capability) and in the CLI.

| What | Admin | CLI | API |
| --- | --- | --- | --- |
| Export a site as JSON | Tools > Export | `reactpress export [--media] [--out f.json]` | `GET /api/admin/export[?media=1]` |
| Import ReactPress JSON | Tools > Import | `reactpress import f.json [--mode replace --yes]` | `POST /api/admin/import?mode=merge\|replace[&confirm=replace]` |
| Import from WordPress | Tools > Import from WordPress | `reactpress import-wordpress f.xml [--media]` | `POST /api/admin/import/wordpress[?media=1]` |
| Backup (zip with media) | Tools > Backup and restore | `reactpress backup [--out f.zip]` | `GET /api/admin/backup` |
| Restore a backup | Tools > Backup and restore | `reactpress restore f.zip --yes` | `POST /api/admin/backup/restore?confirm=replace` |

Everything works on **the site you are on** (the one in the URL or selected in the admin).

## ReactPress JSON (`reactpress-export`, version 1)

One file with the site's content and configuration: posts (any post type), pages, taxonomies and terms, media,
comments, menus and their locations, widgets, settings, theme installs / customizer values / template parts /
template overrides, plugin installs / settings / stored data. The schema is `lib/portability/format.ts`;
rows refer to each other by the ids inside the file, and import creates fresh ids.

**Not included, on purpose:** users and passwords (people belong to the network; authors are matched by *email*
on import and fall back to whoever runs the import), memberships, API tokens, webhooks (their URLs and secrets
belong to one environment), revisions, and comment IP addresses / user agents.

`--media` embeds uploaded files as base64 (up to 50 MB total). Without it, media rows come across only if the
file is available; otherwise they are skipped with a warning and posts lose that featured image.

### Merge or replace

- **merge** (default): adds posts, pages, terms, taxonomies, post types, media and comments next to what is there.
  A slug that already exists gets a suffix (`hello` becomes `hello-2`); terms with the same taxonomy and slug are reused.
  Settings, menus, widgets, themes and plugins are left alone.
- **replace**: first removes the site's content, media (including the files), menus, widgets, settings, theme and plugin
  records, then imports everything. Requires explicit confirmation. Users, memberships, tokens and webhooks stay.

Imports are all-or-nothing: if anything fails, the site is unchanged. Warnings (skipped items, unknown settings) are
reported but do not stop the import. Importing does not send webhooks.

Files are validated before anything is written: unknown versions, unsafe slugs, duplicate ids and bad statuses are
rejected; parent loops (page A under B under A) are broken; media of disallowed types (for example SVG) is skipped.

## WordPress (WXR)

Export from WordPress with **Tools > Export > All content**, then import the `.xml` here.

| WordPress | ReactPress |
| --- | --- |
| posts, pages | posts, pages (page parents kept) |
| `publish`, `draft` / `pending`, `private`, `trash`, `future` | `publish`, `draft`, `private`, `trash`, `scheduled` (a future date schedules it) |
| categories (with parents), tags | categories, tags |
| post content (classic or Gutenberg HTML) | blocks: paragraphs, headings (h1/h2 become 2), lists, quotes, code, images, rules; other markup is flattened to text |
| authors | matched by the author's email in the export, else the importer |
| featured image, image blocks | with **download media**: copied into the media library and re-linked; without it, images keep their original URLs |

Skipped, and reported: comments, custom post types and taxonomies, menus, users, widgets, shortcodes other than captions,
auto-drafts. Inline formatting and links are not representable in blocks, so their text is kept without markup.
Importing the same file twice adds suffixed copies (`-2`).

Safety: files with a `DOCTYPE` or entity declaration are refused, scripts / iframes / styles in content are dropped,
only `http(s)` and root-relative image URLs are kept, and media downloads go through the same private-address
protection as webhooks (set `REACTPRESS_ALLOW_PRIVATE_FETCH=1` to download from a local server), are limited to
allowed file types, 10 MB each and 300 files.

## Backups

A backup is a zip: `manifest.json` (checksums of every file), `site.json` (the JSON export above, without embedded
media) and `media/...` (the uploaded files). **Restoring** verifies every checksum first, then does a *replace*
import, so a damaged, incomplete or tampered archive is refused before anything changes.

Limits: 500 MB per site (memory-bound; larger sites should back up the database and `storage/` directly).
`next.config.ts` raises `proxyClientMaxBodySize` to 250 MB so large imports and restores are not cut off by the proxy.

What a backup does **not** cover: users and passwords, memberships, webhooks, API tokens, the code of installed
themes/plugins (those are part of your project), and files plugins keep in their private folder.
