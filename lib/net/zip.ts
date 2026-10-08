import { deflateRawSync, inflateRawSync } from "node:zlib";

/**
 * Minimal ZIP reader/writer (stored + deflate, no zip64, no encryption), so packages and backups
 * need no dependency. The reader treats the archive as hostile: entry names are validated
 * (no zip-slip), sizes are capped (zip bombs), CRCs are checked, symlinks are refused.
 */

export type ZipEntry = { path: string; data: Buffer };

export type ZipLimits = {
  maxEntries: number;
  /** Total uncompressed bytes across all entries. */
  maxTotalBytes: number;
  maxEntryBytes: number;
};

export const DEFAULT_LIMITS: ZipLimits = { maxEntries: 2000, maxTotalBytes: 50 * 1024 * 1024, maxEntryBytes: 25 * 1024 * 1024 };

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Entry names we accept: relative, forward slashes, no `.`/`..` segments, no control characters. */
export function safeEntryName(name: string): string | null {
  if (!name || name.length > 300) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\\]/.test(name) || name.startsWith("/") || /^[A-Za-z]:/.test(name)) return null;
  const parts = name.replace(/\/+$/, "").split("/");
  if (parts.some((p) => p === "" || p === "." || p === "..")) return null;
  return parts.join("/");
}

export function readZip(buf: Buffer, limits: ZipLimits = DEFAULT_LIMITS): ZipEntry[] {
  // end of central directory record: search backwards (it may be followed by a comment)
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a zip file");
  const total = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (total === 0xffff || cdOffset === 0xffffffff) throw new Error("zip64 archives are not supported");
  if (total > limits.maxEntries) throw new Error(`Too many files in the archive (limit ${limits.maxEntries})`);
  if (cdOffset + cdSize > buf.length) throw new Error("Corrupt zip file");

  const out: ZipEntry[] = [];
  const seen = new Set<string>();
  let used = 0;
  let p = cdOffset;
  for (let n = 0; n < total; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new Error("Corrupt zip file");
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const externalAttrs = buf.readUInt32LE(p + 38);
    const localOffset = buf.readUInt32LE(p + 42);
    const rawName = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    p += 46 + nameLen + extraLen + commentLen;

    const isDir = rawName.endsWith("/");
    const name = safeEntryName(rawName);
    if (!name) throw new Error(`Unsafe file name in the archive: ${JSON.stringify(rawName.slice(0, 80))}`);
    if (flags & 1) throw new Error("Encrypted zip files are not supported");
    if (((externalAttrs >>> 16) & 0o170000) === 0o120000) throw new Error(`Symbolic links are not allowed (${name})`);
    if (isDir) continue;
    if (seen.has(name)) throw new Error(`Duplicate file in the archive: ${name}`);
    seen.add(name);

    if (usize > limits.maxEntryBytes) throw new Error(`${name} is too large`);
    used += usize;
    if (used > limits.maxTotalBytes) throw new Error("The archive is too large when unpacked");
    if (localOffset + 30 > buf.length || buf.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("Corrupt zip file");
    const start = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
    if (start + csize > buf.length) throw new Error("Corrupt zip file");
    const raw = buf.subarray(start, start + csize);

    let data: Buffer;
    if (method === 0) data = Buffer.from(raw);
    else if (method === 8) data = inflateRawSync(raw, { maxOutputLength: Math.min(limits.maxEntryBytes, usize + 1) });
    else throw new Error(`Unsupported compression in ${name}`);
    if (data.length !== usize) throw new Error(`Corrupt zip entry: ${name}`);
    if (crc32(data) !== crc) throw new Error(`Checksum mismatch in ${name}`);
    out.push({ path: name, data });
  }
  return out;
}

export function createZip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  // fixed timestamp (1980-01-01) so the same input always gives the same bytes
  const time = 0;
  const date = (1 << 5) | 1;
  for (const e of entries) {
    const name = safeEntryName(e.path);
    if (!name) throw new Error(`Unsafe path for zip: ${e.path}`);
    const nameBuf = Buffer.from(name, "utf8");
    const deflated = deflateRawSync(e.data, { level: 9 });
    const useDeflate = deflated.length < e.data.length;
    const body = useDeflate ? deflated : e.data;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(e.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, body);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(time, 12);
    cd.writeUInt16LE(date, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(body.length, 20);
    cd.writeUInt32LE(e.data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);
    offset += 30 + nameBuf.length + body.length;
  }
  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cdBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cdBuf, end]);
}
