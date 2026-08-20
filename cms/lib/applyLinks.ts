import {
  EXTERNAL_END,
  EXTERNAL_START,
  INTERNAL_END,
  INTERNAL_START,
  MAX_EXTERNAL_LINKS,
} from "./constants";
import { ARTICLES_BASE, SITE_URL } from "../../site/src/config/site.ts";

function escapeRe(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function upsertBlock(body: string, start: string, end: string, inner: string): string {
  const block = inner.trim() ? `${start}\n${inner.trim()}\n${end}` : "";
  const re = new RegExp(`${escapeRe(start)}[\\s\\S]*?${escapeRe(end)}\\n?`);
  if (re.test(body)) {
    return body.replace(re, block ? `${block}\n` : "");
  }
  if (!block) return body;
  const related = /^## Related\b/m;
  if (related.test(body)) return body.replace(related, `${block}\n\n## Related`);
  return `${body.replace(/\s*$/, "")}\n\n${block}\n`;
}

export function applyInternalSignpost(
  body: string,
  links: { slug: string; anchor: string }[],
): string {
  const inner = links
    .map((link) => `[${link.anchor}](/${ARTICLES_BASE}/${link.slug}/)`)
    .join(" · ");
  const line = inner ? `Further reading: ${inner}.` : "";
  return upsertBlock(body, INTERNAL_START, INTERNAL_END, line);
}

export function applyExternalSignpost(
  body: string,
  links: { label: string; url: string }[],
): string {
  const inner = links.map((link) => `[${link.label}](${link.url})`).join(" · ");
  const line = inner ? `Sources: ${inner}.` : "";
  return upsertBlock(body, EXTERNAL_START, EXTERNAL_END, line);
}

export function trimExternalLinks<T extends { addedAt: string }>(links: T[]): T[] {
  if (links.length <= MAX_EXTERNAL_LINKS) return links;
  const sorted = [...links].sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  const drop = sorted.length - MAX_EXTERNAL_LINKS;
  const removed = new Set(sorted.slice(0, drop));
  return links.filter((link) => !removed.has(link));
}

export function ownHost(): string {
  try {
    return new URL(SITE_URL).hostname.replace(/^www\./, "");
  } catch {
    return "example.com";
  }
}
