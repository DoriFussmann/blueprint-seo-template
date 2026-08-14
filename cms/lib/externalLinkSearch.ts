import fs from "node:fs";
import { SOURCES_PATH } from "./paths.ts";
import { serpResults, type SerpItem } from "./dataforseo.ts";
import { isBlockedExternal } from "./validateFrontmatter.ts";
import type { StoredArticle } from "./readContent.ts";
import type { LinkItem } from "./schema.ts";

export interface Candidate {
  label: string;
  url: string;
  source: "preseeded" | "body" | "local" | "serp";
  confidence: "high" | "medium" | "low";
  reason?: string;
}

function tokensOf(article: StoredArticle): string[] {
  return [article.data.targetKeyword, article.data.pillarKeyword]
    .map((value) => String(value || "").toLowerCase().trim())
    .filter(Boolean);
}

export function isOnTopic(article: StoredArticle, title: string, url: string, description = ""): boolean {
  const tokens = tokensOf(article);
  if (tokens.length === 0) return true;
  const hay = `${title} ${url} ${description}`.toLowerCase();
  return tokens.some((token) => {
    const parts = token.split(/\s+/).filter((p) => p.length > 2);
    if (hay.includes(token)) return true;
    return parts.length > 0 && parts.every((part) => hay.includes(part));
  });
}

function readLocalSources(): Array<{ title?: string; label?: string; url: string; slug?: string }> {
  if (!fs.existsSync(SOURCES_PATH)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(SOURCES_PATH, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function bodyLinks(body: string): LinkItem[] {
  const matches = String(body || "").matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g);
  const out: LinkItem[] = [];
  for (const match of matches) {
    out.push({ label: match[1], url: match[2] });
  }
  return out;
}

function asCandidate(
  label: string,
  url: string,
  source: Candidate["source"],
  confidence: Candidate["confidence"]
): Candidate | null {
  if (!url || isBlockedExternal(url)) return null;
  return { label: label || url, url, source, confidence };
}

export async function proposeExternalLinks(
  article: StoredArticle
): Promise<{ candidates: Candidate[]; skipped: string[] }> {
  const skipped: string[] = [];
  const existing = new Set(
    (article.data.externalLinks || []).map((link) => link.url)
  );
  const collected: Candidate[] = [];
  const add = (candidate: Candidate | null) => {
    if (!candidate || existing.has(candidate.url)) return;
    if (collected.some((row) => row.url === candidate.url)) return;
    if (!isOnTopic(article, candidate.label, candidate.url)) return;
    collected.push(candidate);
  };

  const local = readLocalSources();
  for (const row of local.filter((item) => item.slug === article.slug)) {
    add(
      asCandidate(
        String(row.title || row.label || ""),
        String(row.url || ""),
        "preseeded",
        "high"
      )
    );
  }

  for (const link of bodyLinks(article.body)) {
    add(asCandidate(link.label, link.url, "body", "medium"));
  }

  for (const row of local.filter((item) => !item.slug)) {
    add(
      asCandidate(
        String(row.title || row.label || ""),
        String(row.url || ""),
        "local",
        "medium"
      )
    );
  }

  if (collected.length === 0) {
    const query = `"${article.data.targetKeyword || ""} ${article.data.pillarKeyword || ""} guide OR resource OR statistics"`.trim();
    const result = await serpResults({ keyword: query, depth: 10 });
    if (!result.available) {
      skipped.push(result.reason || "DataForSEO unavailable");
    } else {
      for (const item of result.items as SerpItem[]) {
        if (!item.url) continue;
        const onTopic = isOnTopic(
          article,
          item.title || "",
          item.url,
          item.description || ""
        );
        if (!onTopic) continue;
        add(
          asCandidate(
            item.title || item.url,
            item.url,
            "serp",
            (item.rank || 99) <= 5 ? "high" : "medium"
          )
        );
      }
    }
  }

  return { candidates: collected.slice(0, 10), skipped };
}
