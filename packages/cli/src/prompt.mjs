import { createInterface } from "node:readline";

/** Ask a question on the terminal. With `hidden`, typed characters are not echoed (passwords). */
export function ask(question, { hidden = false } = {}) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error(`${question.trim()} needs a terminal. Pass it as a flag, or use --password-stdin / REACTPRESS_* variables.`));
      return;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => {
        if (s.includes(question)) process.stdout.write(s);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

/** Read all of stdin (for `--password-stdin` and `--file -`). */
export async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}
