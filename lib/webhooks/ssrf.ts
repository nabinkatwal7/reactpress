import { lookup as dnsLookup } from "node:dns";
import { isIP } from "node:net";

/**
 * Webhook targets are chosen by site admins, so a URL must not be able to reach the server's own
 * network (localhost, private ranges, cloud metadata). Checked when the webhook is saved AND on
 * every connection: delivery connects through `safeLookup`, so the address that was checked is
 * the address that is used (no DNS-rebinding gap).
 *
 * Self-hosters who really want internal targets can set REACTPRESS_WEBHOOKS_ALLOW_PRIVATE=1.
 */

const allowPrivate = () => process.env.REACTPRESS_WEBHOOKS_ALLOW_PRIVATE === "1";

function ipv4Private(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || // "this" network
    a === 10 ||
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && ip.startsWith("192.0.0.")) ||
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast, reserved, broadcast
  );
}

/** True for addresses a webhook must never call. Unparseable input counts as private. */
export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return ipv4Private(ip);
  if (kind === 6) {
    const v = ip.toLowerCase();
    if (v === "::" || v === "::1") return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); // IPv4-mapped
    if (mapped) return ipv4Private(mapped[1]);
    const hex = v.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/); // IPv4-mapped, hex form
    if (hex) {
      const hi = parseInt(hex[1], 16);
      const lo = parseInt(hex[2], 16);
      return ipv4Private(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith("ff"); // unique-local, link-local, multicast
  }
  return true;
}

/** Syntax check for a webhook URL (no network access). Throws a readable error. */
export function parseWebhookUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Enter a full URL such as https://example.com/hook");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only http and https URLs are allowed");
  if (url.username || url.password) throw new Error("Put credentials in the secret, not in the URL");
  if (raw.length > 2000) throw new Error("URL is too long");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!allowPrivate()) {
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
      throw new Error("That host is not reachable from webhooks");
    }
    if (isIP(host) && isPrivateAddress(host)) throw new Error("Private and loopback addresses are not allowed");
  }
  return url;
}

/** `net` lookup hook: resolve, refuse private results. Pass as the `lookup` option of http(s).request. */
export function safeLookup(
  hostname: string,
  options: { all?: boolean; family?: number },
  callback: (err: Error | null, address: string | { address: string; family: number }[], family?: number) => void,
) {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as { address: string; family: number }[];
    if (!allowPrivate() && list.some((a) => isPrivateAddress(a.address))) {
      return callback(new Error("Target resolves to a private address"), "", 0);
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}
