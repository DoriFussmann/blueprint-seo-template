import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { normalizeIntake, type ArticleFrontmatter } from "./schema.ts";
import { ARTICLES_DIR, SERVICES_DIR, TEAM_DIR, articleFilePath } from "./paths.ts";

export interface StoredArticle {
  slug: string;
  filename: string;
  data: ArticleFrontmatter;
  body: string;
  raw: string;
}

export function listMarkdown(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.endsWith(".md"));
}

export function readArticle(slug: string): StoredArticle | null {
  const filename = `${slug}.md`;
  const filePath = articleFilePath(slug);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);
  const data = normalizeIntake(parsed.data as Record<string, unknown>);
  data.slug = data.slug || slug;
  return { slug: data.slug, filename, data, body: parsed.content, raw };
}

export function readAllArticles(): StoredArticle[] {
  return listMarkdown(ARTICLES_DIR)
    .map((filename) => {
      const slug = filename.replace(/\.md$/i, "");
      return readArticle(slug);
    })
    .filter((row): row is StoredArticle => Boolean(row));
}

export function knownSlugs() {
  return {
    articles: listMarkdown(ARTICLES_DIR).map((name) => name.replace(/\.md$/i, "")),
    team: listMarkdown(TEAM_DIR).map((name) => name.replace(/\.md$/i, "")),
    services: listMarkdown(SERVICES_DIR).map((name) => name.replace(/\.md$/i, "")),
  };
}

export function readTeamMembers() {
  return listMarkdown(TEAM_DIR).map((filename) => {
    const slug = filename.replace(/\.md$/i, "");
    const raw = fs.readFileSync(path.join(TEAM_DIR, filename), "utf8");
    const parsed = matter(raw);
    return { slug, filename, data: parsed.data, body: parsed.content };
  });
}

export function readServices() {
  return listMarkdown(SERVICES_DIR).map((filename) => {
    const slug = filename.replace(/\.md$/i, "");
    const raw = fs.readFileSync(path.join(SERVICES_DIR, filename), "utf8");
    const parsed = matter(raw);
    return { slug, filename, data: parsed.data, body: parsed.content };
  });
}
