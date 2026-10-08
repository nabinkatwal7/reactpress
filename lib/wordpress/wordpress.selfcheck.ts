/** ponytail: run with `npx tsx lib/wordpress/wordpress.selfcheck.ts` (needs the dev database; writes and removes test media) */
import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { PrismaClient } from "@prisma/client";
import { absolutePath } from "@/lib/media";
import { createSite, deleteSite, getDefaultNetwork } from "@/lib/network/sites";
import { decodeEntities, htmlToBlocks, safeUrl } from "./html";
import { importWordPress } from "./import";
import { parseWxr } from "./wxr";

const prisma = new PrismaClient();
let failures = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) failures += 1;
  console.assert(ok, msg);
};
const fails = (fn: () => unknown, re?: RegExp) => Promise.resolve().then(fn).then(() => false, (e) => (re ? re.test((e as Error).message) : true));
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ---------------------------------------------------------------- HTML -> blocks
function htmlCases() {
  check(decodeEntities("Tom &amp; Jerry&#8217;s &#x1F600; &nbsp;&hellip; &bogus; &#0;") === "Tom & Jerry’s \u{1F600}  … &bogus; ", "entities");
  check(safeUrl("javascript:alert(1)") === null && safeUrl("data:text/html,x") === null && safeUrl("//evil.com/x") === null && safeUrl("https://a.com/x.png") === "https://a.com/x.png" && safeUrl("/media/a.png") === "/media/a.png", "only safe image urls");

  check(eq(htmlToBlocks("<p>Hello <strong>bold</strong> and <a href='x'>link</a>.</p>"), [{ type: "paragraph", text: "Hello bold and link." }]), "inline markup is flattened");
  check(eq(htmlToBlocks("<h1>A</h1><h2>B</h2><h3>C</h3><h5>D</h5>").map((b) => (b as { level: number }).level), [2, 2, 3, 4]), "heading levels fold into 2-4");
  check(eq(htmlToBlocks("<ul><li>one</li><li>two <em>x</em></li></ul><ol><li>a</li></ol>"), [{ type: "list", ordered: false, text: "one\ntwo x" }, { type: "list", ordered: true, text: "a" }]), "lists");
  check(eq(htmlToBlocks("<blockquote><p>Quoted</p></blockquote><hr/>"), [{ type: "quote", text: "Quoted" }, { type: "separator" }]), "quote and rule");
  check(eq(htmlToBlocks("<pre><code>a  b\n  c</code></pre>"), [{ type: "code", text: "a  b\n  c" }]), "code keeps whitespace");
  check(eq(htmlToBlocks('<figure class="wp-block-image"><img src="https://x.com/a.jpg" alt="Alt"/><figcaption>Cap</figcaption></figure>'), [{ type: "image", mediaId: null, url: "https://x.com/a.jpg", alt: "Alt", text: "Cap" }]), "figure with caption");
  check(eq(htmlToBlocks('<p><a href="/p"><img src="/wp-content/a.png" alt="x"></a></p>').map((b) => b.type), ["image"]), "linked image inside a paragraph");
  check(htmlToBlocks('<img src="javascript:alert(1)"><img src="data:image/png;base64,AA"><p>ok</p>').length === 1, "unsafe image sources are dropped");
  check(eq(htmlToBlocks("<p>Safe</p><script>alert('x')</script><style>p{}</style><iframe src='https://evil'></iframe><form><input></form>"), [{ type: "paragraph", text: "Safe" }]), "scripts, styles, iframes and forms vanish");
  check(eq(htmlToBlocks("Para one line one\nline two\n\nPara two with <b>bold</b> text\n\n<p>Then a tag</p>"), [{ type: "paragraph", text: "Para one line one line two" }, { type: "paragraph", text: "Para two with bold text" }, { type: "paragraph", text: "Then a tag" }]), "classic editor text: blank lines split paragraphs, inline runs stay together");
  check(eq(htmlToBlocks("<!-- wp:paragraph --><p>G</p><!-- /wp:paragraph --><!-- wp:more --><!--more-->"), [{ type: "paragraph", text: "G" }]), "block comments are ignored");
  check(eq(htmlToBlocks('[caption id="a"]<img src="https://x.com/c.jpg"> Caption text[/caption]').map((b) => b.type), ["image", "paragraph"]), "caption shortcode tags removed, caption text kept");
  check(eq(htmlToBlocks("<p>One<p>Two<ul><li>a<li>b</ul>"), [{ type: "paragraph", text: "One" }, { type: "paragraph", text: "Two" }, { type: "list", ordered: false, text: "a\nb" }]), "unclosed p and li tags");
  check(eq(htmlToBlocks("<table><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></table>"), [{ type: "paragraph", text: "a | b\nc | d" }]), "tables become text");
  check(eq(htmlToBlocks("<div><div><p>Deep</p></div></div>"), [{ type: "paragraph", text: "Deep" }]), "wrappers are transparent");
  check(htmlToBlocks("<p>" + "x".repeat(200_000) + "</p>").length === 1 && htmlToBlocks("<<<>>><p<p>><b").length >= 0, "huge and broken input does not hang or throw");
  check(eq(htmlToBlocks("<p>Mapped</p><img src='http://old/a-300x200.jpg'>", { mapImage: (u) => u.replace("http://old", "/media") }).at(-1), { type: "image", mediaId: null, url: "/media/a-300x200.jpg", alt: "", text: "" }), "mapImage hook");
}

