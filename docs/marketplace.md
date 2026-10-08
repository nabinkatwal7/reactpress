# Marketplace

Install themes and plugins from a **registry**: a JSON catalog that anyone can host. Network admin
(super admins) manages registries and installs at `/network/marketplace`, or with the CLI.

## What installing means

A package is code. Installing one puts it in `themes/<slug>/` or `plugins/<slug>/` and **it runs with
the app's privileges**. Treat a registry like you treat npm: add only registries you trust, and
review what you install. ReactPress adds guard rails, not a sandbox:

- only super admins can install; registries must be `https` (dev mode excepted) and are listed per network
- the download URL comes from the registry (never from the browser) and goes through the same
  private-address protection as webhooks
- the zip must match the registry's `sha256`; it is unpacked defensively (no `..` paths, no symlinks,
  size and file-count limits, CRC check)
- only source and asset file types are accepted (no scripts, native modules or SVG)
- the unpacked folder must pass the theme/plugin validator and the import scan
  (`lib/plugins/scan.ts`: no `fs`, Prisma, `process`, `eval`, unlisted imports)
- packages that ship with ReactPress can never be replaced or removed

`REACTPRESS_DISALLOW_FILE_MODS=1` turns installing and removing off entirely.

## How it becomes live

Themes and plugins are imported statically, so the installer writes a generated file
(`themes/installed.generated.ts`, `plugins/installed.generated.ts`) that registers every installed folder.

- `next dev`: picked up on the next request.
- production (`next start`): the server serves the code it was built with, so run `next build` and restart.
  Installing at runtime also needs a writable project folder: it does not work on read-only or
  serverless hosts. There, install on the build machine and deploy the result.

Installed packages and the generated files are part of your project: commit them, or reinstall on deploy.
"Switch on for this site" writes the site's install rows right away, so the package starts being used
as soon as the new code is loaded.

## Registry format

```json
{
  "format": "reactpress-registry",
  "version": 1,
  "name": "My registry",
  "items": [
    {
      "type": "theme",
      "slug": "my-theme",
      "name": "My Theme",
      "version": "1.2.0",
      "author": "Me",
      "description": "A short description",
      "homepage": "https://example.com/my-theme",
      "download": "https://example.com/downloads/my-theme-1.2.0.zip",
      "sha256": "<64 hex characters, the sha256 of the zip>",
      "size": 12345
    }
  ]
}
```

`slug` and `version` must match the package's own `theme.json` / `plugin.json`, or the install is refused.
A higher `version` than the installed one shows as an update.

## Publishing a package

```bash
reactpress package themes/my-theme --out dist --url-base https://example.com/downloads
```

Writes `dist/my-theme-1.2.0.zip` (reproducible) and prints the registry entry, with the checksum, to paste
into your registry's `items`. Host the zip and the registry JSON anywhere with HTTPS.

## Using it

```bash
reactpress registry add https://example.com/registry.json
reactpress marketplace list
reactpress marketplace install my-theme            # also switches it on for the site in your login URL
reactpress marketplace install my-plugin --no-activate
reactpress marketplace remove theme my-theme --force
```

Local test setup: set `REACTPRESS_ALLOW_PRIVATE_FETCH=1` to allow `http://127.0.0.1` registries.
