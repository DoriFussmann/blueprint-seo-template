import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const guidePath = join(dirname(fileURLToPath(import.meta.url)), "Design Guide.md");
const guide = readFileSync(guidePath, "utf8");
const match = guide.match(/```tokens\r?\n([\s\S]*?)\r?\n```/);
if (!match) {
  throw new Error("Design Guide.md is missing a parseable ```tokens fence.");
}

export const tokens = JSON.parse(match[1]);
