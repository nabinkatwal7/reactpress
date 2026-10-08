import { randomBytes } from "node:crypto";
import { after } from "next/server";
import { doAction } from "@/lib/hooks";
import { ensurePluginsLoaded } from "@/lib/plugins/loader";
import { prisma } from "@/lib/prisma";
import { loadSettings, postPath } from "@/lib/settings";
import { deliver, describe, succeeded, type Delivery } from "./deliver";
import { CONTENT_EVENTS, PING, isContentEvent, type ContentEvent, type EventEntity } from "./events";
import { parseWebhookUrl } from "./ssrf";

export const WEBHOOK_JOB = "webhook";
export const MAX_WEBHOOKS_PER_SITE = 20;
/** Minutes to wait before each retry. A delivery is tried once plus once per entry here. */
export const RETRY_DELAYS_MIN = [1, 5, 30];

const newSecret = () => "whsec_" + randomBytes(24).toString("hex");

export type WebhookInput = { name?: string; url: string; events: string[] };

function cleanEvents(events: string[]) {
  const unique = [...new Set(events)];
  if (!unique.length) throw new Error("Pick at least one event");
  const bad = unique.find((e) => !isContentEvent(e));
  if (bad) throw new Error(`Unknown event "${bad}". Events: ${CONTENT_EVENTS.join(", ")}`);
  return unique;
}

const publicFields = { id: true, name: true, url: true, events: true, active: true, lastStatus: true, lastError: true, lastAt: true, createdAt: true } as const;

export function listWebhooks(siteId: string) {
  return prisma.webhook.findMany({ where: { siteId }, select: publicFields, orderBy: { createdAt: "asc" } });
}

/** Create a webhook. The signing secret is returned here once and is not listed afterwards. */
export async function createWebhook(siteId: string, input: WebhookInput) {
  const url = parseWebhookUrl(input.url).toString();
  const events = cleanEvents(input.events);
  if ((await prisma.webhook.count({ where: { siteId } })) >= MAX_WEBHOOKS_PER_SITE) {
    throw new Error(`A site can have at most ${MAX_WEBHOOKS_PER_SITE} webhooks`);
  }
  const secret = newSecret();
  const row = await prisma.webhook.create({
    data: { siteId, name: (input.name ?? "").trim().slice(0, 100), url, events, secret },
    select: publicFields,
  });
  return { ...row, secret };
}

export async function updateWebhook(
  siteId: string,
  id: string,
  patch: Partial<WebhookInput> & { active?: boolean },
) {
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name.trim().slice(0, 100);
  if (patch.url !== undefined) data.url = parseWebhookUrl(patch.url).toString();
  if (patch.events !== undefined) data.events = cleanEvents(patch.events);
  if (patch.active !== undefined) data.active = patch.active;
  const res = await prisma.webhook.updateMany({ where: { id, siteId }, data });
  if (res.count === 0) return null;
  return prisma.webhook.findFirst({ where: { id, siteId }, select: publicFields });
}

export async function deleteWebhook(siteId: string, id: string) {
  return (await prisma.webhook.deleteMany({ where: { id, siteId } })).count > 0;
}

/** Replace the signing secret. Returns the new one (shown once), or null if the webhook is not on this site. */
export async function rotateSecret(siteId: string, id: string) {
  const secret = newSecret();
  const res = await prisma.webhook.updateMany({ where: { id, siteId }, data: { secret } });
  return res.count ? secret : null;
}

// ---- delivery -----------------------------------------------------------------------------------

type Hook = { id: string; url: string; secret: string };

const retryable = (d: Delivery) => !("status" in d) || d.status >= 500 || d.status === 429 || d.status === 408;

/** One delivery attempt: send, record the outcome on the webhook, schedule a retry if it makes sense. */
async function attempt(hook: Hook, siteId: string, event: string, body: string, attemptNo: number): Promise<Delivery> {
  const result = await deliver(hook.url, hook.secret, event, body);
  const ok = succeeded(result);
  await prisma.webhook
    .updateMany({
      where: { id: hook.id },
      data: { lastStatus: "status" in result ? result.status : null, lastError: ok ? null : describe(result), lastAt: new Date() },
    })
    .catch(() => {});
  if (!ok && retryable(result) && attemptNo <= RETRY_DELAYS_MIN.length) {
    await prisma.job.create({
      data: {
        siteId,
        type: WEBHOOK_JOB,
        runAt: new Date(Date.now() + RETRY_DELAYS_MIN[attemptNo - 1] * 60_000),
        payload: { webhookId: hook.id, event, body, attempt: attemptNo + 1 },
      },
    });
  }
  return result;
}

/** Job handler for retries (called by the job runner). Never throws. */
export async function runWebhookJob(siteId: string, payload: { webhookId: string; event: string; body: string; attempt: number }) {
  const hook = await prisma.webhook.findFirst({ where: { id: payload.webhookId, siteId, active: true } });
  if (!hook) return; // deleted or switched off since: nothing to retry
  await attempt(hook, siteId, payload.event, payload.body, payload.attempt);
}

/** Send a `ping` right now and report what happened (the "send test" button). */
export async function testWebhook(siteId: string, id: string): Promise<Delivery | null> {
  const hook = await prisma.webhook.findFirst({ where: { id, siteId } });
  if (!hook) return null;
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { id: true, slug: true } });
  const body = JSON.stringify({ event: PING, delivered_at: new Date().toISOString(), site, data: { message: "Hello from ReactPress" } });
  return attempt({ ...hook }, siteId, PING, body, RETRY_DELAYS_MIN.length + 1); // a test is never retried
}

// ---- emitting -----------------------------------------------------------------------------------

/** Run after the response when we are inside a request, otherwise just in the background. */
function defer(work: () => Promise<unknown>) {
  const safe = () => work().catch((e) => console.error("[webhooks] delivery failed:", e));
  try {
    after(safe);
  } catch {
    void safe();
  }
}

/**
 * Announce a content change: fires the plugin action (`post_published`, `page_updated`, …) and
 * queues deliveries to the site's matching webhooks. Never throws and never makes the caller wait
 * on the network.
 */
export async function emitContentEvent(siteId: string, event: ContentEvent, entity: EventEntity) {
  try {
    await ensurePluginsLoaded(siteId);
    await doAction(siteId, event.replace(".", "_"), entity);

    const hooks = await prisma.webhook.findMany({ where: { siteId, active: true, events: { has: event } } });
    if (!hooks.length) return;

    const [site, settings] = await Promise.all([
      prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { id: true, slug: true } }),
      loadSettings(siteId),
    ]);
    const isPage = event.startsWith("page.");
    const link = isPage ? `/${entity.slug}` : postPath(settings, entity.slug);
    const body = JSON.stringify({ event, delivered_at: new Date().toISOString(), site, data: { ...entity, link } });
    defer(() => Promise.all(hooks.map((h) => attempt(h, siteId, event, body, 1))));
  } catch (e) {
    console.error("[webhooks] emit failed:", e);
  }
}

type Row = { id: string; slug: string; status: string; title: string; type?: string };

export const entityOf = (kind: "post" | "page", r: Row): EventEntity => ({
  id: r.id,
  type: kind === "page" ? "page" : (r.type ?? "post"),
  slug: r.slug,
  status: r.status,
  title: r.title,
});

/** Convenience for the content libs: `emitFor("post", "published", row)`. */
export function emitFor(siteId: string, kind: "post" | "page", what: "published" | "updated" | "deleted", row: Row) {
  return emitContentEvent(siteId, `${kind}.${what}` as ContentEvent, entityOf(kind, row));
}
