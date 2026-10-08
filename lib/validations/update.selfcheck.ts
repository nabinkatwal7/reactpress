/** ponytail: run with `npx tsx lib/validations/update.selfcheck.ts` */
import { createPageSchema, updatePageSchema } from "./page";
import { createPostSchema, updatePostSchema } from "./post";

let failures = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) failures += 1;
  console.assert(ok, msg);
};

// A partial update must not touch fields it does not mention (zod defaults used to wipe `content`).
for (const [name, schema] of [["post", updatePostSchema], ["page", updatePageSchema]] as const) {
  const parsed = schema.parse({ status: "publish" });
  check(!("content" in parsed), `${name}: partial update leaves content out`);
  check(Object.keys(parsed).join() === "status", `${name}: only the given field is present`);
  check(schema.parse({ content: [] }).content?.length === 0, `${name}: an explicit empty content is kept`);
  check(!schema.safeParse({ content: [{ nope: 1 }] }).success, `${name}: blocks still need a type`);
}

// Creating without content still means an empty document.
check(Array.isArray(createPostSchema.parse({ title: "x" }).content) && createPostSchema.parse({ title: "x" }).content!.length === 0, "post create defaults content to []");
check(createPageSchema.parse({ title: "x" }).content!.length === 0, "page create defaults content to []");

if (failures) {
  console.error(`${failures} validation check(s) failed`);
  process.exit(1);
}
console.log("update validation self-check passed");
