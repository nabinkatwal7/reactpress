#!/usr/bin/env node
import { main } from "../src/main.mjs";

main(process.argv.slice(2)).then(
  (code) => process.exit(code ?? 0),
  (err) => {
    console.error(`reactpress: ${err?.message ?? err}`);
    process.exit(1);
  },
);
