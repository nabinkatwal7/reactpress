/** ponytail: run with `npx tsx lib/net/zip.selfcheck.ts` */
import { createZip, crc32, readZip, safeEntryName, type ZipLimits } from "./zip";

let failures = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) failures += 1;
  console.assert(ok, msg);
};
const throws = (fn: () => unknown, re: RegExp) => {
  try {
    fn();
  } catch (e) {
    return re.test((e as Error).message);
  }
  return false;
};

check(crc32(Buffer.from("123456789")) === 0xcbf43926, "crc32 matches the standard check value");

const files = [
  { path: "a.txt", data: Buffer.from("hello hello hello hello hello") },
  { path: "dir/b.json", data: Buffer.from(JSON.stringify({ x: "y".repeat(5000) })) },
  { path: "empty.txt", data: Buffer.alloc(0) },
  { path: "bin.dat", data: Buffer.from(Array.from({ length: 300 }, (_, i) => (i * 7) % 256)) },
];
const zip = createZip(files);
const back = readZip(zip);
check(back.length === 4 && back.every((e, i) => e.path === files[i].path && e.data.equals(files[i].data)), "round trip keeps names and bytes");
check(createZip(files).equals(zip), "output is deterministic");
check(zip.length < files.reduce((n, f) => n + f.data.length, 0), "compressible data is deflated");

// names
for (const bad of ["../x", "a/../../x", "/etc/passwd", "C:/x", "a\\b", "a//b", "./a", "", "a/./b", "x\0y"]) {
  check(safeEntryName(bad) === null, `unsafe name rejected: ${JSON.stringify(bad)}`);
  check(throws(() => createZip([{ path: bad, data: Buffer.from("x") }]), /Unsafe path/), `writer refuses ${JSON.stringify(bad)}`);
}
check(safeEntryName("pkg/templates/index.tsx") === "pkg/templates/index.tsx" && safeEntryName("dir/") === "dir", "normal names pass");

// hostile archives: patch a valid one
const patchName = (from: string, to: string) => {
  const z = Buffer.from(createZip([{ path: from, data: Buffer.from("x") }]));
  const idx = (s: string) => {
    const out: number[] = [];
    let i = z.indexOf(s);
    while (i >= 0) {
      out.push(i);
      i = z.indexOf(s, i + 1);
    }
    return out;
  };
  for (const i of idx(from)) z.write(to, i, "utf8"); // local header + central directory
  return z;
};
check(throws(() => readZip(patchName("aaaa/x", "../..x")), /Unsafe file name/), "zip-slip name in an archive is rejected");
check(throws(() => readZip(patchName("aaaaaaa", "/etc/pw")), /Unsafe file name/), "absolute name in an archive is rejected");
check(throws(() => readZip(Buffer.from("not a zip at all, definitely")), /Not a zip/), "garbage is rejected");
check(throws(() => readZip(zip.subarray(0, zip.length - 5)), /Not a zip|Corrupt/), "truncated archive is rejected");

const corrupt = Buffer.from(zip);
corrupt[40] ^= 0xff; // flip a byte inside the first entry's data
check(throws(() => readZip(corrupt), /Checksum|Corrupt|inflate|invalid/i), "flipped byte is detected");

// limits
const limits = (o: Partial<ZipLimits>): ZipLimits => ({ maxEntries: 100, maxTotalBytes: 1e6, maxEntryBytes: 1e6, ...o });
check(throws(() => readZip(zip, limits({ maxEntries: 2 })), /Too many files/), "entry count limit");
check(throws(() => readZip(zip, limits({ maxEntryBytes: 1000 })), /too large/), "per-entry size limit");
check(throws(() => readZip(zip, limits({ maxTotalBytes: 5000 })), /too large when unpacked/), "total size limit");
const bomb = createZip([{ path: "zeros.bin", data: Buffer.alloc(5_000_000) }]);
check(bomb.length < 10_000 && throws(() => readZip(bomb, limits({ maxEntryBytes: 1_000_000 })), /too large/), "a tiny archive that expands hugely is refused");

// duplicate names and symlinks
const dup = createZip([{ path: "a", data: Buffer.from("1") }, { path: "b", data: Buffer.from("2") }]);
const i = dup.indexOf("b", dup.indexOf("PK\x01\x02")); // second central-directory name
dup.write("a", dup.lastIndexOf("b"), "utf8");
check(i > 0 && throws(() => readZip(dup), /Duplicate/), "duplicate names are rejected");
const link = Buffer.from(createZip([{ path: "l", data: Buffer.from("target") }]));
link.writeUInt32LE((0o120777 << 16) >>> 0, link.indexOf("PK\x01\x02") + 38);
check(throws(() => readZip(link), /Symbolic links/), "symlink entries are rejected");

if (failures) {
  console.error(`${failures} zip check(s) failed`);
  process.exit(1);
}
console.log("zip self-check passed");
