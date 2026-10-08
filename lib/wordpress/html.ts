import type { Block } from "@/lib/blocks";

/**
 * WordPress post HTML (classic editor or Gutenberg) -> ReactPress blocks.
 * A small tolerant parser, no DOM: it keeps headings, paragraphs, lists, quotes, code, images and
 * rules, and flattens everything else to its text. Scripts, styles, iframes and forms are dropped.
 * Inline formatting and links are not representable in blocks, so their text is kept without markup.
 */

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", copy: "©", reg: "®", trade: "™",
  laquo: "«", raquo: "»", bull: "•", middot: "·", euro: "€", pound: "£", times: "×",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : "";
    }
    return NAMED[e] ?? m;
  });
}

type El = { tag: string; attrs: Record<string, string>; kids: (El | string)[] };

const VOID = new Set(["br", "hr", "img", "input", "meta", "link", "source", "wbr", "col", "area", "base", "embed", "param", "track"]);
const DROP = new Set(["script", "style", "iframe", "form", "object", "noscript", "svg", "template", "head", "button", "select", "textarea"]);
/** Opening one of these closes an open <p> / <li> (HTML's implied end tags). */
const CLOSES_P = new Set(["p", "div", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "hr", "table", "figure", "li"]);

function parseAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of raw.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    out[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return out;
}

function parse(html: string): El {
  const root: El = { tag: "#root", attrs: {}, kids: [] };
  const stack: El[] = [root];
  const top = () => stack[stack.length - 1];
  const close = (tag: string) => {
    for (let i = stack.length - 1; i > 0; i--) {
      if (stack[i].tag === tag) {
        stack.length = i;
        return;
      }
    }
  };
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\/([a-zA-Z][a-zA-Z0-9]*)\s*>|<([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  let last = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m.index > last) top().kids.push(html.slice(last, m.index));
    last = re.lastIndex;
    if (m[0].startsWith("<!")) continue;
    if (m[1]) {
      close(m[1].toLowerCase());
      continue;
    }
    const tag = m[2].toLowerCase();
    // a raw-text element: skip to its closing tag so its content is never parsed as markup
    if (DROP.has(tag) && !m[4]) {
      const end = new RegExp(`</${tag}\\s*>`, "i");
      const rest = html.slice(last);
      const found = end.exec(rest);
      last += found ? found.index + found[0].length : rest.length;
      re.lastIndex = last;
      continue;
    }
    if (CLOSES_P.has(tag)) {
      if (top().tag === "p" || (tag === "li" && top().tag === "li")) stack.pop();
    }
    const el: El = { tag, attrs: parseAttrs(m[3]), kids: [] };
    top().kids.push(el);
    if (!VOID.has(tag) && !m[4]) stack.push(el);
  }
  if (last < html.length) top().kids.push(html.slice(last));
  return root;
}

const squash = (s: string) => decodeEntities(s).replace(/\s+/g, " ");

function textOf(n: El | string, keepBreaks = false): string {
  if (typeof n === "string") return keepBreaks ? decodeEntities(n) : squash(n);
  if (n.tag === "br") return keepBreaks ? "\n" : " ";
  return n.kids.map((k) => textOf(k, keepBreaks)).join("");
}

function imagesIn(n: El | string, out: El[] = []): El[] {
  if (typeof n === "string") return out;
  if (n.tag === "img") out.push(n);
  for (const k of n.kids) imagesIn(k, out);
  return out;
}

/** http(s) and root-relative URLs only. `javascript:`, `data:` and friends never make it into a block. */
export function safeUrl(u: string | undefined): string | null {
  const s = (u ?? "").trim();
  return /^https?:\/\//i.test(s) || (s.startsWith("/") && !s.startsWith("//")) ? s : null;
}

const INLINE = new Set(["a", "span", "strong", "b", "em", "i", "u", "s", "small", "sup", "sub", "mark", "abbr", "cite", "del", "ins", "label", "font", "code", "kbd", "samp", "var", "time", "br"]);

