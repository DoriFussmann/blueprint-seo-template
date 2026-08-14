import dotenv from "dotenv";
import express, { type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import JSZip from "jszip";
import { SITE_URL, SITE_NAME } from "../site/src/config/site.ts";
import { absoluteUrl } from "../site/src/lib/url.ts";
import { CMS_PORT, MAX_UPLOAD_BYTES } from "./lib/constants.ts";
import { DIST_DIR, SERVICES_DIR } from "./lib/paths.ts";
import { normalizeIntake, type ArticleFrontmatter } from "./lib/schema.ts";
import { validateFrontmatter } from "./lib/validateFrontmatter.ts";
import {
  knownSlugs,
  readAllArticles,
  readArticle,
  readTeamMembers,
  type StoredArticle,
} from "./lib/readContent.ts";
import { writeArticle, deleteArticle, writeArticleFile } from "./lib/writeArticle.ts";
import { writeTeamMember } from "./lib/writeTeamMember.ts";
import { generateLlmsTxt } from "./lib/generateLlmsTxt.ts";
import {
  connectAll,
  connectArticle,
  linkHealth,
  missingInternalLinks,
  requiredInternalLinks,
} from "./lib/connectInternalLinks.ts";
import { proposeExternalLinks } from "./lib/externalLinkSearch.ts";
import { applyExternalLinks } from "./lib/applyLinks.ts";
import { runPagespeedPanel, speedState } from "./lib/pagespeed.ts";
import { extractWts, replaceWtsParagraph } from "./lib/wts.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });
const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

const staging = new Map<string, { buffer: Buffer; originalName: string; mime?: string }>();

app.use(express.json({ limit: "12mb" }));
app.use(express.static(path.join(__dirname, "public")));

function jsonError(res: Response, status: number, error: string, extra: Record<string, unknown> = {}) {
  return res.status(status).json({ ok: false, error, ...extra });
}

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return jsonError(res, 413, `File exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB limit`);
  }
  return jsonError(res, 500, err?.message || "Unhandled CMS error");
});

function parseMarkdown(buffer: Buffer | string, filename = ""): {
  data: ArticleFrontmatter;
  body: string;
  filename: string;
} {
  const raw = typeof buffer === "string" ? buffer : buffer.toString("utf8");
  const parsed = matter(raw);
  const data = normalizeIntake(parsed.data as Record<string, unknown>);
  if (!data.slug && filename) data.slug = filename.replace(/\.md$/i, "");
  return { data, body: parsed.content, filename };
}

function validateOne(
  data: ArticleFrontmatter,
  stagedHero: boolean,
  isEdit = false
) {
  return validateFrontmatter(data, {
    stagedHero,
    knownSlugs: knownSlugs(),
    existingSlugs: knownSlugs().articles,
    isEdit,
  });
}

function publicArticle(row: StoredArticle) {
  return {
    slug: row.slug,
    filename: row.filename,
    ...row.data,
    internalLinkCount: (row.data.internalLinks || []).length,
    externalLinkCount: (row.data.externalLinks || []).length,
    faqCount: (row.data.faqs || []).length,
    body: row.body,
  };
}

app.get("/api/config", (_req, res) => {
  res.json({
    ok: true,
    siteUrl: SITE_URL,
    siteName: SITE_NAME,
    maxUploadBytes: MAX_UPLOAD_BYTES,
    maxUploadMb: MAX_UPLOAD_BYTES / (1024 * 1024),
  });
});

app.get("/api/slugs", (_req, res) => {
  res.json({ ok: true, ...knownSlugs() });
});

app.get("/api/articles", (_req, res) => {
  res.json({
    ok: true,
    articles: readAllArticles().map(publicArticle),
  });
});

app.get("/api/articles/:slug", (req, res) => {
  const row = readArticle(req.params.slug);
  if (!row) return jsonError(res, 404, `Article "${req.params.slug}" not found`);
  res.json({ ok: true, article: publicArticle(row) });
});

