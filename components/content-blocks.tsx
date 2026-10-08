import { safeImageUrl, toBlocks } from "@/lib/blocks";

/** Public block renderer. All text is rendered as text (never HTML). */
export function ContentBlocks({ content }: { content: unknown }) {
  return (
    <div className="flex flex-col gap-4">
      {toBlocks(content).map((b, i) => {
        switch (b.type) {
          case "paragraph":
            return b.text ? (
              <p key={i} className="whitespace-pre-wrap">
                {b.text}
              </p>
            ) : null;
          case "heading": {
            const cls = "font-semibold tracking-tight";
            if (b.level === 2) return <h2 key={i} className={`text-2xl ${cls}`}>{b.text}</h2>;
            if (b.level === 3) return <h3 key={i} className={`text-xl ${cls}`}>{b.text}</h3>;
            return <h4 key={i} className={`text-lg ${cls}`}>{b.text}</h4>;
          }
          case "list": {
            const items = b.text.split("\n").filter((l) => l.trim());
            const Tag = b.ordered ? "ol" : "ul";
            return (
              <Tag key={i} className={`ml-6 ${b.ordered ? "list-decimal" : "list-disc"}`}>
                {items.map((item, n) => (
                  <li key={n}>{item}</li>
                ))}
              </Tag>
            );
          }
          case "quote":
            return (
              <blockquote key={i} className="border-l-4 border-neutral-300 pl-4 italic">
                {b.text}
              </blockquote>
            );
          case "code":
            return (
              <pre key={i} className="overflow-x-auto rounded bg-neutral-100 p-3 text-sm">
                <code>{b.text}</code>
              </pre>
            );
          case "image": {
            const src = safeImageUrl(b.url);
            if (!src) return null;
            return (
              <figure key={i} className="flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={b.alt} className="h-auto max-w-full" />
                {b.text ? <figcaption className="text-sm text-neutral-500">{b.text}</figcaption> : null}
              </figure>
            );
          }
          case "separator":
            return <hr key={i} className="border-neutral-200" />;
        }
      })}
    </div>
  );
}
