import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { applyExternalSignpost, applyInternalSignpost, trimExternalLinks } from "./applyLinks";
import { ARTICLE_ASSETS, ARTICLES_DIR } from "./paths";
import { serializeMarkdown } from "./serialize";

const PLACEHOLDER_RE = /replace|todo|placeholder/i;

export const stagedHeroes = new Map<string, { buffer: Buffer; ext: string }>();

export function imageRelPath(slug: string, ext: string): string {
  const safe = ext.replace(/^\./, "").toLowerCase();
  return `../../assets/articles/${slug}.${safe}`;
}

export function heroIsValid(slug: string, imagePath: unknown): boolean {
  if (stagedHeroes.has(slug)) return true;
  if (typeof imagePath !== "string" || !imagePath) return false;
  if (PLACEHOLDER_RE.test(imagePath)) return false;
  const abs = join(ARTICLES_DIR, imagePath);
  return existsSync(abs);
}

export function writeArticle(opts: {
  data: Record<string, unknown>;
  body: string;
  slug: string;
}): { path: string; changed: boolean } {
  mkdirSync(ARTICLES_DIR, { recursive: true });
  mkdirSync(ARTICLE_ASSETS, { recursive: true });

  const staged = stagedHeroes.get(opts.slug);
  if (staged) {
    const ext = staged.ext.replace(/^\./, "").toLowerCase();
    writeFileSync(join(ARTICLE_ASSETS, `${opts.slug}.${ext}`), staged.buffer);
    opts.data.image = imageRelPath(opts.slug, ext);
    stagedHeroes.delete(opts.slug);
  } else if (!heroIsValid(opts.slug, opts.data.image)) {
    throw new Error("A hero image must be staged this session or paired from the batch");
  }

  if (Array.isArray(opts.data.externalLinks)) {
    opts.data.externalLinks = trimExternalLinks(opts.data.externalLinks as { addedAt: string }[]);
  }

  let body = opts.body;
  body = applyInternalSignpost(body, (opts.data.internalLinks as { slug: string; anchor: string }[]) || []);
  body = applyExternalSignpost(
    body,
    (opts.data.externalLinks as { label: string; url: string }[]) || [],
  );

  const next = serializeMarkdown(opts.data, body);
  const outPath = join(ARTICLES_DIR, `${opts.slug}.md`);
  const prev = existsSync(outPath) ? readFileSync(outPath, "utf8") : null;
  if (prev === next) return { path: outPath, changed: false };
  writeFileSync(outPath, next, "utf8");
  return { path: outPath, changed: true };
}

export function heroExtFromName(filename: string): string {
  const ext = extname(filename).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) return ext === ".jpeg" ? ".jpg" : ext;
  return ".png";
}