app.post("/api/parse", upload.single("file"), (req, res) => {
  try {
    const file = req.file;
    const markdown = file ? file.buffer : req.body?.markdown;
    const filename = file?.originalname || req.body?.filename || "";
    if (!markdown) return jsonError(res, 400, "No markdown supplied");
    const parsed = parseMarkdown(markdown, filename);
    const stagedHero = Boolean(req.body?.stagedHero);
    const isEdit = Boolean(req.body?.isEdit);
    const validation = validateOne(parsed.data, stagedHero, isEdit);
    res.json({ ok: true, ...parsed, validation });
  } catch (err: any) {
    jsonError(res, 400, err?.message || "Parse failed");
  }
});

app.post("/api/parse-batch", upload.array("files", 50), async (req, res) => {
  try {
    const files = (req.files as Express.Multer.File[]) || [];
    const zipFile = files.find((f) => /\.zip$/i.test(f.originalname));
    const rows: Array<{
      filename: string;
      slug: string;
      data: ArticleFrontmatter;
      body: string;
      stagedHeroId?: string;
      validation: ReturnType<typeof validateOne>;
    }> = [];

    async function addMd(name: string, buf: Buffer, hero?: { buffer: Buffer; originalName: string }) {
      const parsed = parseMarkdown(buf, name);
      let stagedHeroId: string | undefined;
      if (hero) {
        stagedHeroId = `${parsed.data.slug || name}-hero-${Date.now()}`;
        staging.set(stagedHeroId, hero);
      }
      const validation = validateOne(parsed.data, Boolean(stagedHeroId));
      rows.push({
        filename: name,
        slug: parsed.data.slug,
        data: parsed.data,
        body: parsed.body,
        stagedHeroId,
        validation,
      });
    }

    if (zipFile) {
      const zip = await JSZip.loadAsync(zipFile.buffer);
      const mdFiles: Array<{ name: string; buf: Buffer }> = [];
      const images = new Map<string, { buffer: Buffer; originalName: string }>();
      for (const [name, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue;
        const base = path.basename(name);
        const buf = Buffer.from(await entry.async("nodebuffer"));
        if (/\.md$/i.test(base)) mdFiles.push({ name: base, buf });
        if (/\.(png|jpe?g|webp|gif)$/i.test(base)) {
          images.set(base.replace(/\.[^.]+$/, "").toLowerCase(), {
            buffer: buf,
            originalName: base,
          });
        }
      }
      for (const file of mdFiles) {
        const slug = file.name.replace(/\.md$/i, "").toLowerCase();
        await addMd(file.name, file.buf, images.get(slug));
      }
    } else {
      for (const file of files.filter((f) => /\.md$/i.test(f.originalname))) {
        await addMd(file.originalname, file.buffer);
      }
    }

    res.json({ ok: true, rows });
  } catch (err: any) {
    jsonError(res, 400, err?.message || "Batch parse failed");
  }
});

app.post("/api/upload-image", upload.single("file"), (req, res) => {
  if (!req.file) return jsonError(res, 400, "No image uploaded");
  const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  staging.set(id, {
    buffer: req.file.buffer,
    originalName: req.file.originalname,
    mime: req.file.mimetype,
  });
  res.json({ ok: true, stagingId: id, name: req.file.originalname });
});

app.post("/api/articles", (req, res) => {
  try {
    const { data, body, stagingId, skipLlms } = req.body || {};
    if (!data) return jsonError(res, 400, "Missing article data");
    const fm = normalizeIntake(data);
    const hero = stagingId ? staging.get(String(stagingId)) : null;
    const validation = validateOne(fm, Boolean(hero), Boolean(req.body?.isEdit));
    if (validation.missing.length) {
      return jsonError(res, 400, "Validation failed", { validation });
    }
    const result = writeArticle({ data: fm, body: String(body || ""), hero });
    if (hero && stagingId) staging.delete(String(stagingId));
    if (!skipLlms) generateLlmsTxt();
    res.json({ ok: true, ...result });
  } catch (err: any) {
    jsonError(res, 400, err?.message || "Write failed");
  }
});

app.post("/api/articles/batch", async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const results = [];
    for (const item of items) {
      try {
        const fm = normalizeIntake(item.data || {});
        const hero = item.stagingId ? staging.get(String(item.stagingId)) : null;
        const validation = validateOne(fm, Boolean(hero), Boolean(item.isEdit));
        if (validation.missing.length) {
          results.push({
            slug: fm.slug,
            ok: false,
            error: validation.missing.map((m) => m.message).join("; "),
          });
          continue;
        }
        const written = writeArticle({
          data: fm,
          body: String(item.body || ""),
          hero,
        });
        if (hero && item.stagingId) staging.delete(String(item.stagingId));
        results.push({ slug: written.slug, ok: true });
      } catch (err: any) {
        results.push({
          slug: item?.data?.slug,
          ok: false,
          error: err?.message || "Write failed",
        });
      }
    }
    generateLlmsTxt();
    res.json({ ok: true, results });
  } catch (err: any) {
    jsonError(res, 400, err?.message || "Batch write failed");
  }
});

