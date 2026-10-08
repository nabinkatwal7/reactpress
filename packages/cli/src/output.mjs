/** Left-aligned plain-text table. Rows are arrays of values. */
export function table(headers, rows) {
  const cells = [headers, ...rows].map((r) => r.map((c) => String(c ?? "")));
  const widths = headers.map((_, i) => Math.min(Math.max(...cells.map((r) => r[i].length)), 60));
  const fmt = (r) => r.map((c, i) => (c.length > widths[i] ? c.slice(0, widths[i] - 1) + "…" : c.padEnd(widths[i]))).join("  ").trimEnd();
  return [fmt(cells[0]), widths.map((w) => "-".repeat(w)).join("  "), ...cells.slice(1).map(fmt)].join("\n");
}

export function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}
