import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const CMS_ROOT = join(here, "..");
export const REPO_ROOT = join(CMS_ROOT, "..");
export const SITE_ROOT = join(REPO_ROOT, "site");
export const ARTICLES_DIR = join(SITE_ROOT, "src", "content", "articles");
export const TEAM_DIR = join(SITE_ROOT, "src", "content", "team");
export const SERVICES_DIR = join(SITE_ROOT, "src", "content", "services");
export const ARTICLE_ASSETS = join(SITE_ROOT, "src", "assets", "articles");
export const TEAM_ASSETS = join(SITE_ROOT, "src", "assets", "team");
export const DIST_DIR = join(SITE_ROOT, "dist");
export const SOURCES_FILE = join(CMS_ROOT, "data", "sources.json");
export const SERP_CACHE_DIR = join(CMS_ROOT, "data", "serp-cache");
