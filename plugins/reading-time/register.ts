import type { Block } from "@/lib/blocks";
import type { PluginApi } from "@/lib/plugins/api";

const WORDS_PER_MINUTE = 220;

export default function register(api: PluginApi) {
  api.addFilter<Block[]>("the_content", (blocks, ctx: { kind: string }) => {
    if (ctx.kind !== "post") return blocks;
    const words = blocks.flatMap((b) => ("text" in b ? b.text.split(/\s+/) : [])).filter(Boolean).length;
    const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
    return [{ type: "paragraph", text: `${minutes} min read` }, ...blocks];
  });
}
