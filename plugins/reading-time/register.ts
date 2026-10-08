import type { Block } from "@/lib/blocks";
import type { PluginApi } from "@/lib/plugins/api";
import AboutPage from "./about-page";

export default function register(api: PluginApi) {
  api.addFilter<Block[]>("the_content", async (blocks, ctx: { kind: string }) => {
    if (ctx.kind !== "post") return blocks;
    const settings = await api.getSettings();
    const wpm = Number(settings.words_per_minute) || 220;
    const words = blocks.flatMap((b) => ("text" in b ? b.text.split(/\s+/) : [])).filter(Boolean).length;
    const minutes = Math.max(1, Math.round(words / wpm));
    return [{ type: "paragraph", text: `${minutes} ${settings.label}` }, ...blocks];
  });

  api.registerAdminPage("about", AboutPage);
}
