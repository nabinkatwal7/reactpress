/**
 * Plain text / light Markdown -> ReactPress blocks.
 * Blank lines separate blocks. `#`/`##` -> heading 2, `###` -> heading 3, `####` -> heading 4,
 * lines starting with "- " or "1. " -> list, "> " -> quote, ``` fenced -> code, "---" -> separator.
 */
export function textToBlocks(text) {
  const blocks = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let para = [];
  let list = null;
  let quote = [];
  let code = null;

  const flush = () => {
    if (para.length) blocks.push({ type: "paragraph", text: para.join(" ") });
    if (list) blocks.push({ type: "list", ordered: list.ordered, text: list.items.join("\n") });
    if (quote.length) blocks.push({ type: "quote", text: quote.join(" ") });
    para = [];
    list = null;
    quote = [];
  };

  for (const raw of lines) {
    if (code) {
      if (raw.trim().startsWith("```")) {
        blocks.push({ type: "code", text: code.join("\n") });
        code = null;
      } else code.push(raw);
      continue;
    }
    const line = raw.trimEnd();
    if (line.trim().startsWith("```")) {
      flush();
      code = [];
    } else if (!line.trim()) {
      flush();
    } else if (/^-{3,}$/.test(line.trim())) {
      flush();
      blocks.push({ type: "separator" });
    } else if (/^#{1,4}\s/.test(line)) {
      flush();
      const hashes = line.match(/^#+/)[0].length;
      blocks.push({ type: "heading", level: hashes <= 2 ? 2 : hashes, text: line.replace(/^#+\s+/, "") });
    } else if (/^(-|\*)\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\./.test(line);
      const item = line.replace(/^((-|\*)|\d+\.)\s+/, "");
      if (list && list.ordered !== ordered) flush();
      (list ??= { ordered, items: [] }).items.push(item);
    } else if (line.startsWith("> ")) {
      if (para.length || list) flush();
      quote.push(line.slice(2));
    } else {
      if (list || quote.length) flush();
      para.push(line.trim());
    }
  }
  if (code) blocks.push({ type: "code", text: code.join("\n") });
  flush();
  return blocks;
}