app.patch("/api/articles/:slug", (req, res) => {
  try {
    const row = readArticle(req.params.slug);
    if (!row) return jsonError(res, 404, "Article not found");
    const next = { ...row.data, ...(req.body?.data || {}) };
    if (typeof req.body?.draft === "boolean") next.draft = req.body.draft;
    if (typeof req.body?.body === "string") row.body = req.body.body;
    writeArticleFile(row.slug, next, row.body);
    generateLlmsTxt();
    res.json({ ok: true, slug: row.slug });
  } catch (err: any) {
    jsonError(res, 400, err?.message || "Update failed");
  }
});

app.delete("/api/articles/:slug", (req, res) => {
  deleteArticle(req.params.slug);
  generateLlmsTxt();
  res.json({ ok: true });
});

app.get("/api/team", (_req, res) => {
  res.json({ ok: true, team: readTeamMembers() });
});

app.post("/api/team", upload.single("photo"), (req, res) => {
  try {
    const data = typeof req.body?.data === "string" ? JSON.parse(req.body.data) : req.body;
    const photo = req.file
      ? { buffer: req.file.buffer, originalName: req.file.originalname, mime: req.file.mimetype }
      : null;
    const result = writeTeamMember({ data, photo });
    res.json({ ok: true, ...result });
  } catch (err: any) {
    jsonError(res, 400, err?.message || "Team write failed");
  }
});

app.get("/api/services", (_req, res) => {
  if (!fs.existsSync(SERVICES_DIR)) return res.json({ ok: true, services: [] });
  const services = fs
    .readdirSync(SERVICES_DIR)
    .filter((name) => name.endsWith(".md"))
    .map((filename) => {
      const parsed = matter(fs.readFileSync(path.join(SERVICES_DIR, filename), "utf8"));
      return { filename, data: parsed.data, body: parsed.content };
    });
  res.json({ ok: true, services });
});

app.get("/api/health", (_req, res) => {
  const articles = readAllArticles().filter((row) => !row.data.draft);
  res.json({
    ok: true,
    articles: articles.map((row) => ({
      slug: row.slug,
      title: row.data.title,
      links: linkHealth(row),
      requiredInternal: requiredInternalLinks(row),
      missingInternal: missingInternalLinks(row),
      externalCount: (row.data.externalLinks || []).length,
      canonical: row.data.canonical || absoluteUrl(`/articles/${row.slug}/`),
    })),
  });
});

app.post("/api/health/connect", (req, res) => {
  try {
    const slug = String(req.body?.slug || "");
    const result = connectArticle(slug);
    generateLlmsTxt();
    res.json({ ok: true, ...result });
  } catch (err: any) {
    jsonError(res, 400, err?.message || "Connect failed");
  }
});

app.post("/api/health/connect-all", (_req, res) => {
  try {
    const results = connectAll();
    generateLlmsTxt();
    res.json({ ok: true, results });
  } catch (err: any) {
    jsonError(res, 400, err?.message || "Connect all failed");
  }
});

app.post("/api/health/propose-external", async (req, res) => {
  try {
    const slug = String(req.body?.slug || "");
    const article = readArticle(slug);
    if (!article || article.data.draft) {
      return jsonError(res, 404, "Published article not found");
    }
    const result = await proposeExternalLinks(article);
    res.json({ ok: true, slug, ...result });
  } catch (err: any) {
    jsonError(res, 400, err?.message || "Propose failed");
  }
});

