import { PageHeader } from "@/components/admin/page-header";
import { requireSiteId } from "@/lib/site";
import { CONTENT_EVENTS } from "@/lib/webhooks/events";
import { listWebhooks } from "@/lib/webhooks/webhooks";
import { WebhooksManager } from "./webhooks-manager";

export const instant = false;

export default async function WebhooksPage() {
  const hooks = await listWebhooks(await requireSiteId());
  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader title="Webhooks" />
      <p className="max-w-2xl text-sm text-neutral-600">
        ReactPress sends a signed JSON POST to your URL when content is published, updated or deleted. Each request carries
        <code className="mx-1 rounded bg-neutral-100 px-1">X-ReactPress-Signature: sha256=&lt;HMAC of the body&gt;</code>
        made with the webhook&apos;s secret. Failed deliveries are retried after 1, 5 and 30 minutes.
      </p>
      <WebhooksManager
        events={[...CONTENT_EVENTS]}
        hooks={hooks.map((h) => ({ ...h, lastAt: h.lastAt?.toISOString() ?? null, createdAt: h.createdAt.toISOString() }))}
      />
    </main>
  );
}
