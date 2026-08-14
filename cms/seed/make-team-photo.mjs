import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../site/src/assets/team");
fs.mkdirSync(root, { recursive: true });
const png = await sharp({
  create: {
    width: 400,
    height: 400,
    channels: 3,
    background: { r: 29, g: 78, b: 137 },
  },
})
  .png()
  .toBuffer();
fs.writeFileSync(path.join(root, "dori-fussmann.png"), png);
console.log("wrote", path.join(root, "dori-fussmann.png"));
