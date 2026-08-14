import { SITE_URL } from "../../site/src/config/site.ts";
import { PLACEHOLDER_IMAGE_RE } from "./constants.ts";
import {
  ARTICLE_TYPES,
  type ArticleFrontmatter,
  type LinkItem,
} from "./schema.ts";

export interface FieldIssue {
  field: string;
  message: string;
}

export interface ChecklistItem {
  field: string;
  valid: boolean;
  value: unknown;
  message: string;
}

export interface ValidationResult {
  missing: FieldIssue[];
  checklist: ChecklistItem[];
  warnings: FieldIssue[];
}

function push(
  list: FieldIssue[],
  field: string,
  message: string,
  cond: boolean
) {
  if (cond) list.push({ field, message });
}

function item(
  field: string,
  valid: boolean,
  value: unknown,
  message: string
): ChecklistItem {
  return { field, valid, value, message };
}

export function isStagedHeroSatisfied(stagedThisSession: boolean): boolean {
  return stagedThisSession;
}

export function imagePathLooksFake(value: string | null | undefined): boolean {
  const text = String(value || "");
  if (!text) return true;
  return PLACEHOLDER_IMAGE_RE.test(text);
}

export function validateFrontmatter(
  data: ArticleFrontmatter,
  options: {
    stagedHero: boolean;
    knownSlugs: { articles: string[]; team: string[]; services: string[] };
    existingSlugs: string[];
    isEdit?: boolean;
  }
): ValidationResult {
  const missing: FieldIssue[] = [];
  const warnings: FieldIssue[] = [];
  const checklist: ChecklistItem[] = [];

  const titleLen = data.title.length;
  const titleOk = titleLen >= 55 && titleLen <= 60;
  push(missing, "title", `title must be 55–60 characters (now ${titleLen})`, !titleOk);
  checklist.push(
    item("title", titleOk, data.title, `${titleLen} characters (need 55–60)`)
  );

  const descLen = data.description.length;
  const descOk = descLen >= 140 && descLen <= 160;
  push(
    missing,
    "description",
    `description must be 140–160 characters (now ${descLen})`,
    !descOk
  );
  checklist.push(
    item(
      "description",
      descOk,
      data.description,
      `${descLen} characters (need 140–160)`
    )
  );

  const slugOk = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug);
  push(missing, "slug", "slug is required and must be lowercase kebab-case", !slugOk);
  checklist.push(item("slug", slugOk, data.slug, slugOk ? "ok" : "invalid slug"));

  if (slugOk && !options.isEdit && options.existingSlugs.includes(data.slug)) {
    push(missing, "slug", `slug "${data.slug}" already exists`, true);
  }

  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(data.date);
  push(missing, "date", "date must be YYYY-MM-DD", !dateOk);
  checklist.push(item("date", dateOk, data.date, dateOk ? "ok" : "invalid date"));

  const authorOk = Boolean(data.author);
  push(missing, "author", "author is required (team slug)", !authorOk);
  checklist.push(
    item("author", authorOk, data.author, authorOk ? "ok" : "missing (upstream null)")
  );

  const categoryOk = Boolean(data.category);
  push(missing, "category", "category is required", !categoryOk);
  checklist.push(
    item("category", categoryOk, data.category, categoryOk ? "ok" : "missing")
  );

  const tagsOk = data.tags.length >= 4 && data.tags.length <= 6;
  push(missing, "tags", `tags must be 4–6 (now ${data.tags.length})`, !tagsOk);
  checklist.push(
    item("tags", tagsOk, data.tags, `${data.tags.length} tags (need 4–6)`)
  );

  const altOk = data.imageAlt.length >= 10;
  push(missing, "imageAlt", "imageAlt must be at least 10 characters", !altOk);
  checklist.push(
    item(
      "imageAlt",
      altOk,
      data.imageAlt,
      altOk ? "ok" : `${data.imageAlt.length} characters`
    )
  );

  const heroOk =
    options.stagedHero ||
    Boolean(options.isEdit && data.image && !imagePathLooksFake(String(data.image)));
  push(
    missing,
    "image",
    "hero image must be dropped this session (or zip-paired). A path already in the file does not count.",
    !heroOk
  );
  checklist.push(
    item(
      "image",
      heroOk,
      data.image,
      heroOk
        ? "staged this session"
        : imagePathLooksFake(data.image)
          ? "placeholder/missing path ignored"
          : "existing path ignored until a file is dropped"
    )
  );

  if (data.h1 && data.h1.length < 20) {
    checklist.push(item("h1", false, data.h1, "h1 is optional but must be ≥20 if set"));
  } else {
    checklist.push(
      item("h1", true, data.h1 || data.title, "optional; falls back to title")
    );
  }

  if (data.articleType && !ARTICLE_TYPES.includes(data.articleType as any)) {
    warnings.push({
      field: "articleType",
      message: `unexpected articleType "${data.articleType}"`,
    });
  }

  for (const [i, link] of (data.internalLinks || []).entries()) {
    const ok = Boolean(link.label && link.url);
    if (!ok) {
      push(missing, `internalLinks.${i}`, "label and url required", true);
    }
    const warning = unmatchedInternal(link, options.knownSlugs);
    if (warning) warnings.push({ field: `internalLinks.${i}`, message: warning });
    checklist.push(
      item(`internalLinks.${i}`, ok, link, warning || (ok ? "ok" : "incomplete"))
    );
  }

  for (const [i, link] of (data.externalLinks || []).entries()) {
    const ok = Boolean(link.label && link.url);
    const blocked = isBlockedExternal(link.url);
    if (!ok) push(missing, `externalLinks.${i}`, "label and url required", true);
    if (blocked) {
      push(
        missing,
        `externalLinks.${i}`,
        "external URL must not resolve to this site or example.com",
        true
      );
    }
    checklist.push(
      item(
        `externalLinks.${i}`,
        ok && !blocked,
        link,
        blocked ? "blocked domain" : ok ? "ok" : "incomplete"
      )
    );
  }

  for (const [i, faq] of (data.faqs || []).entries()) {
    const ok = Boolean(faq.question && faq.answer);
    if (!ok) push(missing, `faqs.${i}`, "question and answer required", true);
    checklist.push(item(`faqs.${i}`, ok, faq, ok ? "ok" : "incomplete"));
  }

  return { missing, checklist, warnings };
}

export function isBlockedExternal(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
    let siteHost = "example.com";
    try {
      siteHost = new URL(SITE_URL).hostname.replace(/^www\./i, "").toLowerCase();
    } catch {
      // keep default
    }
    return host === "example.com" || host === siteHost;
  } catch {
    return true;
  }
}

function unmatchedInternal(
  link: LinkItem,
  known: { articles: string[]; team: string[]; services: string[] }
): string | null {
  const url = String(link.url || "");
  const match = url.match(/\/(articles|team|services)\/([^/]+)\/?/);
  if (!match) return `URL does not match a known collection path`;
  const [, collection, slug] = match;
  const list =
    collection === "articles"
      ? known.articles
      : collection === "team"
        ? known.team
        : known.services;
  if (!list.includes(slug)) return `no ${collection} entry with slug "${slug}"`;
  return null;
}
