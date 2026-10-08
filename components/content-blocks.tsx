/** Minimal block renderer (plain-text paragraphs); the real block renderer arrives with the editor. */
export function ContentBlocks({ content }: { content: unknown }) {
  const blocks = Array.isArray(content) ? (content as Record<string, unknown>[]) : [];
  return (
    <>
      {blocks.map((b, i) => (typeof b.text === "string" ? <p key={i}>{b.text}</p> : null))}
    </>
  );
}
