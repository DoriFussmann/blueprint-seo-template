import { MAX_EXTERNAL_LINKS } from "./constants.ts";
import type { LinkItem } from "./schema.ts";
import type { StoredArticle } from "./readContent.ts";
import { writeArticleFile } from "./writeArticle.ts";
import { isoDate } from "./schema.ts";

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function capExternalLinks(links: LinkItem[]): LinkItem[] {
  if (links.length <= MAX_EXTERNAL_LINKS) return links;
  return links.slice(links.length - MAX_EXTERNAL_LINKS);
}

export function insertSignpost(
  body: string,
  headingPattern: RegExp,
  line: string
): string {
  const text = String(body || "");
  if (text.includes(line.trim())) return text;
  const match = headingPattern.exec(text);
  if (match && match.index != null) {
    return `${text.slice(0, match.index).replace(/\s+$/, "")}\n\n${line}\n\n${text.slice(match.index)}`;
  }
  return `${text.replace(/\s+$/, "")}\n\n${line}\n`;
}

export function applyInternalLinks(
  article: StoredArticle,
  links: LinkItem[]
): StoredArticle {
  const signpost =
    links.length > 0
      ? `Related reading: ${links.map((l) => `[${l.label}](${l.url})`).join(", ")}.`
      : "";
  const body = signpost
    ? insertSignpost(article.body, /^##\s+Related(\s+Reads)?\s*$/im, signpost)
    : article.body;
  const data = {
    ...article.data,
    internalLinks: links,
    updatedDate: todayIso(),
  };
  writeArticleFile(article.slug, data, body);
  return { ...article, data, body };
}

export function applyExternalLinks(
  article: StoredArticle,
  incoming: LinkItem[],
  updatedDate?: string
): StoredArticle {
  const merged = capExternalLinks([
    ...(article.data.externalLinks || []),
    ...incoming.filter(
      (link) =>
        !(article.data.externalLinks || []).some((existing) => existing.url === link.url)
    ),
  ]);
  const added = incoming.filter((link) =>
    merged.some((row) => row.url === link.url)
  );
  const signpost =
    added.length > 0
      ? `Sources for this article include ${added.map((l) => `[${l.label}](${l.url})`).join(", ")}.`
      : "";
  const body = signpost
    ? insertSignpost(article.body, /^##\s+Sources\s*$/im, signpost)
    : article.body;
  const data = {
    ...article.data,
    externalLinks: merged,
    updatedDate: isoDate(updatedDate) || todayIso(),
  };
  writeArticleFile(article.slug, data, body);
  return { ...article, data, body };
}
