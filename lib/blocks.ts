/**
 * Block JSON model shared by the editor and the public renderer.
 * Every block is `{ type, ...fields }`; all text lives in `text` so full-text search
 * (rp_blocks_text) indexes it. Lists store one item per line in `text`.
 */
export type Block =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 2 | 3 | 4; text: string }
  | { type: "list"; ordered: boolean; text: string }
  | { type: "quote"; text: string }
  | { type: "code"; text: string }
  | { type: "image"; mediaId: string | null; url: string; alt: string; text: string }
  | { type: "separator" };

export type BlockType = Block["type"];

export const BLOCK_TYPES: { type: BlockType; label: string }[] = [
  { type: "paragraph", label: "Paragraph" },
  { type: "heading", label: "Heading" },
  { type: "list", label: "List" },
  { type: "quote", label: "Quote" },
  { type: "code", label: "Code" },
  { type: "image", label: "Image" },
  { type: "separator", label: "Separator" },
];

export function emptyBlock(type: BlockType): Block {
  switch (type) {
    case "paragraph":
    case "quote":
    case "code":
      return { type, text: "" };
    case "heading":
      return { type, level: 2, text: "" };
    case "list":
      return { type, ordered: false, text: "" };
    case "image":
      return { type, mediaId: null, url: "", alt: "", text: "" };
    case "separator":
      return { type };
  }
}

const KNOWN = new Set<string>(BLOCK_TYPES.map((b) => b.type));

/** Coerce stored JSON into editable blocks. Unknown block types are kept as paragraphs of their text. */
export function toBlocks(content: unknown): Block[] {
  if (!Array.isArray(content)) return [];
  return content
    .filter((b): b is Record<string, unknown> => !!b && typeof b === "object")
    .map((b): Block => {
      const text = typeof b.text === "string" ? b.text : "";
      const type = typeof b.type === "string" && KNOWN.has(b.type) ? (b.type as BlockType) : "paragraph";
      switch (type) {
        case "heading": {
          const level = b.level === 3 || b.level === 4 ? b.level : 2;
          return { type, level, text };
        }
        case "list":
          return { type, ordered: b.ordered === true, text };
        case "image":
          return {
            type,
            mediaId: typeof b.mediaId === "string" ? b.mediaId : null,
            url: typeof b.url === "string" ? b.url : "",
            alt: typeof b.alt === "string" ? b.alt : "",
            text,
          };
        case "separator":
          return { type };
        default:
          return { type, text };
      }
    });
}

/** Only same-site media paths or https URLs may be rendered as images. */
export function safeImageUrl(url: string): string | null {
  return url.startsWith("/media/") || /^https:\/\//i.test(url) ? url : null;
}