app.post("/api/health/propose-all", async (_req, res) => {
  try {
    const articles = readAllArticles().filter((row) => !row.data.draft);
    const proposals = [];
    const skipped: string[] = [];
    for (const article of articles) {
      const slots = Math.max(0, 3 - (article.data.externalLinks || []).length);
      if (slots <= 0) continue;
      const result = await proposeExternalLinks(article);
      skipped.push(...result.skipped.map((reason) => `${article.slug}: ${reason}`));
      if (result.candidates.length) {
        proposals.push({
          slug: article.slug,
          title: article.data.title,
          candidates: result.candidates,
        });
      }
    }
    res.json({ ok: true, proposals, skipped });
  } catch (err: any) {
    jsonError(res, 400, err?.message || "Propose all failed");
  }
});

app.post("/api/health/add-external", (req, res) => {
  try {
    const slug = String(req.body?.slug || "");
    const links = Array.isArray(req.body?.links) ? req.body.links : [];
    const article = readArticle(slug);
    if (!article) return jsonError(res, 404, "Article not found");
    applyExternalLinks(article, links);
    generateLlmsTxt();
    res.json({ ok: true, slug });
  } catch (err: any) {
    jsonError(res, 400, err?.message || "Add external failed");
  }
});

function scanMeta(article: StoredArticle) {
  const titleOk = article.data.title.length >= 55 && article.data.title.length <= 60;
  const descOk =
    article.data.description.length >= 140 && article.data.description.length <= 160;
  const canonical = article.data.canonical || absoluteUrl(`/articles/${article.slug}/`);
  const canonicalOk = /^https?:\/\//i.test(canonical);
  const h1Ok = !article.data.h1 || article.data.h1.length >= 20;
  return {
    ok: titleOk && descOk && canonicalOk && h1Ok,
    titleOk,
    descOk,
    canonical,
    canonicalOk,
    ogPresent: true,
    h1: article.data.h1 || article.data.title,
    h1Ok,
  };
}

function scanSchema(article: StoredArticle) {
  const distFile = path.join(DIST_DIR, "articles", article.slug, "index.html");
  if (!fs.existsSync(distFile)) {
    return { ok: false, scanned: false, reason: "No built HTML in dist yet" };
  }
  const html = fs.readFileSync(distFile, "utf8");
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const types: string[] = [];
  let parseOk = true;
  for (const block of blocks) {
    try {
      const json = JSON.parse(block[1]);
      const t = json["@type"];
      if (Array.isArray(t)) types.push(...t);
      else if (t) types.push(t);
    } catch {
      parseOk = false;
    }
  }
  const expect = [article.data.schemaType || "BlogPosting"];
  if ((article.data.faqs || []).length) expect.push("FAQPage");
  const hasExpected = expect.every((t) => types.includes(t));
  return { ok: parseOk && hasExpected, scanned: true, types, parseOk, hasExpected };
}

function scanSitemap(article: StoredArticle) {
  const indexPath = path.join(DIST_DIR, "sitemap-index.xml");
  const sitemap0 = path.join(DIST_DIR, "sitemap-0.xml");
  if (!fs.existsSync(indexPath) && !fs.existsSync(sitemap0)) {
    return { ok: false, scanned: false, reason: "No sitemap in dist yet" };
  }
  const xml = [indexPath, sitemap0]
    .filter((p) => fs.existsSync(p))
    .map((p) => fs.readFileSync(p, "utf8"))
    .join("\n");
  const url = absoluteUrl(`/articles/${article.slug}/`);
  const present = xml.includes(url) || xml.includes(`/articles/${article.slug}/`);
  const lastmodMatch = xml.match(
    new RegExp(
      `<loc>${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</loc>[\\s\\S]*?<lastmod>([^<]+)</lastmod>`
    )
  );
  const lastmod = lastmodMatch?.[1] || null;
  return { ok: present && Boolean(lastmod), scanned: true, present, lastmod };
}

app.post("/api/health/scan-meta", (req, res) => {
  const article = readArticle(String(req.body?.slug || ""));
  if (!article) return jsonError(res, 404, "Article not found");
  res.json({ ok: true, result: scanMeta(article) });
});

app.post("/api/health/scan-schema", (req, res) => {
  const article = readArticle(String(req.body?.slug || ""));
  if (!article) return jsonError(res, 404, "Article not found");
  res.json({ ok: true, result: scanSchema(article) });
});

