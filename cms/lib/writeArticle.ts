import fs from "node:fs";
import path from "node:path";
import type { ArticleFrontmatter } from "./schema.ts";
import { serializeArticleMarkdown } from "./serialize.ts";
import { articleFilePath, articleHeroRel, ARTICLE_ASSETS_DIR } from "./paths.ts";

export interface StagedFile {
  buffer: Buffer;
  originalName: string;
  mime?: string;
}

function extFrom(file: StagedFile): string {
  const fromName = path.extname(file.originalName || "").toLowerCase();
  if (fromName) return fromName;
  if (file.mime === "image/jpeg") return ".jpg";
  if (file.mime === "image/webp") return ".webp";
  if (file.mime === "image/gif") return ".gif";
  return ".png";
}

export function writeArticle(options: {
  data: ArticleFrontmatter;
  body: string;
  hero?: StagedFile | null;
  regenerateLlms?: boolean;
}): { slug: string; path: string } {
  const slug = String(options.data.slug || "").trim();
  if (!slug) throw new Error("slug is required");
  if (!options.data.author) {
    throw new Error("author is required before writing to the site content directory");
  }

  const dest = articleFilePath(slug);
  let imageRel = options.data.image || "";

  if (options.hero) {
    const ext = extFrom(options.hero);
    const dir = path.join(ARTICLE_ASSETS_DIR, slug);
    fs.mkdirSync(dir, { recursive: true });
    const heroPath = path.join(dir, `hero${ext}`);
    fs.writeFileSync(heroPath, options.hero.buffer);
    imageRel = articleHeroRel(slug, ext);
  }

  if (!imageRel) throw new Error("hero image is required");

  const payload: Record<string, unknown> = {
    ...options.data,
    slug,
    image: imageRel,
    updatedDate: options.data.updatedDate || options.data.date,
  };

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, serializeArticleMarkdown(payload, options.body), "utf8");
  return { slug, path: dest };
}

export function writeArticleFile(slug: string, data: ArticleFrontmatter, body: string) {
  const dest = articleFilePath(slug);
  fs.writeFileSync(dest, serializeArticleMarkdown({ ...data, slug }, body), "utf8");
  return dest;
}

export function deleteArticle(slug: string) {
  const dest = articleFilePath(slug);
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
}
