import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { SITE_NAME } from "../config/site";
import { absoluteUrl } from "../lib/url";

export async function GET() {
  const articles = (await getCollection("articles"))
    .filter((entry) => !entry.data.draft)
    .sort((a, b) => +b.data.date - +a.data.date);

  return rss({
    title: SITE_NAME,
    description: `Articles from ${SITE_NAME}`,
    site: absoluteUrl("/"),
    trailingSlash: true,
    items: articles.map((entry) => ({
      title: entry.data.title,
      description: entry.data.description,
      pubDate: entry.data.date,
      link: `/articles/${entry.data.slug}/`,
    })),
  });
}
