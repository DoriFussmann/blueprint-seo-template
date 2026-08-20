import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SITE_URL } from "../../site/src/config/site.ts";
import { serpResults } from "./providers/dataforseo.js";
import { CACHE_TTL_MS } from "./constants";
import { ownHost, trimExternalLinks } from "./applyLinks";
import { todayIso } from "./coerceDate";
import { SERP_CACHE_DIR, SOURCES_FILE } from "./paths";
import { publishedArticles, type ArticleRecord } from "./readContent";
import { writeArticle } from "./writeArticle";

interface SerpItem {
  type?: string;
  rank?: number | null;
  title?: string | null;
  url?: string | null;
  domain?: string | null;
  description?: string | null;
}

interface SourcesFile {
  allow?: string[];
  deny?: string[];
}

function loadSources(): SourcesFile {
  if (!existsSync(SOURCES_FILE)) return { allow: [], deny: [] };
  return JSON.parse(readFileSync(SOURCES_FILE, "utf8")) as SourcesFile;
}

function cachePath(slug: string) {
  return join(SERP_CACHE_DIR, `${slug}.json`);
}

function readCache(slug: string): { fetchedAt: string; items: SerpItem[] } | null {
  const path = cachePath(slug);
  if (!existsSync(path)) return null;
  try {
    const json = JSON.parse(readFileSync(path, "utf8")) as { fetchedAt: string; items: SerpItem[] };
    if (Date.now() - new Date(json.fetchedAt).getTime() > CACHE_TTL_MS) return null;
    return json;
  } catch {
    return null;
  }
}

function writeCache(slug: string, items: SerpItem[]) {
  mkdirSync(SERP_CACHE_DIR, { recursive: true });
  writeFileSync(cachePath(slug), JSON.stringify({ slug, fetchedAt: new Date().toISOString(), items }, null, 2));
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function tokens(phrase: string): string[] {
  return phrase
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 3);
}

function relevant(item: SerpItem, keyword: string): boolean {
  const hay = `${item.title || ""} ${item.description || ""}`.toLowerCase();
  const parts = tokens(keyword);
  if (!parts.length) return true;
  return parts.some((t) => hay.includes(t));
}

function bodyUrls(body: string): string[] {
  const urls: string[] = [];
  const re = /https?:\/\/[^\s)\]>"]+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body))) urls.push(match[0].replace(/[.,;]+$/, ""));
  return urls;
}

async function headOk(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { method: "HEAD", signal: controller.signal, redirect: "follow" });
    return res.status === 200;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function countUncachedSerpCalls(): number {
  return publishedArticles().filter((a) => !readCache(a.slug)).length;
}

export async function searchExternalLinks(onProgress?: (msg: string) => void) {
  const sources = loadSources();
  const deny = new Set((sources.deny || []).map((d) => d.replace(/^www\./, "")));
  const allow = new Set((sources.allow || []).map((d) => d.replace(/^www\./, "")));
  const host = ownHost();
  const articles = publishedArticles();
  const rows = [];

  let i = 0;
  for (const article of articles) {
    i += 1;
    onProgress?.(`Searching ${i} of ${articles.length}: ${article.slug}`);
    const targetKeyword = String(article.data.targetKeyword || article.data.title || "");
    const pillarKeyword = String(article.data.pillarKeyword || "");
    const query = `${targetKeyword} ${pillarKeyword} guide OR resource OR statistics`.trim();

    const seeded: SerpItem[] = [];
    for (const link of (article.data.externalLinks as { label: string; url: string }[]) || []) {
      seeded.push({ title: link.label, url: link.url, domain: domainOf(link.url) });
    }
    for (const url of bodyUrls(article.body)) {
      seeded.push({ title: url, url, domain: domainOf(url) });
    }

    const cached = readCache(article.slug);
    let serpItems: SerpItem[] = cached?.items ?? [];
    let available = true;
    let reason: string | undefined;
    let fromCache = Boolean(cached);

    if (!cached) {
      const result = await serpResults({ keyword: query, depth: 10 });
      if (!result.available) {
        available = false;
        reason = result.reason;
      } else {
        serpItems = result.items || [];
        writeCache(article.slug, serpItems);
      }
    }

    const pool = [...seeded, ...serpItems];
    const picked: { title: string; url: string; domain: string }[] = [];
    const seen = new Set<string>();
    for (const item of pool) {
      if (!item.url) continue;
      const domain = (item.domain || domainOf(item.url)).replace(/^www\./, "");
      if (!domain || domain === host || deny.has(domain)) continue;
      if (allow.size && !allow.has(domain) && !seeded.includes(item) && item !== seeded.find((s) => s.url === item.url)) {
        // allow list is preference, not a hard filter for SERP
      }
      if (seen.has(domain)) continue;
      if (!relevant(item, `${targetKeyword} ${pillarKeyword}`)) continue;
      const ok = await headOk(item.url);
      if (!ok) continue;
      seen.add(domain);
      picked.push({ title: String(item.title || item.url), url: item.url, domain });
      if (picked.length >= 3) break;
    }

    rows.push({
      slug: article.slug,
      title: article.data.title,
      available,
      reason,
      fromCache,
      candidates: picked,
    });
  }

  return { siteUrl: SITE_URL, rows };
}

export function connectExternalLinks(
  selections: { slug: string; links: { label: string; url: string }[] }[],
): { updated: string[] } {
  const updated: string[] = [];
  const today = todayIso();
  for (const sel of selections) {
    const article = publishedArticles().find((a) => a.slug === sel.slug);
    if (!article) continue;
    const existing = Array.isArray(article.data.externalLinks)
      ? ([...article.data.externalLinks] as { label: string; url: string; addedAt: string }[])
      : [];
    for (const link of sel.links) {
      if (existing.some((e) => e.url === link.url)) continue;
      existing.push({ label: link.label, url: link.url, addedAt: today });
    }
    const next = trimExternalLinks(existing);
    const result = writeArticle({
      data: { ...article.data, externalLinks: next },
      body: article.body,
      slug: article.slug,
    });
    if (result.changed) updated.push(article.slug);
  }
  return { updated };
}

export type { ArticleRecord };
