import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

export async function getStaticPaths() {
  const articles = await getCollection("articles", ({ data }) => data.draft !== true);
  return articles.map((article) => ({
    params: { slug: article.id },
    props: { article },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { article } = props;
  const header = [
    `# ${article.data.title}`,
    "",
    article.data.description,
    "",
    `Date: ${article.data.date}`,
    `Author: ${article.data.author}`,
    "",
    "",
  ].join("\n");
  const body = `${header}${article.body.replace(/^\n+/, "")}\n`;
  return new Response(body, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
