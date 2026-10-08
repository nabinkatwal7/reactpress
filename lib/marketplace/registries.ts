import { prisma } from "@/lib/prisma";
import { parseWebhookUrl } from "@/lib/webhooks/ssrf";
import { clearRegistryCache } from "./catalog";

export const MAX_REGISTRIES = 10;

const devAllowsHttp = () =>
  process.env.REACTPRESS_ALLOW_PRIVATE_FETCH === "1" || process.env.REACTPRESS_WEBHOOKS_ALLOW_PRIVATE === "1";

/** Validate and normalise a registry URL. https only (an http catalog could be rewritten in transit), except in dev mode. */
export function cleanRegistryUrl(raw: string): string {
  const url = parseWebhookUrl(raw);
  if (url.protocol !== "https:" && !devAllowsHttp()) throw new Error("Registries must use https");
  url.hash = "";
  return url.toString();
}

export async function setRegistries(networkId: string, urls: string[]) {
  if (urls.length > MAX_REGISTRIES) throw new Error(`At most ${MAX_REGISTRIES} registries`);
  const clean = [...new Set(urls.map(cleanRegistryUrl))];
  await prisma.network.update({ where: { id: networkId }, data: { registries: clean } });
  clearRegistryCache();
  return clean;
}