// ---------------------------------------------------------------- a WordPress export
const wxr = (host: string) => `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:wp="http://wordpress.org/export/1.2/">
<channel>
  <title>My WP Blog</title>
  <wp:wxr_version>1.2</wp:wxr_version>
  <wp:author><wp:author_login><![CDATA[wpadmin]]></wp:author_login><wp:author_email><![CDATA[sc-wp-author@example.com]]></wp:author_email><wp:author_display_name><![CDATA[WP Admin]]></wp:author_display_name></wp:author>
  <wp:author><wp:author_login><![CDATA[stranger]]></wp:author_login><wp:author_email><![CDATA[stranger@nowhere.test]]></wp:author_email></wp:author>
  <wp:category><wp:term_id>2</wp:term_id><wp:category_nicename><![CDATA[news]]></wp:category_nicename><wp:category_parent><![CDATA[]]></wp:category_parent><wp:cat_name><![CDATA[News]]></wp:cat_name></wp:category>
  <wp:category><wp:term_id>3</wp:term_id><wp:category_nicename><![CDATA[tech]]></wp:category_nicename><wp:category_parent><![CDATA[news]]></wp:category_parent><wp:cat_name><![CDATA[Tech &amp; Gadgets]]></wp:cat_name></wp:category>
  <wp:tag><wp:term_id>4</wp:term_id><wp:tag_slug><![CDATA[featured]]></wp:tag_slug><wp:tag_name><![CDATA[Featured]]></wp:tag_name></wp:tag>

  <item><title>hero</title><wp:post_id>10</wp:post_id><wp:post_date_gmt>2024-01-02 03:04:05</wp:post_date_gmt><wp:post_type><![CDATA[attachment]]></wp:post_type><wp:status><![CDATA[inherit]]></wp:status><wp:attachment_url><![CDATA[${host}/wp-content/uploads/2024/01/hero.jpg]]></wp:attachment_url><wp:postmeta><wp:meta_key><![CDATA[_wp_attachment_image_alt]]></wp:meta_key><wp:meta_value><![CDATA[A hero]]></wp:meta_value></wp:postmeta></item>
  <item><title>logo</title><wp:post_id>11</wp:post_id><wp:post_type><![CDATA[attachment]]></wp:post_type><wp:status><![CDATA[inherit]]></wp:status><wp:attachment_url><![CDATA[${host}/wp-content/uploads/logo.svg]]></wp:attachment_url></item>
  <item><title>missing</title><wp:post_id>12</wp:post_id><wp:post_type><![CDATA[attachment]]></wp:post_type><wp:status><![CDATA[inherit]]></wp:status><wp:attachment_url><![CDATA[${host}/wp-content/uploads/gone.jpg]]></wp:attachment_url></item>

  <item>
    <title>Hello &amp; welcome</title><dc:creator><![CDATA[wpadmin]]></dc:creator>
    <content:encoded><![CDATA[<!-- wp:paragraph --><p>Intro with <strong>bold</strong> &#8217;quote&#8217;.</p><!-- /wp:paragraph -->
<!-- wp:heading --><h2>Section</h2><!-- /wp:heading -->
<!-- wp:image --><figure class="wp-block-image"><img src="${host}/wp-content/uploads/2024/01/hero-300x200.jpg" alt="Hero"/><figcaption>Caption</figcaption></figure><!-- /wp:image -->
<!-- wp:list --><ul><li>one</li><li>two</li></ul><!-- /wp:list -->
<script>alert(1)</script><img src="javascript:alert(2)">]]></content:encoded>
    <wp:post_id>100</wp:post_id><wp:post_date_gmt>2024-03-05 10:00:00</wp:post_date_gmt><wp:post_name><![CDATA[hello-welcome]]></wp:post_name><wp:status><![CDATA[publish]]></wp:status><wp:post_parent>0</wp:post_parent><wp:post_type><![CDATA[post]]></wp:post_type>
    <category domain="category" nicename="tech"><![CDATA[Tech &amp; Gadgets]]></category><category domain="category" nicename="news"><![CDATA[News]]></category><category domain="post_tag" nicename="featured"><![CDATA[Featured]]></category><category domain="post_tag" nicename="brand-new"><![CDATA[Brand new]]></category><category domain="product_cat" nicename="shoes"><![CDATA[Shoes]]></category>
    <wp:postmeta><wp:meta_key><![CDATA[_thumbnail_id]]></wp:meta_key><wp:meta_value><![CDATA[10]]></wp:meta_value></wp:postmeta>
    <wp:comment><wp:comment_id>1</wp:comment_id></wp:comment><wp:comment><wp:comment_id>2</wp:comment_id></wp:comment>
  </item>
  <item><title>Classic draft</title><dc:creator><![CDATA[stranger]]></dc:creator><content:encoded><![CDATA[First para with <em>emphasis</em>.

Second para.]]></content:encoded><wp:post_id>101</wp:post_id><wp:post_date_gmt>0000-00-00 00:00:00</wp:post_date_gmt><wp:post_date>2024-04-01 08:00:00</wp:post_date><wp:post_name></wp:post_name><wp:status><![CDATA[draft]]></wp:status><wp:post_type><![CDATA[post]]></wp:post_type></item>
  <item><title>Coming soon</title><content:encoded><![CDATA[<p>Future</p>]]></content:encoded><wp:post_id>102</wp:post_id><wp:post_date_gmt>2099-01-01 00:00:00</wp:post_date_gmt><wp:post_name><![CDATA[coming-soon]]></wp:post_name><wp:status><![CDATA[future]]></wp:status><wp:post_type><![CDATA[post]]></wp:post_type></item>
  <item><title>Old news</title><content:encoded><![CDATA[<p>Old</p>]]></content:encoded><wp:post_id>103</wp:post_id><wp:post_date_gmt>2020-01-01 00:00:00</wp:post_date_gmt><wp:post_name><![CDATA[old-news]]></wp:post_name><wp:status><![CDATA[trash]]></wp:status><wp:post_type><![CDATA[post]]></wp:post_type></item>
  <item><title>Secret</title><content:encoded><![CDATA[<p>Private stuff</p>]]></content:encoded><wp:post_id>104</wp:post_id><wp:post_date_gmt>2021-01-01 00:00:00</wp:post_date_gmt><wp:post_name><![CDATA[secret]]></wp:post_name><wp:status><![CDATA[private]]></wp:status><wp:post_type><![CDATA[post]]></wp:post_type></item>
  <item><title>Caf&#233; menu</title><content:encoded><![CDATA[<p>Coffee</p>]]></content:encoded><wp:post_id>105</wp:post_id><wp:post_date_gmt>2022-02-02 00:00:00</wp:post_date_gmt><wp:post_name><![CDATA[caf%c3%a9-menu]]></wp:post_name><wp:status><![CDATA[publish]]></wp:status><wp:post_type><![CDATA[post]]></wp:post_type></item>
  <item><title>日本語</title><content:encoded><![CDATA[<p>Japanese</p>]]></content:encoded><wp:post_id>106</wp:post_id><wp:post_date_gmt>2022-02-03 00:00:00</wp:post_date_gmt><wp:post_name><![CDATA[%e6%97%a5%e6%9c%ac%e8%aa%9e]]></wp:post_name><wp:status><![CDATA[publish]]></wp:status><wp:post_type><![CDATA[post]]></wp:post_type></item>
  <item><title>Autosave</title><wp:post_id>107</wp:post_id><wp:status><![CDATA[auto-draft]]></wp:status><wp:post_type><![CDATA[post]]></wp:post_type></item>
  <item><title>About</title><content:encoded><![CDATA[<p>About page</p>]]></content:encoded><wp:post_id>200</wp:post_id><wp:post_date_gmt>2023-01-01 00:00:00</wp:post_date_gmt><wp:post_name><![CDATA[about]]></wp:post_name><wp:status><![CDATA[publish]]></wp:status><wp:post_parent>0</wp:post_parent><wp:post_type><![CDATA[page]]></wp:post_type></item>
  <item><title>Team</title><content:encoded><![CDATA[<p>Team page</p>]]></content:encoded><wp:post_id>201</wp:post_id><wp:post_date_gmt>2023-01-02 00:00:00</wp:post_date_gmt><wp:post_name><![CDATA[team]]></wp:post_name><wp:status><![CDATA[publish]]></wp:status><wp:post_parent>200</wp:post_parent><wp:post_type><![CDATA[page]]></wp:post_type></item>
  <item><title>Sneakers</title><wp:post_id>300</wp:post_id><wp:status><![CDATA[publish]]></wp:status><wp:post_type><![CDATA[product]]></wp:post_type></item>
  <item><title>Home</title><wp:post_id>301</wp:post_id><wp:status><![CDATA[publish]]></wp:status><wp:post_type><![CDATA[nav_menu_item]]></wp:post_type></item>
</channel></rss>`;

