import { parseArgs } from "./args.mjs";
import { COMMANDS } from "./commands.mjs";

const USAGE = () => `reactpress: command line for ReactPress sites

Usage: reactpress <command> [options]

Commands:
${Object.values(COMMANDS).map((c) => `  ${c.help}`).join("\n")}

Options:
  --json   Print JSON where a command supports it
  -h       Show help

Examples:
  reactpress login https://example.com
  reactpress login https://example.com/shop        (a site on a multisite network)
  reactpress post create --title "Hello" --file hello.md --status publish
  reactpress plugin activate reading-time
  reactpress export --out backup.json
`;

/** Run the CLI with already-split arguments. Returns the exit code. */
export async function main(argv) {
  const { positionals, flags } = parseArgs(argv);
  const [name, ...rest] = positionals;
  if (!name || (flags.help && !COMMANDS[name])) {
    console.log(USAGE());
    return name || flags.help ? 0 : 1;
  }
  const command = COMMANDS[name];
  if (!command) {
    console.error(`reactpress: unknown command "${name}"\n`);
    console.error(USAGE());
    return 1;
  }

  if (command.sub) {
    const [subName, ...args] = rest;
    const run = subName && Object.hasOwn(command.sub, subName) ? command.sub[subName] : null;
    if (!run || flags.help) {
      const list = Object.keys(command.sub).join(", ");
      if (flags.help || !subName) console.log(`reactpress ${name} <${Object.keys(command.sub).join("|")}>`);
      else console.error(`reactpress: unknown subcommand "${subName}". Try: ${list}`);
      return flags.help || !subName ? 0 : 1;
    }
    await run({ positionals: args, flags });
    return 0;
  }
  if (flags.help) {
    console.log(`reactpress ${command.help}`);
    return 0;
  }
  await command.run({ positionals: rest, flags });
  return 0;
}
