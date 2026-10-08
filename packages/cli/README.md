# reactpress CLI

Command line for ReactPress sites. No dependencies; needs Node 20+.

```bash
node packages/cli/bin/reactpress.mjs --help     # from this repo
npm link packages/cli                           # or install it as `reactpress`
```

## Log in

```bash
reactpress login https://example.com            # asks for email and password
reactpress login https://example.com/shop       # a site on a multisite network: the path picks the site
echo "$PASSWORD" | reactpress login https://example.com --email me@example.com --password-stdin
```

`login` exchanges your password for an API token (90 days) and stores it in
`~/.reactpress/config.json` (mode 600). Your password is never saved. For CI, skip `login` and set
`REACTPRESS_URL` and `REACTPRESS_TOKEN`. `reactpress logout` revokes the token on the server.

A token has the authority of its user on the site in the URL: if you cannot do something in the
admin, the CLI cannot either.

## Commands

| Command | What it does |
| --- | --- |
| `whoami [--json]` | Show the user, site and capabilities |
| `post list [--status s] [--type t]` | List posts (all statuses, including drafts) |
| `post get <id>` | Print one post as JSON |
| `post create --title T [--status publish] [--slug s] [--content text \| --file f.md]` | Create a post |
| `post update <id> [--title T] [--status S] [--slug s] [--content text \| --file f.md]` | Change fields; others stay as they are |
| `post publish <id>` / `post delete <id> --yes` | Publish / permanently delete |
| `page list\|get\|create\|update\|publish\|delete` | Same for pages |
| `plugin list\|install\|activate\|deactivate\|delete [slug]` | Plugins of this site |
| `theme list\|install\|activate\|uninstall [slug]` | Themes of this site |
| `user list` | Members of this site and their roles |
| `user add <email> --role editor` | Give an existing account a role on this site |
| `user role <id> <role>` / `user remove <id>` | Change or remove a member |
| `user create --email e [--name n] --password-stdin` | Create a network account (super admin) |
| `scaffold plugin\|theme <slug> [--dir d]` | Starter plugin or theme in `plugins/` or `themes/` |
| `export [--out file.json]` | Posts, pages and terms as JSON |

`--file` accepts `-` for stdin. Content is plain text or light Markdown: blank lines separate
blocks; `#`/`##` heading, `###`, `####`, `- ` and `1. ` lists, `> ` quotes, fenced code, `---`.

## Scaffold

Run it from the ReactPress project root. It never overwrites an existing folder, and what it
creates passes the plugin/theme validators. Add the one import + entry it tells you to the
registry (`plugins/registry.ts` or `themes/registry.ts`).

## Tests

```bash
cd packages/cli && npm test
```
