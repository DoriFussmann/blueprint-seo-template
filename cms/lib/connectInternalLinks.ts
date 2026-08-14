import type { LinkItem } from "./schema.ts";
import { readAllArticles, type StoredArticle } from "./readContent.ts";
import { applyInternalLinks } from "./applyLinks.ts";
import { pagePath } from "../../site/src/lib/url.ts";

export interface RequiredLink {
  slug: string;
  title: string;
  url: string;
  reason: string;
}

function published(): StoredArticle[] {
  return readAllArticles().filter((row) => !row.data.draft);
}

function isPillar(row: StoredArticle): boolean {
  return (
    row.data.articleType === "comprehensive" && !row.data.supportingKeyword
  );
}

function articleUrl(slug: string): string {
  return pagePath(`/articles/${slug}`);
}

export function requiredInternalLinks(article: StoredArticle): RequiredLink[] {
  if (article.data.draft) return [];
  const others = published().filter((row) => row.slug !== article.slug);
  const required: RequiredLink[] = [];
  const seen = new Set<string>();
  const add = (row: StoredArticle, reason: string) => {
    if (seen.has(row.slug)) return;
    seen.add(row.slug);
    required.push({
      slug: row.slug,
      title: row.data.title,
      url: articleUrl(row.slug),
      reason,
    });
  };

  if (isPillar(article) && article.data.pillarKeyword) {
    const clusters = new Map<string, StoredArticle[]>();
    for (const row of others) {
      if (row.data.pillarKeyword !== article.data.pillarKeyword) continue;
      const cluster = row.data.supportingKeyword;
      if (!cluster) continue;
      const list = clusters.get(cluster) || [];
      list.push(row);
      clusters.set(cluster, list);
    }
    for (const [cluster, rows] of clusters) {
      const comprehensive = rows.find((row) => row.data.articleType === "comprehensive");
      if (comprehensive) {
        add(
          comprehensive,
          `cluster comprehensive for supporting keyword "${cluster}"`
        );
      }
    }
  }

  if (article.data.supportingKeyword) {
    const pillar = others.find(
      (row) =>
        isPillar(row) && row.data.pillarKeyword === article.data.pillarKeyword
    );
    if (pillar) add(pillar, "pillar article for this supporting keyword");
    for (const row of others) {
      if (row.data.supportingKeyword === article.data.supportingKeyword) {
        add(row, "cluster sibling");
      }
    }
  }

  return required;
}

export function missingInternalLinks(article: StoredArticle): RequiredLink[] {
  const have = new Set(
    (article.data.internalLinks || []).map((link) => normalizeUrl(link.url))
  );
  return requiredInternalLinks(article).filter(
    (req) => !have.has(normalizeUrl(req.url)) && !have.has(req.slug)
  );
}

function normalizeUrl(url: string): string {
  return String(url || "")
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

export function connectArticle(slug: string): {
  slug: string;
  added: RequiredLink[];
  internalLinks: LinkItem[];
} {
  const article = published().find((row) => row.slug === slug);
  if (!article) throw new Error(`Published article "${slug}" not found`);
  const missing = missingInternalLinks(article);
  const next: LinkItem[] = [
    ...(article.data.internalLinks || []),
    ...missing.map((row) => ({ label: row.title, url: row.url })),
  ];
  const unique: LinkItem[] = [];
  const seen = new Set<string>();
  for (const link of next) {
    const key = normalizeUrl(link.url);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(link);
  }
  applyInternalLinks(article, unique);
  return { slug, added: missing, internalLinks: unique };
}

export function connectAll(): Array<ReturnType<typeof connectArticle>> {
  const results = [];
  for (const row of published()) {
    results.push(connectArticle(row.slug));
  }
  return results;
}

export function linkHealth(article: StoredArticle): "green" | "orange" | "red" {
  const missing = missingInternalLinks(article);
  const ext = (article.data.externalLinks || []).length;
  if (ext <= 1 || missing.length > 0) return "red";
  if (ext >= 3 && missing.length === 0) return "green";
  return "orange";
}
