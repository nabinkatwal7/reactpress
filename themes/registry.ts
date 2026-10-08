import type { ThemeModule } from "@/lib/theme/types";
import type { ThemeManifest } from "@/lib/theme/manifest";
import defaultManifest from "./default/theme.json";
import midnightManifest from "./midnight/theme.json";

/**
 * Themes shipped with this build. Components must be imported statically for the bundler, so
 * adding a theme folder means adding one line here. The manifests are re-validated against the
 * files on disk by `validateThemeDir` (install API + self-check).
 */
export const THEME_REGISTRY: Record<
  string,
  { manifest: ThemeManifest; load: () => Promise<ThemeModule> }
> = {
  default: {
    manifest: defaultManifest as ThemeManifest,
    load: async () => (await import("./default")).default,
  },
  midnight: {
    manifest: midnightManifest as ThemeManifest,
    load: async () => (await import("./midnight")).default,
  },
};

export const DEFAULT_THEME = "default";
