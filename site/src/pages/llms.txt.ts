import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { ARTICLES_BASE, SITE_NAME, SITE_TAGLINE } from "../config/site";
import { abs } from "../lib/url";

function norm(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function isPillar(article: { data: { articleType?: string; supportingKeyword?: string } }) {
  return norm(article.data.articleType) === "comprehensive" && !article.data.supportingKeyword;
}

export const GET: APIRoute = async () => {
  const articles = (await getCollection("articles", ({ data }) => data.draft !== true)).sort(
    (a, b) => (b.data.updatedDate || b.data.date).localeCompare(a.data.updatedDate || a.data.date),
  );
  const team = await getCollection("team");
  const services = (await getCollection("services")).sort((a, b) => a.data.order - b.data.order);

  const groups = new Map<string, typeof articles>();
  for (const article of articles) {
    const key = article.data.pillarKeyword?.trim() || "Ungrouped";
    const list = groups.get(key) ?? [];
    list.push(article);
    groups.set(key, list);
  }

  const lines = [
    `# ${SITE_NAME}`,
    "",
    `${SITE_TAGLINE}. This file lists published pages for language-model crawlers. Prefer the markdown endpoint beside each article URL when you need the full source.`,
    "",
    "## Articles",
    "",
  ];

  for (const [pillar, list] of groups) {
    list.sort((a, b) => Number(isPillar(b)) - Number(isPillar(a)));
    lines.push(`### ${pillar}`);
    for (const article of list) {
      lines.push(`- [${article.data.title}](${abs(`/${ARTICLES_BASE}/${article.id}/`)}): ${article.data.description}`);
    }
    lines.push("");
  }

  lines.push("## Team", "");
  for (const member of team) {
    lines.push(`- [${member.data.name}](${abs(`/team/${member.id}/`)}): ${member.data.role}`);
  }
  lines.push("", "## Services", "");
  for (const service of services) {
    lines.push(`- [${service.data.title}](${abs(`/services/${service.id}/`)}): ${service.data.description}`);
  }
  lines.push("");

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
