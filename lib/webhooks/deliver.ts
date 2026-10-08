import { createHmac, randomUUID } from "node:crypto";
import http from "node:http";
import https from "node:https";
import { parseWebhookUrl, safeLookup } from "./ssrf";

export const DELIVERY_TIMEOUT_MS = 5000;

export function sign(secret: string, body: string) {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

export type Delivery = { status: number } | { error: string };

/**
 * POST a JSON body. Signed with `X-ReactPress-Signature: sha256=<hmac of the exact body>`.
 * Redirects are not followed, the response body is discarded, and the whole call is time-boxed.
 * Never throws: failures come back as `{ error }`.
 */
export function deliver(url: string, secret: string, event: string, body: string): Promise<Delivery> {
  return new Promise((resolve) => {
    let target: URL;
    try {
      target = parseWebhookUrl(url);
    } catch (e) {
      return resolve({ error: (e as Error).message });
    }
    const lib = target.protocol === "https:" ? https : http;
    const req = lib.request(
      target,
      {
        method: "POST",
        lookup: safeLookup as never,
        timeout: DELIVERY_TIMEOUT_MS,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "ReactPress-Webhooks/1",
          "X-ReactPress-Event": event,
          "X-ReactPress-Delivery": randomUUID(),
          "X-ReactPress-Signature": sign(secret, body),
        },
      },
      (res) => {
        res.resume(); // drain and ignore
        res.on("end", () => resolve({ status: res.statusCode ?? 0 }));
        res.on("error", (e) => resolve({ error: e.message }));
      },
    );
    req.on("timeout", () => req.destroy(new Error(`Timed out after ${DELIVERY_TIMEOUT_MS / 1000}s`)));
    req.on("error", (e) => resolve({ error: e.message }));
    req.end(body);
  });
}

/** 2xx means delivered. Anything else is a failure worth retrying. */
export const succeeded = (d: Delivery) => "status" in d && d.status >= 200 && d.status < 300;

export const describe = (d: Delivery) => ("status" in d ? `HTTP ${d.status}` : d.error);
