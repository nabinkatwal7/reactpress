/**
 * Webhook events. Content kinds are `post` and `page`; each has:
 *  - published: the item became public (created as published, moved to published, or its schedule fired)
 *  - updated:   the item was saved (any status), or moved to draft/trash
 *  - deleted:   the item was permanently deleted
 * `ping` is only sent by the "send test" button.
 */
export const CONTENT_EVENTS = [
  "post.published",
  "post.updated",
  "post.deleted",
  "page.published",
  "page.updated",
  "page.deleted",
] as const;

export type ContentEvent = (typeof CONTENT_EVENTS)[number];
export const PING = "ping";

export const isContentEvent = (e: string): e is ContentEvent => (CONTENT_EVENTS as readonly string[]).includes(e);

export type EventEntity = {
  id: string;
  /** Post type ("post" or a custom type); pages are always "page". */
  type: string;
  slug: string;
  status: string;
  title: string;
};
