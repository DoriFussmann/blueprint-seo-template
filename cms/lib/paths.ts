import path from "node:path";
import { fileURLToPath } from "node:url";

const cmsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CMS_ROOT = cmsRoot;
export const REPO_ROOT = path.resolve(cmsRoot, "..");
export const SITE_ROOT = path.join(REPO_ROOT, "site");
export const ARTICLES_DIR = path.join(SITE_ROOT, "src/content/articles");
export const TEAM_DIR = path.join(SITE_ROOT, "src/content/team");
export const SERVICES_DIR = path.join(SITE_ROOT, "src/content/services");
export const ARTICLE_ASSETS_DIR = path.join(SITE_ROOT, "src/assets/articles");
export const TEAM_ASSETS_DIR = path.join(SITE_ROOT, "src/assets/team");
export const LLMS_PATH = path.join(SITE_ROOT, "public/llms.txt");
export const DIST_DIR = path.join(SITE_ROOT, "dist");
export const SOURCES_PATH = path.join(cmsRoot, "data/sources.json");

export function articleFilePath(slug: string): string {
  return path.join(ARTICLES_DIR, `${slug}.md`);
}

export function articleHeroRel(slug: string, ext: string): string {
  return `../../assets/articles/${slug}/hero${ext}`;
}

export function teamPhotoRel(slug: string, ext: string): string {
  return `../../assets/team/${slug}${ext}`;
}
