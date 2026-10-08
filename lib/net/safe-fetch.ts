import http from "node:http";
import https from "node:https";
import { parseWebhookUrl, safeLookup } from "@/lib/webhooks/ssrf";

export type Fetched = { status: number; body: Buffer; contentType: string; finalUrl: string };

export type SafeFetchOptions = {
  /** Abort (and fail) once the body grows past this. */
  maxBytes: number;
  timeoutMs?: number;
  maxRedirects?: number;
  accept?: string;
};

/**
 * GET a URL an admin typed in, without letting it reach our own network: every hop (including
 * redirects) is checked with the webhook SSRF rules, the connection is pinned to the checked
 * address, and size and time are capped. Throws on anything but a 2xx answer.
 */
export function safeFetch(rawUrl: string, opts: SafeFetchOptions): Promise<Fetched> {
  const timeoutMs = opts.timeoutMs ?? 8000;
  const maxRedirects = opts.maxRedirects ?? 3;

  const hop = (urlString: string, redirectsLeft: number): Promise<Fetched> =>
    new Promise((resolve, reject) => {
      let url: URL;
      try {
        url = parseWebhookUrl(urlString);
      } catch (e) {
        return reject(e);
      }
      const lib = url.protocol === "https:" ? https : http;
      const req = lib.request(
        url,
        {
          method: "GET",
          lookup: safeLookup as never,
          timeout: timeoutMs,
          headers: { "User-Agent": "ReactPress/1", Accept: opts.accept ?? "*/*", "Accept-Encoding": "identity" },
        },
        (res) => {
          const status = res.statusCode ?? 0;
          if (status >= 300 && status < 400 && res.headers.location) {
            res.resume();
            if (redirectsLeft <= 0) return reject(new Error("Too many redirects"));
            return resolve(hop(new URL(res.headers.location, url).toString(), redirectsLeft - 1));
          }
          if (status < 200 || status >= 300) {
            res.resume();
            return reject(new Error(`HTTP ${status}`));
          }
          const declared = Number(res.headers["content-length"]);
          if (declared > opts.maxBytes) {
            res.resume();
            return reject(new Error(`Too large (limit ${Math.round(opts.maxBytes / 1024)} KB)`));
          }
          const chunks: Buffer[] = [];
          let size = 0;
          res.on("data", (c: Buffer) => {
            size += c.length;
            if (size > opts.maxBytes) return req.destroy(new Error(`Too large (limit ${Math.round(opts.maxBytes / 1024)} KB)`));
            chunks.push(c);
          });
          res.on("end", () => resolve({ status, body: Buffer.concat(chunks), contentType: String(res.headers["content-type"] ?? ""), finalUrl: url.toString() }));
          res.on("error", reject);
        },
      );
      req.on("timeout", () => req.destroy(new Error(`Timed out after ${timeoutMs / 1000}s`)));
      req.on("error", reject);
      req.end();
    });

  return hop(rawUrl, maxRedirects);
}
