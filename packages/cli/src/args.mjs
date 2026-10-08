/** Flags that never take a value, so `--json post list` does not swallow `post`. */
const BOOLEAN = new Set(["json", "help", "yes", "password-stdin", "network"]);

/**
 * Tiny argument parser: `--key value`, `--key=value`, `--flag`, `-h`, and `--` to stop parsing.
 * Returns the positional arguments and a map of flags (strings, or `true` for bare flags).
 */
export function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (a === "-h") {
      flags.help = true;
    } else if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq > 0) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
        continue;
      }
      const key = a.slice(2);
      const next = argv[i + 1];
      if (BOOLEAN.has(key) || next === undefined || next.startsWith("--")) flags[key] = true;
      else {
        flags[key] = next;
        i++;
      }
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags };
}
