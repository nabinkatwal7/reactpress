import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const titleCase = (slug) => slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

const json = (v) => JSON.stringify(v, null, 2) + "\n";

/** Files of a new plugin, relative to its folder. Follows plugins/README.md. */
export function pluginFiles(slug, author = "You") {
  const name = titleCase(slug);
  return {
    "plugin.json": json({
      name,
      slug,
      version: "0.1.0",
      author,
      description: `${name} plugin.`,
      settings: [{ key: "greeting", label: "Greeting", type: "text", default: "Hello" }],
      adminPages: [],
    }),
    "register.ts": `import type { PluginApi } from "@/lib/plugins/api";

/** Called once per site while the plugin is active. Everything goes through \`api\`. */
export default function register(api: PluginApi) {
  // Example: change every post title.
  // api.addFilter<string>("the_title", async (title) => {
  //   const { greeting } = await api.getSettings();
  //   return \`\${greeting}: \${title}\`;
  // });
  void api;
}
`,
  };
}

/** Files of a new theme, relative to its folder. Follows themes/README.md. */
export function themeFiles(slug, author = "You") {
  const name = titleCase(slug);
  return {
    "theme.json": json({
      name,
      slug,
      version: "0.1.0",
      author,
      description: `${name} theme.`,
      templates: ["index"],
      parts: ["header", "footer"],
      customizer: {
        settings: [{ key: "primary_color", label: "Accent color", type: "color", default: "#1d4ed8" }],
      },
    }),
    "index.ts": `import type { ThemeModule } from "@/lib/theme/types";
import Footer from "./parts/footer";
import Header from "./parts/header";
import Index from "./templates/index";

const theme: ThemeModule = {
  templates: { index: Index },
  parts: { header: Header, footer: Footer },
};

export default theme;
`,
    "templates/index.tsx": `import { PostList } from "@/components/public/parts";
import type { HomeProps } from "@/lib/theme/types";

/** The last-resort template: used whenever nothing more specific exists. */
export default function Index(props: Partial<HomeProps>) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <PostList posts={props.posts ?? []} empty="Nothing to show here." />
    </main>
  );
}
`,
    "parts/header.tsx": `import { SiteLink } from "@/components/public/site-link";
import type { PartProps } from "@/lib/theme/types";

export default function Header({ ctx }: PartProps) {
  return (
    <header className="mx-auto w-full max-w-3xl px-4 py-6">
      <SiteLink href="/" className="text-xl font-semibold" style={{ color: "var(--rp-primary_color)" }}>
        {ctx.site.title}
      </SiteLink>
    </header>
  );
}
`,
    "parts/footer.tsx": `import type { PartProps } from "@/lib/theme/types";

export default function Footer({ ctx }: PartProps) {
  return (
    <footer className="mx-auto mt-auto w-full max-w-3xl px-4 py-6 text-sm opacity-60">
      {ctx.site.title}
    </footer>
  );
}
`,
    "assets/.gitkeep": "",
  };
}

/**
 * Create `<baseDir>/<slug>/` with the starter files. Never overwrites: fails if the folder exists.
 * Returns the created folder.
 */
export async function scaffold(kind, slug, { baseDir, author }) {
  if (kind !== "plugin" && kind !== "theme") throw new Error('Usage: reactpress scaffold <plugin|theme> <slug>');
  if (!slug || !SLUG.test(slug)) throw new Error("The slug must be kebab-case, like my-plugin");
  const parent = path.resolve(baseDir ?? (kind === "plugin" ? "plugins" : "themes"));
  try {
    await access(parent);
  } catch {
    throw new Error(`${parent} does not exist. Run this from the ReactPress project root, or pass --dir`);
  }
  const dir = path.join(parent, slug);
  try {
    await access(dir);
    throw new Error(`${dir} already exists`);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const files = kind === "plugin" ? pluginFiles(slug, author) : themeFiles(slug, author);
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(dir, rel);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content, { flag: "wx" });
  }
  return dir;
}
