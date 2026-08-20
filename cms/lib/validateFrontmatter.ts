import { DEFAULT_AUTHOR } from "../../site/src/config/site.ts";
import { coerceDate } from "./coerceDate";
import { NO_VOLUME_RE, SLUG_RE } from "./constants";
import { wtsCounts } from "./wts";

export interface IntakeIssue {
  field?: string;
  message: string;
}

export interface IntakeResult {
  ok: boolean;
  errors: IntakeIssue[];
  warnings: IntakeIssue[];
  data: Record<string, unknown>;
  body: string;
  slug: string;
}

function headingLevels(body: string): number[] {
  const levels: number[] = [];
  for (const line of body.split(/\n/)) {
    const match = /^(#{1,6})\s+\S/.exec(line);
    if (match) levels.push(match[1].length);
  }
  return levels;
}

function stripLeadingH1(body: string): { body: string; stripped: boolean } {
  const lines = body.replace(/^\uFEFF/, "").split(/\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i < lines.length && /^#\s+/.test(lines[i]) && !/^##/.test(lines[i])) {
    lines.splice(i, 1);
    if (i < lines.length && lines[i].trim() === "") lines.splice(i, 1);
    return { body: lines.join("\n"), stripped: true };
  }
  return { body: lines.join("\n"), stripped: false };
}

function remainingH1s(body: string): number {
  return body.split(/\n/).filter((line) => /^#\s+/.test(line) && !/^##/.test(line)).length;
}

export function normalizeTargetKeyword(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.replace(NO_VOLUME_RE, "").trim();
}

export function validateFrontmatter(opts: {
  filenameStem: string;
  rawData: Record<string, unknown>;
  rawBody: string;
  draft: boolean;
  authorOverride?: string | null;
}): IntakeResult {
  const errors: IntakeIssue[] = [];
  const warnings: IntakeIssue[] = [];
  const data: Record<string, unknown> = { ...opts.rawData };

  const slug = opts.filenameStem;
  if (!SLUG_RE.test(slug)) {
    errors.push({ field: "slug", message: `Filename stem "${slug}" is not a valid slug` });
  }
  if (typeof data.slug === "string" && data.slug !== slug) {
    errors.push({ field: "slug", message: `Frontmatter slug "${data.slug}" does not match filename stem "${slug}"` });
  }
  data.slug = slug;

  if (data.author == null || data.author === "") {
    data.author = opts.authorOverride || DEFAULT_AUTHOR;
  } else if (opts.authorOverride) {
    data.author = opts.authorOverride;
  }

  data.draft = opts.draft;

  const date = coerceDate(data.date);
  if (!date) errors.push({ field: "date", message: "date is missing or not coercible to YYYY-MM-DD" });
  else data.date = date;

  if (data.updatedDate != null && data.updatedDate !== "") {
    const updated = coerceDate(data.updatedDate);
    if (!updated) errors.push({ field: "updatedDate", message: "updatedDate is not coercible to YYYY-MM-DD" });
    else data.updatedDate = updated;
  } else {
    delete data.updatedDate;
  }

  data.targetKeyword = normalizeTargetKeyword(data.targetKeyword);

  if (typeof data.title !== "string") errors.push({ field: "title", message: "title is required" });
  else if (data.title.length < 55 || data.title.length > 60) {
    errors.push({ field: "title", message: `title must be 55–60 characters (got ${data.title.length})` });
  }

  if (typeof data.description !== "string") errors.push({ field: "description", message: "description is required" });
  else if (data.description.length < 140 || data.description.length > 160) {
    errors.push({ field: "description", message: `description must be 140–160 characters (got ${data.description.length})` });
  }

  if (typeof data.imageAlt !== "string" || data.imageAlt.length < 10) {
    errors.push({ field: "imageAlt", message: "imageAlt must be at least 10 characters" });
  }

  if (!Array.isArray(data.tags) || data.tags.length < 4 || data.tags.length > 6) {
    errors.push({ field: "tags", message: "tags must contain 4–6 strings" });
  }

  if (!Array.isArray(data.internalLinks)) data.internalLinks = [];
  if (!Array.isArray(data.externalLinks)) data.externalLinks = [];
  if (!Array.isArray(data.faqs)) data.faqs = [];

  const stripped = stripLeadingH1(opts.rawBody);
  let body = stripped.body;
  if (remainingH1s(body) > 0) {
    errors.push({ field: "body", message: "A second H1 is not allowed" });
  }

  const levels = headingLevels(body);
  let prev = 1;
  for (const level of levels) {
    if (level > prev + 1) {
      errors.push({ field: "body", message: `Skipped heading level (found h${level} after h${prev})` });
      break;
    }
    prev = level;
  }

  const wts = wtsCounts(body);
  if (wts.heading !== 1) {
    errors.push({ field: "body", message: "Body must contain exactly one ## Where Things Stand heading" });
  }
  if (wts.start !== 1 || wts.end !== 1) {
    errors.push({ field: "body", message: "Where Things Stand markers must appear exactly once each" });
  }

  if (!/^## Key Takeaways\s*$/m.test(body)) {
    warnings.push({ field: "body", message: "Missing ## Key Takeaways section" });
  }

  return { ok: errors.length === 0, errors, warnings, data, body, slug };
}
