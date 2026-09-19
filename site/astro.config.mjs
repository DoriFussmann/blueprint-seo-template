import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import { defineConfig } from "astro/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ARTICLES_BASE, SITE_URL } from "./src/config/site";
import { rehypeEmitWtsComments, rehypeKeyTakeaways, remarkPreserveWts, toIsoDateString } from "seo-core";

function frontmatterBlock(raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  return match ? match[1] : "";
}

function frontmatterScalar(fm, key) {
  const match = new RegExp(`^${key}:\\s*(.+?)\\s*$`, "m").exec(fm);
  if (!match) return undefined;
  let value = match[1];
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value;
}

/** lastmod from the same Date / YYYY-MM-DD / datetime values the article schema accepts. */
function articleLastmodMap() {
  const dir = join("src", "content", "articles");
  const map = new Map();
  try {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".md")) continue;
      const raw = readFileSync(join(dir, file), "utf8");
      const fm = frontmatterBlock(raw);
      if (frontmatterScalar(fm, "draft") === "true") continue;
      const slug = file.replace(/\.md$/, "");
      const lastmod =
        toIsoDateString(frontmatterScalar(fm, "updatedDate")) ||
        toIsoDateString(frontmatterScalar(fm, "date"));
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
  vite: {
    ssr: {
      noExternal: ["seo-core"],
    },
  },
  markdown: {
    remarkPlugins: [remarkPreserveWts],
    rehypePlugins: [rehypeEmitWtsComments, rehypeKeyTakeaways],
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
