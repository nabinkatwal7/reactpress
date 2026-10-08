/** ponytail: run with `npx tsx lib/webhooks/webhooks.selfcheck.ts` (needs the dev database) */
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { PrismaClient } from "@prisma/client";
import { bulkUpdate } from "@/lib/content-list";
import { runDueJobs } from "@/lib/jobs";
import { createSite, deleteSite, getDefaultNetwork } from "@/lib/network/sites";
import { createPage } from "@/lib/pages";
import { createPost, deletePost, updatePost } from "@/lib/posts";
import { sign } from "./deliver";
import { isPrivateAddress, parseWebhookUrl } from "./ssrf";
import { createWebhook, deleteWebhook, listWebhooks, rotateSecret, testWebhook, updateWebhook } from "./webhooks";

const prisma = new PrismaClient();
let failures = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) failures += 1;
  console.assert(ok, msg);
};
const fails = (fn: () => Promise<unknown> | unknown) => Promise.resolve().then(fn).then(() => false, () => true);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Hit = { event: string; signature: string; body: string; json: { event: string; site: { id: string }; data: { id: string; slug: string; title: string; link: string } } };

async function main() {
  // ---- SSRF guard (default policy: no private targets)
  delete process.env.REACTPRESS_WEBHOOKS_ALLOW_PRIVATE;
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "224.0.0.1", "::1", "::", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "not-an-ip"]) {
    check(isPrivateAddress(ip), `private: ${ip}`);
  }
  for (const ip of ["8.8.8.8", "93.184.216.34", "172.32.0.1", "2606:4700:4700::1111"]) check(!isPrivateAddress(ip), `public: ${ip}`);
  for (const url of ["http://localhost/h", "http://127.0.0.1:3000/h", "http://[::1]/h", "http://169.254.169.254/latest", "http://app.internal/h", "ftp://example.com/h", "javascript:alert(1)", "https://user:pw@example.com/h", "not a url", "http://10.0.0.5/h"]) {
    check(await fails(() => parseWebhookUrl(url)), `rejected: ${url}`);
  }
  check(parseWebhookUrl("https://example.com/hook?x=1").hostname === "example.com", "public https url accepted");

  // ---- a local receiver stands in for the outside world
  const hits: Hit[] = [];
  let respond = 200;
  const server = createServer((req: IncomingMessage, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      hits.push({ event: String(req.headers["x-reactpress-event"]), signature: String(req.headers["x-reactpress-signature"]), body, json: JSON.parse(body) });
      res.statusCode = respond;
      res.end("ok");
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const target = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;
  const waitFor = async (n: number) => {
    for (let i = 0; i < 100 && hits.length < n; i++) await sleep(50);
    return hits.length >= n;
  };

  const net = await getDefaultNetwork();
  await prisma.site.deleteMany({ where: { slug: { startsWith: "sc-" } } });
  const site = await createSite(net.id, { name: "Hooks", slug: "sc-hooks" });
  const other = await createSite(net.id, { name: "Other", slug: "sc-hooks-other" });
  const author = await prisma.user.findUniqueOrThrow({ where: { email: "admin@reactpress.local" } });

  try {
    // blocked by default, even though it is a valid URL
    check(await fails(() => createWebhook(site.id, { url: target, events: ["post.published"] })), "private target refused when saving");
    process.env.REACTPRESS_WEBHOOKS_ALLOW_PRIVATE = "1";

    check(await fails(() => createWebhook(site.id, { url: target, events: [] })), "needs an event");
    check(await fails(() => createWebhook(site.id, { url: target, events: ["post.exploded"] })), "unknown event refused");

    const hook = await createWebhook(site.id, { name: "main", url: target, events: ["post.published", "post.updated", "post.deleted"] });
    check(hook.secret.startsWith("whsec_") && hook.secret.length > 30, "secret generated");
    check(!JSON.stringify(await listWebhooks(site.id)).includes(hook.secret), "secret is not listed");
    const pagesOnly = await createWebhook(site.id, { url: target, events: ["page.published"] });
    const off = await createWebhook(site.id, { url: target, events: ["post.published"] });
    await updateWebhook(site.id, off.id, { active: false });

    // ---- publish -> published (+ no 'updated' on create)
    const post = await createPost(site.id, author.id, { title: "Hello hooks", status: "publish", content: [] });
    check(await waitFor(1), "post.published delivered");
    const h = hits[0];
    check(h.event === "post.published" && h.json.event === "post.published", "event name in header and body");
    check(h.signature === sign(hook.secret, h.body), "signature is HMAC-SHA256 of the exact body");
    check(h.signature !== sign("wrong", h.body), "signature depends on the secret");
    check(h.json.data.id === post.id && h.json.data.slug === "hello-hooks" && h.json.data.link === "/posts/hello-hooks", "payload describes the post");
    check(h.json.site.id === site.id, "payload names the site");
    await sleep(300);
    check(hits.length === 1, "inactive and non-matching webhooks got nothing");

    // ---- update -> updated; draft -> publish -> updated + published
    await updatePost(site.id, post.id, { title: "Hello again" });
    check(await waitFor(2) && hits[1].event === "post.updated", "post.updated delivered");
    const draft = await createPost(site.id, author.id, { title: "Draft", status: "draft" });
    await sleep(200);
    check(hits.length === 2, "creating a draft sends nothing");
    await updatePost(site.id, draft.id, { status: "publish" });
    check(await waitFor(4), "update + published delivered");
    check(hits.slice(2).map((x) => x.event).sort().join() === "post.published,post.updated", "moving to publish sends updated and published");

    // ---- delete
    await deletePost(site.id, post.id);
    check(await waitFor(5) && hits[4].event === "post.deleted" && hits[4].json.data.id === post.id, "post.deleted delivered");

    // ---- bulk publish and scheduled publish
    const b1 = await createPost(site.id, author.id, { title: "Bulk one", status: "draft" });
    await bulkUpdate(site.id, "post", [b1.id], "publish");
    check(await waitFor(7), "bulk publish delivers updated + published");
    const sched = await createPost(site.id, author.id, { title: "Scheduled", status: "scheduled", scheduledAt: new Date(Date.now() + 3_600_000).toISOString() });
    await prisma.job.updateMany({ where: { siteId: site.id, type: "publish", status: "pending" }, data: { runAt: new Date(Date.now() - 1000) } });
    await prisma.post.update({ where: { id: sched.id }, data: { scheduledAt: new Date(Date.now() - 1000) } });
    const before = hits.length;
    await runDueJobs();
    check(await waitFor(before + 1) && hits.slice(before).some((x) => x.event === "post.published" && x.json.data.id === sched.id), "scheduled publish delivers post.published");

    // ---- pages use their own events
    const n = hits.length;
    await createPage(site.id, author.id, { title: "About hooks", status: "publish", content: [] });
    await waitFor(n + 1);
    check(hits[n].event === "page.published" && hits[n].json.data.link === "/about-hooks", "page.published delivered with a page link");
    await sleep(200);
    check(hits.length === n + 1, "post-only webhooks ignore pages");

    // ---- other sites are separate
    const m = hits.length;
    await createPost(other.id, author.id, { title: "Elsewhere", status: "publish" });
    await sleep(300);
    check(hits.length === m, "events of another site are not delivered");

    // ---- failures: 500 is retried through the job queue and recovers; 404 is not retried
    respond = 500;
    const k = hits.length;
    await createPost(site.id, author.id, { title: "Flaky", status: "publish" });
    await waitFor(k + 1);
    await sleep(200);
    let row = (await listWebhooks(site.id)).find((w) => w.id === hook.id)!;
    check(row.lastStatus === 500 && !!row.lastError, "failure recorded on the webhook");
    const retry = await prisma.job.findFirst({ where: { siteId: site.id, type: "webhook", status: "pending" } });
    check(!!retry && retry.runAt.getTime() > Date.now() + 30_000, "retry scheduled about a minute out");
    respond = 200;
    await prisma.job.update({ where: { id: retry!.id }, data: { runAt: new Date(Date.now() - 1000) } });
    await runDueJobs();
    await waitFor(k + 2);
    row = (await listWebhooks(site.id)).find((w) => w.id === hook.id)!;
    check(hits.length === k + 2 && row.lastStatus === 200 && row.lastError === null, "retry delivered and cleared the error");
    check(hits[k].body === hits[k + 1].body, "retry sends the identical body");

    respond = 404;
    const j = hits.length;
    await createPost(site.id, author.id, { title: "Gone", status: "publish" });
    await waitFor(j + 1);
    await sleep(200);
    check((await prisma.job.count({ where: { siteId: site.id, type: "webhook", status: "pending" } })) === 0, "a 404 is not retried");
    respond = 200;

    // ---- test button, secret rotation, deletion
    const t = await testWebhook(site.id, hook.id);
    check(!!t && "status" in t && t.status === 200 && hits.at(-1)!.event === "ping", "test sends a ping");
    check((await testWebhook(other.id, hook.id)) === null, "cannot test another site's webhook");
    const newSecret = await rotateSecret(site.id, hook.id);
    check(!!newSecret && newSecret !== hook.secret, "secret rotated");
    await testWebhook(site.id, hook.id);
    const last = hits.at(-1)!;
    check(last.signature === sign(newSecret!, last.body) && last.signature !== sign(hook.secret, last.body), "new secret signs from now on");
    check((await rotateSecret(other.id, hook.id)) === null && (await updateWebhook(other.id, hook.id, { active: false })) === null && !(await deleteWebhook(other.id, hook.id)), "other sites cannot touch it");

    // a webhook whose host starts resolving privately is refused at delivery time too
    delete process.env.REACTPRESS_WEBHOOKS_ALLOW_PRIVATE;
    const blocked = await testWebhook(site.id, hook.id);
    check(!!blocked && "error" in blocked, "delivery to a private address is refused");
    process.env.REACTPRESS_WEBHOOKS_ALLOW_PRIVATE = "1";

    check(await deleteWebhook(site.id, hook.id) && !(await deleteWebhook(site.id, hook.id)), "delete, then no-op");
    await deleteWebhook(site.id, pagesOnly.id);

    // ---- per-site cap
    for (let i = 0; i < 20; i++) await createWebhook(site.id, { url: target, events: ["post.updated"] }).catch(() => {});
    check(await fails(() => createWebhook(site.id, { url: target, events: ["post.updated"] })), "limit of 20 webhooks per site");
  } finally {
    server.close();
    delete process.env.REACTPRESS_WEBHOOKS_ALLOW_PRIVATE;
    await deleteSite(site.id);
    await deleteSite(other.id);
  }
  if (failures) throw new Error(`${failures} webhook check(s) failed`);
  console.log("webhooks self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
