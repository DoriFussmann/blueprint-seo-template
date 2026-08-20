import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import AdmZip from "adm-zip";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const sharp = require(join(here, "..", "..", "node_modules", "sharp"));

const slugs = [
  "technical-seo-foundations",
  "core-web-vitals-complete-guide",
  "improve-core-web-vitals-howto",
  "content-strategy-foundations",
];
const colors = ["#1D4E89", "#163A66", "#57534E", "#C4A35A"];

for (const [i, slug] of slugs.entries()) {
  const md = readFileSync(join(here, `${slug}.md`), "utf8");
  const title = md.match(/^title:\s*"(.*)"/m)?.[1] || "";
  const desc = md.match(/^description:\s*(.*)$/m)?.[1] || "";
  if (title.length < 55 || title.length > 60) {
    throw new Error(`${slug} title length ${title.length}: ${title}`);
  }
  if (desc.length < 140 || desc.length > 160) {
    throw new Error(`${slug} description length ${desc.length}`);
  }
  await sharp({
    create: { width: 1200, height: 675, channels: 3, background: colors[i] },
  })
    .png()
    .toFile(join(here, `${slug}.png`));
}

const zip = new AdmZip();
for (const slug of slugs) {
  zip.addLocalFile(join(here, `${slug}.md`));
  zip.addLocalFile(join(here, `${slug}.png`));
}
const zipPath = join(here, "seed-drafts.zip");
zip.writeZip(zipPath);
console.log("wrote", zipPath);
