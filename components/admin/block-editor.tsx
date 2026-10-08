"use client";

import { BLOCK_TYPES, emptyBlock, type Block, type BlockType } from "@/lib/blocks";
import { useState } from "react";
import { MediaPicker } from "@/components/admin/media-picker";

const field = "w-full rounded border border-neutral-300 px-3 py-2 text-sm";

function ImageBody({
  block,
  onChange,
}: {
  block: Extract<Block, { type: "image" }>;
  onChange: (b: Block) => void;
}) {
  const [picking, setPicking] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      {block.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={block.url} alt={block.alt} className="max-h-48 w-fit" />
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded border border-neutral-300 px-3 py-2 text-sm"
          onClick={() => setPicking(true)}
        >
          {block.url ? "Replace image" : "Choose from library"}
        </button>
        <input
          className={field}
          placeholder="…or paste an image URL (/media/… or https://…)"
          value={block.url}
          onChange={(e) => onChange({ ...block, url: e.target.value, mediaId: null })}
        />
      </div>
      <input
        className={field}
        placeholder="Alt text"
        value={block.alt}
        onChange={(e) => onChange({ ...block, alt: e.target.value })}
      />
      <input
        className={field}
        placeholder="Caption (optional)"
        value={block.text}
        onChange={(e) => onChange({ ...block, text: e.target.value })}
      />
      <MediaPicker
        open={picking}
        onClose={() => setPicking(false)}
        onSelect={(m) => {
          onChange({ ...block, mediaId: m.id, url: m.url, alt: block.alt || m.alt });
          setPicking(false);
        }}
      />
    </div>
  );
}

function BlockBody({ block, onChange }: { block: Block; onChange: (b: Block) => void }) {
  switch (block.type) {
    case "paragraph":
    case "quote":
      return (
        <textarea
          className={field}
          rows={block.type === "quote" ? 2 : 3}
          placeholder={block.type === "quote" ? "Quote…" : "Write something…"}
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
        />
      );
    case "code":
      return (
        <textarea
          className={`${field} font-mono`}
          rows={4}
          placeholder="Code…"
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
        />
      );
    case "heading":
      return (
        <div className="flex gap-2">
          <select
            className="rounded border border-neutral-300 px-2 text-sm"
            value={block.level}
            onChange={(e) => onChange({ ...block, level: Number(e.target.value) as 2 | 3 | 4 })}
            aria-label="Heading level"
          >
            <option value={2}>H2</option>
            <option value={3}>H3</option>
            <option value={4}>H4</option>
          </select>
          <input
            className={field}
            placeholder="Heading…"
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
          />
        </div>
      );
    case "list":
      return (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.ordered}
              onChange={(e) => onChange({ ...block, ordered: e.target.checked })}
            />
            Numbered
          </label>
          <textarea
            className={field}
            rows={4}
            placeholder="One item per line"
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
          />
        </div>
      );
    case "image":
      return <ImageBody block={block} onChange={onChange} />;
    case "separator":
      return <hr className="border-neutral-300" />;
  }
}

let keyCounter = 0;
const newKey = () => `b${keyCounter++}`;

/** Controlled block editor: reads and writes the block JSON array. */
export function BlockEditor({
  value,
  onChange,
}: {
  value: Block[];
  onChange: (blocks: Block[]) => void;
}) {
  // Stable per-block keys so inputs keep focus while blocks are reordered.
  // The editor is the only writer of `value`, so keys are kept in step with it here.
  const [keys, setKeys] = useState<string[]>(() => value.map(newKey));
  const [adding, setAdding] = useState<BlockType>("paragraph");

  const update = (i: number, b: Block) => onChange(value.map((x, n) => (n === i ? b : x)));
  const remove = (i: number) => {
    setKeys(keys.filter((_, n) => n !== i));
    onChange(value.filter((_, n) => n !== i));
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const nextBlocks = [...value];
    [nextBlocks[i], nextBlocks[j]] = [nextBlocks[j], nextBlocks[i]];
    const nextKeys = [...keys];
    [nextKeys[i], nextKeys[j]] = [nextKeys[j], nextKeys[i]];
    setKeys(nextKeys);
    onChange(nextBlocks);
  };
  const add = () => {
    setKeys([...keys, newKey()]);
    onChange([...value, emptyBlock(adding)]);
  };

  return (
    <div className="flex flex-col gap-3">
      {value.length === 0 ? <p className="text-sm text-neutral-500">No blocks yet.</p> : null}
      {value.map((block, i) => (
        <div key={keys[i] ?? i} className="flex flex-col gap-2 border border-neutral-200 p-3">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span className="uppercase tracking-wide">{block.type}</span>
            <span className="flex gap-2 text-sm">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move block up">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label="Move block down">↓</button>
              <button type="button" className="text-red-600" onClick={() => remove(i)}>Remove</button>
            </span>
          </div>
          <BlockBody block={block} onChange={(b) => update(i, b)} />
        </div>
      ))}
      <div className="flex gap-2">
        <select
          className="rounded border border-neutral-300 px-2 py-2 text-sm"
          value={adding}
          onChange={(e) => setAdding(e.target.value as BlockType)}
          aria-label="Block type"
        >
          {BLOCK_TYPES.map((t) => (
            <option key={t.type} value={t.type}>
              {t.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={add} className="rounded border border-neutral-300 px-3 py-2 text-sm">
          Add block
        </button>
      </div>
    </div>
  );
}