const KNOWN_SHORTCODES = /\[\/?(?:caption|gallery|audio|video|embed|playlist|wpvideo|wp_caption)\b[^\]]*\]/gi;

export type HtmlOptions = {
  /** Rewrites an image URL (used to point at downloaded copies). */
  mapImage?: (url: string) => string;
};

export function htmlToBlocks(html: string, opts: HtmlOptions = {}): Block[] {
  const src = html.replace(KNOWN_SHORTCODES, "");
  const blocks: Block[] = [];
  const map = opts.mapImage ?? ((u: string) => u);

  const push = (b: Block) => void blocks.push(b);
  const paragraph = (text: string) => {
    const t = text.replace(/\s+/g, " ").trim();
    if (t) push({ type: "paragraph", text: t });
  };
  const image = (img: El, caption = "") => {
    const url = safeUrl(img.attrs.src);
    if (url) push({ type: "image", mediaId: null, url: map(url), alt: (img.attrs.alt ?? "").slice(0, 500), text: caption.trim() });
  };

  // text that sits directly between block elements (classic editor): blank lines separate paragraphs
  const loose = (text: string) => {
    for (const part of text.split(/\n\s*\n/)) paragraph(part);
  };

  const walk = (nodes: (El | string)[]) => {
    // inline content (text, <a>, <strong> ...) between blocks is gathered into one run
    let run = "";
    const flush = () => {
      if (run) loose(run);
      run = "";
    };
    for (const n of nodes) {
      if (typeof n === "string") {
        run += decodeEntities(n);
        continue;
      }
      if (INLINE.has(n.tag)) {
        run += textOf(n, true);
        const imgs = imagesIn(n);
        if (imgs.length) {
          flush();
          imgs.forEach((i) => image(i));
        }
        continue;
      }
      flush();
      switch (n.tag) {
        case "p": {
          paragraph(textOf(n));
          imagesIn(n).forEach((i) => image(i));
          break;
        }
        case "h1": case "h2": case "h3": case "h4": case "h5": case "h6": {
          const t = textOf(n).trim();
          const n6 = Number(n.tag[1]);
          if (t) push({ type: "heading", level: n6 <= 2 ? 2 : n6 === 3 ? 3 : 4, text: t });
          break;
        }
        case "ul": case "ol": {
          const items = n.kids.filter((k): k is El => typeof k !== "string" && k.tag === "li").map((li) => textOf(li).trim()).filter(Boolean);
          if (items.length) push({ type: "list", ordered: n.tag === "ol", text: items.join("\n") });
          break;
        }
        case "blockquote": {
          const t = textOf(n).trim();
          if (t) push({ type: "quote", text: t });
          break;
        }
        case "pre": {
          const t = textOf(n, true).replace(/^\n+|\n+$/g, "");
          if (t) push({ type: "code", text: t });
          break;
        }
        case "hr":
          push({ type: "separator" });
          break;
        case "img":
          image(n);
          break;
        case "figure": {
          const cap = n.kids.find((k): k is El => typeof k !== "string" && k.tag === "figcaption");
          const imgs = imagesIn(n);
          if (imgs.length) imgs.forEach((i, idx) => image(i, idx === 0 && cap ? textOf(cap) : ""));
          else walk(n.kids.filter((k) => k !== cap));
          break;
        }
        case "table": {
          const rows = [...(function* find(x: El): Generator<El> {
            for (const k of x.kids) if (typeof k !== "string") { if (k.tag === "tr") yield k; else yield* find(k); }
          })(n)];
          const lines = rows.map((r) => r.kids.filter((c): c is El => typeof c !== "string").map((c) => textOf(c).trim()).filter(Boolean).join(" | ")).filter(Boolean);
          if (lines.length) push({ type: "paragraph", text: lines.join("\n") });
          break;
        }
        case "br":
          break;
        default:
          // div, section, ... : look inside
          walk(n.kids);
      }
    }
    flush();
  };

  // inline-only content with no block tags at all is plain classic-editor text
  walk(parse(src).kids);
  return blocks;
}
