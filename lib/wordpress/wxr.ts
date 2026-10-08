import { XMLParser, XMLValidator } from "fast-xml-parser";
import { decodeEntities } from "./html";

/** Parser for WordPress eXtended RSS (the "Tools > Export" file). Pure: text in, plain objects out. */

export class WxrError extends Error {}

export const MAX_WXR_BYTES = 100 * 1024 * 1024;

export type WxrTerm = { slug: string; name: string; parent: string | null };
export type WxrAuthor = { login: string; email: string; name: string };
export type WxrItem = {
  id: string;
  type: string;
  title: string;
  slug: string;
  status: string;
  /** "YYYY-MM-DD HH:MM:SS" in GMT when WordPress knows it, else the site's local time (treated as GMT). */
  date: string | null;
  content: string;
  excerpt: string;
  creator: string;
  parent: string;
  attachmentUrl: string | null;
  terms: { domain: string; slug: string; name: string }[];
  meta: Record<string, string>;
  commentCount: number;
};
export type WxrDoc = { title: string; categories: WxrTerm[]; tags: WxrTerm[]; authors: WxrAuthor[]; items: WxrItem[] };

type Node = Record<string, unknown>;

/** Text of an element that may be a string, a number, or an object with attributes and a "#text". */
function txt(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object" && "#text" in (v as Node)) return txt((v as Node)["#text"]);
  return "";
}

const list = (v: unknown): Node[] => (Array.isArray(v) ? (v as Node[]) : v ? [v as Node] : []);

const ARRAYS = new Set(["item", "wp:category", "wp:tag", "wp:author", "wp:postmeta", "category", "wp:comment", "wp:term"]);

export function parseWxr(xml: string): WxrDoc {
  if (xml.length > MAX_WXR_BYTES) throw new WxrError("The file is too large (limit 100 MB)");
  // WXR never needs a DTD; refusing it rules out entity-expansion attacks outright
  if (/<!DOCTYPE|<!ENTITY/i.test(xml.slice(0, 4096)) || /<!ENTITY/i.test(xml)) throw new WxrError("This file contains a DOCTYPE or entity declaration, which is not allowed");

  // WordPress exports sometimes contain control characters XML forbids; drop them rather than fail
  xml = xml.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  const valid = XMLValidator.validate(xml);
  if (valid !== true) throw new WxrError(`The file is not valid XML: ${valid.err.msg} (line ${valid.err.line})`);

  let root: Node;
  try {
    root = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseTagValue: false,
      parseAttributeValue: false,
      trimValues: true,
      processEntities: true,
      isArray: (name) => ARRAYS.has(name),
    }).parse(xml) as Node;
  } catch (e) {
    throw new WxrError(`The file is not valid XML: ${(e as Error).message}`);
  }
  const channel = (root.rss as Node | undefined)?.channel as Node | undefined;
  if (!channel || typeof channel !== "object") throw new WxrError("This does not look like a WordPress export (no <rss><channel>)");

  const term = (n: Node, slugKey: string, nameKey: string, parentKey?: string): WxrTerm => ({
    slug: txt(n[slugKey]),
    name: decodeEntities(txt(n[nameKey])), // WordPress stores names HTML-escaped, even inside CDATA
    parent: parentKey ? txt(n[parentKey]) || null : null,
  });

  const items: WxrItem[] = list(channel.item).map((n) => {
    const meta: Record<string, string> = {};
    for (const m of list(n["wp:postmeta"])) meta[txt(m["wp:meta_key"])] = txt(m["wp:meta_value"]);
    const gmt = txt(n["wp:post_date_gmt"]);
    const local = txt(n["wp:post_date"]);
    const valid = (d: string) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(d) && !d.startsWith("0000");
    return {
      id: txt(n["wp:post_id"]),
      type: txt(n["wp:post_type"]),
      title: txt(n.title),
      slug: txt(n["wp:post_name"]),
      status: txt(n["wp:status"]),
      date: valid(gmt) ? gmt : valid(local) ? local : null,
      content: txt(n["content:encoded"]),
      excerpt: txt(n["excerpt:encoded"]),
      creator: txt(n["dc:creator"]),
      parent: txt(n["wp:post_parent"]),
      attachmentUrl: txt(n["wp:attachment_url"]) || null,
      terms: list(n.category).map((c) => ({ domain: String(c["@_domain"] ?? ""), slug: String(c["@_nicename"] ?? ""), name: decodeEntities(txt(c)) })),
      meta,
      commentCount: list(n["wp:comment"]).length,
    };
  });

  return {
    title: txt(channel.title),
    categories: list(channel["wp:category"]).map((c) => term(c, "wp:category_nicename", "wp:cat_name", "wp:category_parent")),
    tags: list(channel["wp:tag"]).map((t) => term(t, "wp:tag_slug", "wp:tag_name")),
    authors: list(channel["wp:author"]).map((a) => ({ login: txt(a["wp:author_login"]), email: txt(a["wp:author_email"]), name: txt(a["wp:author_display_name"]) })),
    items,
  };
}
