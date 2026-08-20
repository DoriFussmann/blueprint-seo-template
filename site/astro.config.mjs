import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import { defineConfig } from "astro/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ARTICLES_BASE, SITE_URL } from "./src/config/site";
import { rehypeEmitWtsComments, remarkPreserveWts } from "./src/lib/wts-comments";

function articleLastmodMap() {
  const dir = join("src", "content", "articles");
    const map = new Map();
  try {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".md")) continue;
      const raw = readFileSync(join(dir, file), "utf8");
      if (/^draft:\s*true\s*$/m.test(raw)) continue;
      const slug = file.replace(/\.md$/, "");
      const date = raw.match(/^date:\s*"?(\d{4}-\d{2}-\d{2})"?/m)?.[1];
      const updated = raw.match(/^updatedDate:\s*"?(\d{4}-\d{2}-\d{2})"?/m)?.[1];
      const lastmod = updated || date;
      if (lastmod) map.set(`/${ARTICLES_BASE}/${slug}/`, lastmod);
    }
  } catch {
    // content dir may be empty on first clone
  }
  return map;
}

export default defineConfig({
  site: SITE_URL,
  output: "static",
  trailingSlash: "always",
  prefetch: { prefetchAll: false, defaultStrategy: "hover" },
  redirects: {},
  markdown: {
    remarkPlugins: [remarkPreserveWts],
    rehypePlugins: [rehypeEmitWtsComments],
  },
  integrations: [
    tailwind(),
    sitemap({
      filter: (page) => !page.includes("/404"),
      serialize(item) {
        const dates = articleLastmodMap();
        const url = new URL(item.url);
        const path = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
      const lastmod = dates.get(path);
        if (lastmod) item.lastmod = lastmod;
        return item;
      },
    }),
  ],
});
