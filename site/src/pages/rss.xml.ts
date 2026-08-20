import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import MarkdownIt from "markdown-it";
import type { APIContext } from "astro";
import { ARTICLES_BASE, SITE_NAME, SITE_TAGLINE, SITE_URL } from "../config/site";
import { abs } from "../lib/url";

const parser = new MarkdownIt();

export async function GET(context: APIContext) {
  const articles = (await getCollection("articles", ({ data }) => data.draft !== true)).sort(
    (a, b) => (b.data.updatedDate || b.data.date).localeCompare(a.data.updatedDate || a.data.date),
  );
  return rss({
    title: SITE_NAME,
    description: SITE_TAGLINE,
    site: context.site ?? SITE_URL,
    trailingSlash: true,
    items: articles.map((article) => ({
      title: article.data.title,
      description: article.data.description,
      pubDate: new Date(`${article.data.date}T00:00:00.000Z`),
      link: `/${ARTICLES_BASE}/${article.id}/`,
      content: parser.render(article.body),
    })),
  });
}