app.post("/api/health/scan-sitemap", (req, res) => {
  const article = readArticle(String(req.body?.slug || ""));
  if (!article) return jsonError(res, 404, "Article not found");
  res.json({ ok: true, result: scanSitemap(article) });
});

app.post("/api/health/scan-speed", async (req, res) => {
  const url = String(req.body?.url || "");
  const slug = String(req.body?.slug || "");
  const target = url || (slug ? absoluteUrl(`/articles/${slug}/`) : "");
  if (!target) return jsonError(res, 400, "url or slug required");
  const result = await runPagespeedPanel({ siteUrl: target });
  res.json({ ok: true, result, state: speedState(result) });
});

app.post("/api/updates/parse", upload.single("file"), (req, res) => {
  try {
    const raw = req.file
      ? req.file.buffer.toString("utf8")
      : String(req.body?.json || "");
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : null;
    if (!list) return jsonError(res, 400, "JSON must be an array");
    const rows = list.map((entry: any) => {
      const slug = String(entry.slug || "").trim();
      const article = slug ? readArticle(slug) : null;
      const wts = article ? extractWts(article.body) : null;
      return {
        slug,
        matched: Boolean(article),
        newParagraph: String(entry.newParagraph || ""),
        newUpdatedDate: String(entry.newUpdatedDate || ""),
        newSources: Array.isArray(entry.newSources) ? entry.newSources : [],
        currentParagraph: wts?.paragraph || "",
        markerError:
          article && (wts?.startCount !== 1 || wts?.endCount !== 1)
            ? `markers start=${wts?.startCount} end=${wts?.endCount}`
            : null,
      };
    });
    res.json({ ok: true, rows });
  } catch (err: any) {
    jsonError(res, 400, err?.message || "Update parse failed");
  }
});

app.post("/api/updates/confirm", (req, res) => {
  try {
    const slug = String(req.body?.slug || "");
    const article = readArticle(slug);
    if (!article) return jsonError(res, 404, `Unmatched slug "${slug}"`);
    const paragraph = String(req.body?.newParagraph || "");
    const newUpdatedDate = String(req.body?.newUpdatedDate || "");
    const sources = Array.isArray(req.body?.newSources) ? req.body.newSources : [];
    const body = replaceWtsParagraph(article.body, paragraph);
    article.body = body;
    article.data.updatedDate = newUpdatedDate || article.data.updatedDate;
    writeArticleFile(article.slug, article.data, body);
    if (sources.length) {
      applyExternalLinks(
        readArticle(slug)!,
        sources.map((s: any) => ({
          label: String(s.title || s.label || ""),
          url: String(s.url || ""),
        })),
        newUpdatedDate
      );
    }
    generateLlmsTxt();
    res.json({
      ok: true,
      receipt: {
        slug,
        confirmedDate: newUpdatedDate,
        confirmedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    jsonError(res, 400, err?.message || "Confirm failed");
  }
});

app.post("/api/updates/confirm-all", (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const receipts = [];
  const errors = [];
  for (const item of items) {
    try {
      const slug = String(item.slug || "");
      const article = readArticle(slug);
      if (!article) {
        errors.push({ slug, error: "unmatched" });
        continue;
      }
      const body = replaceWtsParagraph(article.body, String(item.newParagraph || ""));
      article.data.updatedDate = String(item.newUpdatedDate || article.data.updatedDate);
      writeArticleFile(article.slug, article.data, body);
      const sources = Array.isArray(item.newSources) ? item.newSources : [];
      if (sources.length) {
        applyExternalLinks(
          readArticle(slug)!,
          sources.map((s: any) => ({
            label: String(s.title || s.label || ""),
            url: String(s.url || ""),
          })),
          item.newUpdatedDate
        );
      }
      receipts.push({
        slug,
        confirmedDate: String(item.newUpdatedDate || ""),
        confirmedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      errors.push({ slug: item?.slug, error: err?.message || "failed" });
    }
  }
  generateLlmsTxt();
  res.json({ ok: true, receipts, errors });
});

app.post("/api/llms", (_req, res) => {
  generateLlmsTxt();
  res.json({ ok: true });
});

app.listen(CMS_PORT, () => {
  console.log(`CMS running at http://localhost:${CMS_PORT}`);
});