async function main() {
  htmlCases();

  // ---- parser
  const doc = parseWxr(wxr("http://example.com"));
  check(doc.title === "My WP Blog" && doc.items.length === 15 && doc.categories.length === 2 && doc.tags.length === 1 && doc.authors.length === 2, "parsed structure");
  check(doc.categories[1].parent === "news" && doc.categories[1].name === "Tech & Gadgets", "category parent and entity-decoded name");
  const hello = doc.items.find((i) => i.id === "100")!;
  check(hello.title === "Hello & welcome" && hello.terms.length === 5 && hello.meta._thumbnail_id === "10" && hello.commentCount === 2, "item fields");
  check(doc.items.find((i) => i.id === "101")!.date === "2024-04-01 08:00:00", "falls back to the local date when the GMT date is zeroed");
  check(await fails(() => parseWxr('<?xml version="1.0"?><!DOCTYPE r [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;&a;">]><rss><channel><title>&b;</title></channel></rss>'), /DOCTYPE|entity/i), "DTD / entity declarations are refused");
  check(await fails(() => parseWxr("<rss><channel><title>x</title><item></channel></rss>")), "malformed XML is refused");
  check(await fails(() => parseWxr("<html><body>hi</body></html>"), /WordPress/), "other XML is refused");
  check(await fails(() => parseWxr("not xml at all")), "text is refused");
  check(parseWxr('<rss><channel><title>Empty</title></channel></rss>').items.length === 0, "an export with no items is fine");
  check(parseWxr("<rss><channel><title>Bad \u0001char\u000b</title></channel></rss>").title === "Bad char", "control characters XML forbids are dropped, not fatal");

  // ---- a server standing in for the old WordPress site
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
  const fetched: string[] = [];
  const server = createServer((req, res) => {
    fetched.push(req.url ?? "");
    if (req.url === "/wp-content/uploads/2024/01/hero.jpg") return void res.end(jpg);
    if (req.url === "/wp-content/uploads/logo.svg") return void res.end("<svg/>");
    res.writeHead(404).end();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const host = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const net = await getDefaultNetwork();
  await prisma.site.deleteMany({ where: { slug: { startsWith: "sc-" } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "sc-" } } });
  const importer = await prisma.user.findUniqueOrThrow({ where: { email: "admin@reactpress.local" } });
  const wpAuthor = await prisma.user.create({ data: { email: "sc-wp-author@example.com", name: "WP Author" } });
  const A = await createSite(net.id, { name: "WP target", slug: "sc-wp-a" });
  const B = await createSite(net.id, { name: "WP target 2", slug: "sc-wp-b" });
  const created: string[] = [];

  try {
    // ---- without downloading media
    const r1 = await importWordPress(A.id, wxr(host), { importerId: importer.id });
    check(fetched.length === 0, "nothing is fetched unless asked");
    check(r1.counts.posts === 7 && r1.counts.pages === 2 && (r1.counts.media ?? 0) === 0, `posts and pages imported (${JSON.stringify(r1.counts)})`);
    check(r1.warnings.some((w) => /3 attachments were not downloaded/.test(w)) && r1.warnings.some((w) => /2 comments were not imported/.test(w)) && r1.warnings.some((w) => /"product"/.test(w)), `warnings: ${r1.warnings.join(" | ")}`);
    check(r1.skipped["taxonomy \"product_cat\""] === 1 && r1.skipped.product === 1 && r1.skipped.nav_menu_item === 1 && r1.skipped["post (auto-draft)"] === 1, `skipped: ${JSON.stringify(r1.skipped)}`);

    const posts = await prisma.post.findMany({ where: { siteId: A.id }, include: { terms: { include: { term: true } }, author: true }, orderBy: { slug: "asc" } });
    const bySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));
    check(Object.keys(bySlug).sort().join() === "caf-menu,classic-draft,coming-soon,hello-welcome,old-news,post-106,secret", `slugs: ${Object.keys(bySlug)}`);
    const h = bySlug["hello-welcome"];
    check(h.title === "Hello & welcome" && h.status === "publish" && h.publishedAt?.toISOString() === "2024-03-05T10:00:00.000Z", "published post keeps title, status and date");
    check(h.author?.email === "sc-wp-author@example.com", "author matched through the WXR author list");
    check(bySlug["classic-draft"].author?.email === "admin@reactpress.local" && bySlug["classic-draft"].status === "draft", "unknown author falls back to the importer");
    check(bySlug["classic-draft"].createdAt.toISOString() === "2024-04-01T08:00:00.000Z", "local date used when GMT is missing");
    check(bySlug["coming-soon"].status === "scheduled" && (await prisma.job.count({ where: { siteId: A.id, type: "publish", status: "pending" } })) === 1, "future post is scheduled with a job");
    check(bySlug["old-news"].status === "trash" && bySlug.secret.status === "private" && bySlug.secret.publishedAt !== null, "trash and private map across");
    check(h.terms.map((t) => `${t.term.taxonomy}/${t.term.slug}`).sort().join() === "category/news,category/tech,tag/brand-new,tag/featured", "categories and tags attached (unknown taxonomies skipped)");
    const types = (h.content as { type: string }[]).map((b) => b.type);
    check(types.join() === "paragraph,heading,image,list", `blocks from Gutenberg HTML: ${types}`);
    check(JSON.stringify(h.content).includes("Intro with bold ’quote’.") && !JSON.stringify(h.content).includes("alert") && !JSON.stringify(h.content).includes("javascript:"), "text decoded, scripts and javascript: gone");
    check(JSON.stringify(h.content).includes(`${host}/wp-content/uploads/2024/01/hero-300x200.jpg`), "without download, images keep their original URL");
    check(h.featuredMediaId === null, "no featured image without downloaded media");
    const cats = await prisma.term.findMany({ where: { siteId: A.id, taxonomy: "category" }, orderBy: { slug: "asc" } });
    check(cats.map((c) => c.slug).join() === "news,tech" && cats[1].parentId === cats[0].id && cats[1].name === "Tech & Gadgets", "category hierarchy");
    const pages = await prisma.page.findMany({ where: { siteId: A.id } });
    check(pages.find((p) => p.slug === "team")!.parentId === pages.find((p) => p.slug === "about")!.id, "page hierarchy");
    check(await fails(() => importWordPress(A.id, "<rss/>", { importerId: importer.id })), "bad file changes nothing");
    check((await prisma.post.count({ where: { siteId: A.id } })) === 7, "...nothing changed");

    // importing the same file again adds -2 copies instead of failing
    const again = await importWordPress(A.id, wxr(host), { importerId: importer.id });
    check(again.counts.posts === 7 && (await prisma.post.count({ where: { siteId: A.id, slug: "hello-welcome-2" } })) === 1, "a second import adds suffixed copies");
    check((await prisma.term.count({ where: { siteId: A.id, taxonomy: "category" } })) === 2, "...and reuses the categories");

    // ---- media downloads are refused for private addresses by default
    delete process.env.REACTPRESS_ALLOW_PRIVATE_FETCH;
    const blocked = await importWordPress(B.id, wxr(host), { importerId: importer.id, downloadMedia: true });
    check(fetched.length === 0 && (blocked.counts.media ?? 0) === 0 && blocked.warnings.some((w) => /Media not imported/.test(w)), `private media hosts are refused by default (${blocked.warnings.filter((w) => /Media/.test(w)).join(" | ")})`);
    await prisma.post.deleteMany({ where: { siteId: B.id } });
    await prisma.page.deleteMany({ where: { siteId: B.id } });

    // ---- with downloads
    process.env.REACTPRESS_ALLOW_PRIVATE_FETCH = "1";
    const r2 = await importWordPress(B.id, wxr(host), { importerId: importer.id, downloadMedia: true });
    for (const m of await prisma.media.findMany({ where: { siteId: B.id } })) created.push(m.path);
    check(r2.counts.media === 1, `one allowed attachment downloaded (${JSON.stringify(r2.counts)})`);
    check(fetched.includes("/wp-content/uploads/2024/01/hero.jpg") && !fetched.includes("/wp-content/uploads/logo.svg"), "svg is never downloaded");
    check(r2.warnings.some((w) => /logo\.svg: file type not allowed/.test(w)) && r2.warnings.some((w) => /gone\.jpg: HTTP 404/.test(w)), `failures explained: ${r2.warnings.join(" | ")}`);
    const media = await prisma.media.findFirstOrThrow({ where: { siteId: B.id } });
    check(media.filename === "hero.jpg" && media.altText === "A hero" && media.mimeType === "image/jpeg" && existsSync(absolutePath(media.path)), "media row, alt text and file");
    const hb = await prisma.post.findFirstOrThrow({ where: { siteId: B.id, slug: "hello-welcome" } });
    check(hb.featuredMediaId === media.id, "featured image from _thumbnail_id");
    check(JSON.stringify(hb.content).includes(`/media/${media.path}`) && !JSON.stringify(hb.content).includes("hero-300x200"), "the resized image in the post now points at the local copy");
  } finally {
    server.close();
    delete process.env.REACTPRESS_ALLOW_PRIVATE_FETCH;
    await prisma.user.deleteMany({ where: { email: { startsWith: "sc-" } } });
    await deleteSite(A.id);
    await deleteSite(B.id);
    await Promise.all(created.map((p) => unlink(absolutePath(p)).catch(() => {})));
  }
  void wpAuthor;
  if (failures) throw new Error(`${failures} WordPress import check(s) failed`);
  console.log("wordpress import self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
