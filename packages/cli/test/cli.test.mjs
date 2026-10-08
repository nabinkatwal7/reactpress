import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parseArgs } from "../src/args.mjs";
import { loadConfig, normalizeUrl, saveConfig, clearConfig } from "../src/config.mjs";
import { textToBlocks } from "../src/content.mjs";
import { table } from "../src/output.mjs";
import { scaffold } from "../src/scaffold.mjs";
import { main } from "../src/main.mjs";

test("parseArgs: flags, values, booleans and --", () => {
  const { positionals, flags } = parseArgs(["post", "create", "--title", "Hello world", "--status=publish", "--json", "extra", "--", "--literal"]);
  assert.deepEqual(positionals, ["post", "create", "extra", "--literal"]);
  assert.equal(flags.title, "Hello world");
  assert.equal(flags.status, "publish");
  assert.equal(flags.json, true);
  assert.equal(parseArgs(["--json", "post", "list"]).positionals.join(), "post,list", "boolean flags do not swallow arguments");
  assert.equal(parseArgs(["-h"]).flags.help, true);
  assert.equal(parseArgs(["--title"]).flags.title, true, "a trailing flag is a bare flag");
});

test("textToBlocks: markdown-ish text becomes blocks", () => {
  const blocks = textToBlocks("# Title\n\nFirst line\nsecond line\n\n- a\n- b\n\n1. one\n2. two\n\n> quoted\n\n---\n\n```\ncode here\n```\n\n### Small");
  assert.deepEqual(blocks, [
    { type: "heading", level: 2, text: "Title" },
    { type: "paragraph", text: "First line second line" },
    { type: "list", ordered: false, text: "a\nb" },
    { type: "list", ordered: true, text: "one\ntwo" },
    { type: "quote", text: "quoted" },
    { type: "separator" },
    { type: "code", text: "code here" },
    { type: "heading", level: 3, text: "Small" },
  ]);
  assert.deepEqual(textToBlocks(""), []);
  assert.deepEqual(textToBlocks("a\r\n\r\nb"), [{ type: "paragraph", text: "a" }, { type: "paragraph", text: "b" }]);
});

test("normalizeUrl", () => {
  assert.equal(normalizeUrl("localhost:3000/"), "http://localhost:3000");
  assert.equal(normalizeUrl("https://example.com/shop/"), "https://example.com/shop");
  assert.equal(normalizeUrl("https://example.com/shop?x=1#y"), "https://example.com/shop");
  assert.throws(() => normalizeUrl("http://"), /not a valid URL/);
});

test("config: save, load, env override, clear (file is private)", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "rp-cli-"));
  process.env.REACTPRESS_CONFIG = path.join(dir, "nested", "config.json");
  delete process.env.REACTPRESS_URL;
  delete process.env.REACTPRESS_TOKEN;
  assert.deepEqual(await loadConfig(), { url: null, token: null, email: null });
  await saveConfig({ url: "http://x", token: "rp_abc", email: "a@b.co" });
  assert.equal((await loadConfig()).token, "rp_abc");
  process.env.REACTPRESS_TOKEN = "rp_env";
  assert.equal((await loadConfig()).token, "rp_env", "env wins");
  delete process.env.REACTPRESS_TOKEN;
  await clearConfig();
  assert.equal((await loadConfig()).token, null);
  delete process.env.REACTPRESS_CONFIG;
});

test("table aligns columns and truncates long cells", () => {
  const out = table(["ID", "TITLE"], [["1", "x".repeat(80)], ["22", "short"]]).split("\n");
  assert.equal(out.length, 4);
  assert.ok(out[2].length < 80 && out[2].endsWith("…"));
  assert.ok(out[3].startsWith("22  short"));
});

test("scaffold creates a plugin and a theme, and never overwrites", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "rp-scaffold-"));
  await mkdir(path.join(root, "plugins"));
  await mkdir(path.join(root, "themes"));
  const plugin = await scaffold("plugin", "my-plugin", { baseDir: path.join(root, "plugins") });
  assert.equal(JSON.parse(await readFile(path.join(plugin, "plugin.json"), "utf8")).slug, "my-plugin");
  const theme = await scaffold("theme", "my-theme", { baseDir: path.join(root, "themes") });
  assert.deepEqual(JSON.parse(await readFile(path.join(theme, "theme.json"), "utf8")).templates, ["index"]);
  await assert.rejects(() => scaffold("plugin", "my-plugin", { baseDir: path.join(root, "plugins") }), /already exists/);
  await assert.rejects(() => scaffold("plugin", "Bad Slug", { baseDir: path.join(root, "plugins") }), /kebab-case/);
  await assert.rejects(() => scaffold("plugin", "../evil", { baseDir: path.join(root, "plugins") }), /kebab-case/);
  await assert.rejects(() => scaffold("widget", "x", { baseDir: root }), /Usage/);
  await assert.rejects(() => scaffold("plugin", "x", { baseDir: path.join(root, "nope") }), /does not exist/);
});

test("main: help, unknown commands, and missing arguments", async () => {
  const log = console.log;
  const err = console.error;
  const out = [];
  console.log = (...a) => out.push(a.join(" "));
  console.error = (...a) => out.push(a.join(" "));
  try {
    assert.equal(await main([]), 1);
    assert.equal(await main(["--help"]), 0);
    assert.ok(out.join("\n").includes("reactpress login"));
    assert.equal(await main(["nope"]), 1);
    assert.equal(await main(["post", "wat"]), 1);
    assert.equal(await main(["post"]), 0);
    await assert.rejects(() => main(["post", "create"]), /Usage/);
    await assert.rejects(() => main(["post", "delete", "abc"]), /Usage|--yes/);
  } finally {
    console.log = log;
    console.error = err;
  }
});

test("api calls need a login", async () => {
  process.env.REACTPRESS_CONFIG = path.join(await mkdtemp(path.join(tmpdir(), "rp-cli-")), "none.json");
  delete process.env.REACTPRESS_URL;
  delete process.env.REACTPRESS_TOKEN;
  await assert.rejects(() => main(["post", "list"]), /Not logged in/);
  delete process.env.REACTPRESS_CONFIG;
});
