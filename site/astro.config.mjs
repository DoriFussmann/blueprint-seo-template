import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import rehypeSlug from "rehype-slug";
import { SITE_URL } from "./src/config/site";
import {
  rehypePreserveHtmlComments,
  remarkPreserveHtmlComments,
} from "./src/lib/html-comments";

const siteRoot = path.dirname(fileURLToPath(import.meta.url));

function articleLastmodMap() {
  const dir = path.join(siteRoot, "src/content/articles");
  const map = new Map();
  if (!fs.existsSync(dir)) return map;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".md")) continue;
    const raw = fs.readFileSync(path.join(dir, name), "utf8");
    const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) continue;
    const block = fm[1];
    const pick = (key) => {
      const m = block.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
      return m ? m[1].trim().replace(/^['"]|['"]$/g, "") : "";
    };
    if (pick("draft") === "true") continue;
    const slug = pick("slug") || name.replace(/\.md$/i, "");
    const lastmod = pick("updatedDate") || pick("date");
    if (slug && lastmod) {
      map.set(`/articles/${slug}/`, lastmod);
    }
  }
  return map;
}

const lastmodByPath = articleLastmodMap();

export default defineConfig({
  site: SITE_URL,
  output: "static",
  trailingSlash: "always",
  integrations: [
    tailwind(),
    sitemap({
      filter: (page) => !page.includes("/404"),
      serialize(item) {
        try {
          const url = new URL(item.url);
          const lastmod = lastmodByPath.get(url.pathname);
          if (lastmod) {
            item.lastmod = lastmod;
          }
        } catch {
          // keep default
        }
        return item;
      },
    }),
  ],
  markdown: {
    remarkPlugins: [remarkPreserveHtmlComments],
    rehypePlugins: [rehypeSlug, rehypePreserveHtmlComments],
  },
});
