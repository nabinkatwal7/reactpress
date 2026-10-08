import type { AdminPageProps } from "@/lib/plugins/admin-pages";

export default function AboutPage({ settings }: AdminPageProps) {
  return (
    <section className="max-w-xl text-sm text-neutral-700">
      <p>
        Every post shows an estimated reading time ahead of its content, calculated at{" "}
        <strong>{String(settings.words_per_minute)}</strong> words per minute and labelled &ldquo;
        {String(settings.label)}&rdquo;.
      </p>
    </section>
  );
}
