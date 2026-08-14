import fs from "node:fs";
import { SITE_NAME } from "../../site/src/config/site.ts";
import { absoluteUrl } from "../../site/src/lib/url.ts";
import { LLMS_PATH } from "./paths.ts";
import { readAllArticles } from "./readContent.ts";

export function generateLlmsTxt(): string {
  const published = readAllArticles().filter((row) => !row.data.draft);
  const lines = [
    `# ${SITE_NAME}`,
    "",
    `> Published articles from ${SITE_NAME}.`,
    "",
    "## Articles",
    "",
  ];
  for (const row of published) {
    const url = absoluteUrl(`/articles/${row.data.slug}/`);
    lines.push(`[${row.data.title}](${url}): ${row.data.description}`);
    lines.push("");
  }
  const text = lines.join("\n").trimEnd() + "\n";
  fs.mkdirSync(pathDir(LLMS_PATH), { recursive: true });
  fs.writeFileSync(LLMS_PATH, text, "utf8");
  return text;
}

function pathDir(filePath: string): string {
  return filePath.replace(/[\\/][^\\/]+$/, "");
}
