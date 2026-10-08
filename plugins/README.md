# ReactPress plugin format

A plugin is a folder under `plugins/` with a manifest and a `register.ts` entry that hooks into
ReactPress through the plugin API. The machine-checked rules live in
[`lib/plugins/manifest.ts`](../lib/plugins/manifest.ts); this page is the human version.

```
plugins/<slug>/
  plugin.json    manifest (required)
  register.ts    entry: default-exports register(api) (required)
  ...            any other files your code imports
```

## Rules

1. **Folder name = slug.** Kebab-case (`my-plugin`). It must match `slug` in `plugin.json`.
2. **`plugin.json` is strict.** Required: `name`, `slug`, `version` (semver `1.2.3`), `author`.
   Optional: `description`, `settings`, `adminPages`.
3. **`register.ts` must `export default function register(api)`.** It runs when the plugin is
   active (on boot and after activation). Everything the plugin does goes through `api`; there is
   no other supported way to change ReactPress behaviour.
4. **Settings.** Declare fields in `settings`: `{ key, label, type, default }`, with the same
   types as theme customizer settings (`color`, `text`, `image`, `select`, `checkbox`). Keys are
   `snake_case` and unique. ReactPress renders the settings screen and stores the values per site.
5. **Admin pages.** List them in `adminPages` (`{ slug, title }`) and supply the component with
   `api.registerAdminPage(slug, component)`. They appear under `/admin/plugins/<slug>/<page>` and
   in the sidebar while the plugin is active. A page is a plain server function receiving
   `{ siteId, settings }` (no hooks or client state); put JSX in a `.tsx` file next to `register.ts`.
   Settings: ReactPress generates a form at `/admin/plugins/<slug>` from the `settings` fields.
   Read them with `await api.getSettings()` inside handlers, never at register time (they can change).
6. **Hooks.** `api.addAction(name, fn, priority?)` and `api.addFilter(name, fn, priority?)`.
   Handlers are removed automatically when the plugin is deactivated.
7. **Sandbox.** Plugins reach data and files only through `api` (see the sandbox section once
   step 34 lands). Do not import `fs`, `child_process`, Prisma or read `process.env`.

## Checking a plugin

`validatePluginDir(dir)` returns every violation at once. The install API runs it before a plugin
can be installed, and `npx tsx lib/plugins/manifest.selfcheck.ts` checks the format rules.
