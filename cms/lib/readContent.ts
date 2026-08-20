import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { ARTICLES_DIR, DIST_DIR, TEAM_DIR } from "./paths";
import { coerceDate } from "./coerceDate";

export interface ArticleRecord {
  slug: string;
  data: Record<string, unknown>;
  body: string;
  path: string;
}

export function sortByDates<T extends { data: Record<string, unknown> }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const da = String(a.data.updatedDate || a.data.date || "");
    const db = String(b.data.updatedDate || b.data.date || "");
    return db.localeCompare(da);
  });
}

export function readArticles(): ArticleRecord[] {
  if (!existsSync(ARTICLES_DIR)) return [];
  const items = readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const path = join(ARTICLES_DIR, file);
      const raw = readFileSync(path, "utf8");
      const parsed = matter(raw);
      const data = { ...parsed.data } as Record<string, unknown>;
      const date = coerceDate(data.date);
      if (date) data.date = date;
      const updated = coerceDate(data.updatedDate);
      if (updated) data.updatedDate = updated;
      return { slug: file.replace(/\.md$/, ""), data, body: parsed.content, path };
    });
  return sortByDates(items);
}

export function readArticle(slug: string): ArticleRecord | null {
  return readArticles().find((a) => a.slug === slug) ?? null;
}

export function publishedArticles(): ArticleRecord[] {
  return readArticles().filter((a) => a.data.draft !== true);
}

export function readTeam(): { slug: string; data: Record<string, unknown>; body: string }[] {
  if (!existsSync(TEAM_DIR)) return [];
  return readdirSync(TEAM_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const raw = readFileSync(join(TEAM_DIR, file), "utf8");
      const parsed = matter(raw);
      return { slug: file.replace(/\.md$/, ""), data: parsed.data as Record<string, unknown>, body: parsed.content };
    });
}

export function distHasSlug(slug: string): boolean {
  const sitemap = join(DIST_DIR, "sitemap-0.xml");
  const index = join(DIST_DIR, "sitemap-index.xml");
  const hay = [sitemap, index]
    .filter((p) => existsSync(p))
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");
  return hay.includes(`/${slug}/`);
}

export function distJsonLd(slug: string): { ok: boolean; reason?: string } {
  const htmlPath = join(DIST_DIR, "articles", slug, "index.html");
  if (!existsSync(htmlPath)) return { ok: false, reason: "not in dist" };
  const html = readFileSync(htmlPath, "utf8");
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!match) return { ok: false, reason: "no json-ld" };
  try {
    JSON.parse(match[1]);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}
