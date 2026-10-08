import type { PluginRegister } from "@/lib/plugins/api";
import type { PluginManifest } from "@/lib/plugins/manifest";
import readingTimeManifest from "./reading-time/plugin.json";
import { INSTALLED } from "./installed.generated";

export type { PluginRegister };

/**
 * Plugins shipped with this build. Entry modules must be imported statically for the bundler, so
 * adding a plugin folder means adding one line here. The manifests are re-validated against the
 * files on disk by `validatePluginDir` (install API + self-check).
 */
export const PLUGIN_REGISTRY: Record<
  string,
  { manifest: PluginManifest; load: () => Promise<PluginRegister> }
> = {
  // plugins installed from a marketplace (generated); bundled ones below win on a slug clash
  ...INSTALLED,
  "reading-time": {
    manifest: readingTimeManifest as PluginManifest,
    load: async () => (await import("./reading-time/register")).default,
  },
};
