import { ARTICLES_BASE } from "../../site/src/config/site.ts";
import { publishedArticles, type ArticleRecord } from "./readContent";
import { writeArticle } from "./writeArticle";

function norm(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isPillar(article: ArticleRecord): boolean {
  return norm(article.data.articleType) === "comprehensive" && !article.data.supportingKeyword;
}

function sortKey(article: ArticleRecord): string {
  return String(article.data.updatedDate || article.data.date || "");
}

function anchorFor(target: ArticleRecord): string {
  const kw = String(target.data.targetKeyword || "").trim();
  return kw || String(target.data.title || target.slug);
}

function addLink(
  map: Map<string, Map<string, string>>,
  from: string,
  to: ArticleRecord,
) {
  if (from === to.slug) return;
  if (!map.has(from)) map.set(from, new Map());
  map.get(from)!.set(to.slug, anchorFor(to));
}

export function planInternalLinks(articles = publishedArticles()) {
  const desired = new Map<string, Map<string, string>>();
  const pillars = articles.filter(isPillar);

  for (const pillar of pillars) {
    const pk = norm(pillar.data.pillarKeyword);
    for (const other of articles) {
      if (norm(other.data.pillarKeyword) === pk) addLink(desired, pillar.slug, other);
    }
  }

  for (const article of articles) {
    if (isPillar(article)) continue;
    const pk = norm(article.data.pillarKeyword);
    const pillar = pillars.find((p) => norm(p.data.pillarKeyword) === pk);
    if (pillar) addLink(desired, article.slug, pillar);
  }

  const siblingGroups = new Map<string, ArticleRecord[]>();
  for (const article of articles) {
    const sk = norm(article.data.supportingKeyword);
    const pk = norm(article.data.pillarKeyword);
    if (!sk || !pk) continue;
    const key = `${pk}::${sk}`;
    const list = siblingGroups.get(key) ?? [];
    list.push(article);
    siblingGroups.set(key, list);
  }
  for (const group of siblingGroups.values()) {
    for (const a of group) {
      for (const b of group) addLink(desired, a.slug, b);
    }
  }

  if (pillars.length <= 6) {
    for (const a of pillars) {
      for (const b of pillars) addLink(desired, a.slug, b);
    }
  } else {
    for (const a of pillars) {
      const others = pillars
        .filter((p) => p.slug !== a.slug)
        .sort((x, y) => sortKey(y).localeCompare(sortKey(x)))
        .slice(0, 5);
      for (const b of others) addLink(desired, a.slug, b);
    }
  }

  return desired;
}

export async function connectInternalLinks(): Promise<{
  updated: string[];
  skipped: string[];
}> {
  const articles = publishedArticles();
  const bySlug = new Map(articles.map((a) => [a.slug, a]));
  const desired = planInternalLinks(articles);
  const updated: string[] = [];
  const skipped: string[] = [];

  for (const article of articles) {
    const want = desired.get(article.slug) ?? new Map();
    const existing = Array.isArray(article.data.internalLinks)
      ? (article.data.internalLinks as { slug: string; anchor: string }[])
      : [];
    const have = new Set(existing.map((l) => l.slug));
    const delta = [...want.entries()].filter(([slug]) => !have.has(slug) && bySlug.has(slug));
    if (!delta.length && existing.length === want.size && existing.every((l) => want.has(l.slug))) {
      skipped.push(article.slug);
      continue;
    }
    const merged = [...existing];
    for (const [slug, anchor] of want) {
      if (!merged.some((l) => l.slug === slug)) merged.push({ slug, anchor });
    }
    const next = merged.filter((l) => l.slug === article.slug ? false : true);
    const result = writeArticle({
      data: { ...article.data, internalLinks: next },
      body: article.body,
      slug: article.slug,
    });
    if (result.changed) updated.push(article.slug);
    else skipped.push(article.slug);
  }

  return { updated, skipped };
}

export { ARTICLES_BASE };
