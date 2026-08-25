import { config as loadEnv } from "dotenv";
import express from "express";
import multer from "multer";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";
import matter from "gray-matter";
import sizeOf from "image-size";
import { DEFAULT_AUTHOR, SITE_NAME } from "../site/src/config/site.ts";
import { connectInternalLinks } from "./lib/connectInternalLinks.ts";
import { MAX_UPLOAD_BYTES, MIN_EXTERNAL_LINKS, MAX_EXTERNAL_LINKS } from "./lib/constants.ts";
import {
  connectExternalLinks,
  countUncachedSerpCalls,
  searchExternalLinks,
} from "./lib/externalLinkSearch.ts";
import { ARTICLE_ASSETS, ARTICLES_DIR, CMS_ROOT, DIST_DIR } from "./lib/paths.ts";
import { runPagespeedPanel } from "./lib/providers/pagespeed.js";
import { distHasSlug, distJsonLd, publishedArticles, readArticles, readTeam } from "./lib/readContent.ts";
import { validateFrontmatter } from "./lib/validateFrontmatter.ts";
import { heroExtFromName, stagedHeroes, writeArticle } from "./lib/writeArticle.ts";
import { writeTeamMember } from "./lib/writeTeamMember.ts";
import { replaceWtsParagraph } from "./lib/wts.ts";
import { todayIso } from "./lib/coerceDate.ts";

loadEnv({ path: join(CMS_ROOT, ".env") });

const here = dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

let sessionUpdates = 0;
const receipts: { slug: string; confirmedDate: string; confirmedAt: string }[] = [];

function sessionPayload() {
  return { sessionUpdates, banner: `${sessionUpdates} articles updated this session — remember to commit, push, and deploy.` };
}

function bumpSession(n = 1) {
  sessionUpdates += n;
}

app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.locals.session = sessionPayload();
  next();
});

function fail(res: express.Response, status: number, error: string, extra: Record<string, unknown> = {}) {
  res.status(status).json({ ok: false, error, ...sessionPayload(), ...extra });
}

function stem(filename: string) {
  return filename.replace(/\.[^.]+$/, "").toLowerCase();
}

function normalizedStem(name: string) {
  return stem(name).replace(/[-_]?(hero|image|img|cover|thumb)$/i, "");
}

function parseMarkdownBuffer(file: Express.Multer.File) {
  const raw = file.buffer.toString("utf8");
  const parsed = matter(raw);
  return { filename: file.originalname, stem: stem(file.originalname), data: parsed.data as Record<string, unknown>, body: parsed.content, raw };
}

function heroWarning(buffer: Buffer) {
  try {
    const size = sizeOf(buffer);
    const warnings: string[] = [];
    if ((size.width || 0) < 1200) warnings.push(`Hero is ${size.width}px wide (under 1200px)`);
    if (buffer.length > 1024 * 1024) warnings.push(`Hero is ${(buffer.length / (1024 * 1024)).toFixed(1)}MB (over 1MB)`);
    return warnings;
  } catch {
    return ["Could not read hero dimensions"];
  }
}

app.get("/api/session", (_req, res) => res.json({ ok: true, ...sessionPayload(), defaultAuthor: DEFAULT_AUTHOR, siteName: SITE_NAME }));

app.get("/api/team", (_req, res) => {
  res.json({ ok: true, ...sessionPayload(), team: readTeam() });
});

app.post("/api/team", upload.single("photo"), (req, res) => {
  try {
    const photo = req.file
      ? { buffer: req.file.buffer, ext: extname(req.file.originalname) || ".jpg" }
      : undefined;
    const credentials = String(req.body.credentials || "")
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const knowsAbout = String(req.body.knowsAbout || "")
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
    const sameAs = String(req.body.sameAs || "")
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const result = writeTeamMember({
      name: String(req.body.name || ""),
      role: String(req.body.role || ""),
      bio: String(req.body.bio || ""),
      credentials,
      knowsAbout,
      sameAs,
      email: req.body.email || undefined,
      photo,
      slug: req.body.slug || undefined,
    });
    bumpSession();
    res.json({ ok: true, ...result, ...sessionPayload() });
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : String(err));
  }
});

app.get("/api/articles", (_req, res) => {
  const articles = readArticles().map((a) => ({
    slug: a.slug,
    title: a.data.title,
    author: a.data.author,
    pillarKeyword: a.data.pillarKeyword,
    supportingKeyword: a.data.supportingKeyword,
    articleType: a.data.articleType,
    date: a.data.date,
    updatedDate: a.data.updatedDate,
    draft: a.data.draft === true,
    internalCount: Array.isArray(a.data.internalLinks) ? a.data.internalLinks.length : 0,
    externalCount: Array.isArray(a.data.externalLinks) ? a.data.externalLinks.length : 0,
    targetKeyword: a.data.targetKeyword,
    imageAlt: a.data.imageAlt,
    published_url: a.data.published_url,
  }));
  res.json({ ok: true, ...sessionPayload(), articles });
});

app.post("/api/articles/set-draft", async (req, res) => {
  try {
    const { slug, draft } = req.body as { slug: string; draft: boolean };
    if (!slug) return fail(res, 400, "slug is required");
    const mdPath = join(ARTICLES_DIR, `${slug}.md`);
    if (!existsSync(mdPath)) return fail(res, 404, "Article not found");
    let content = readFileSync(mdPath, "utf8");
    if (/^draft:\s*(true|false)/m.test(content)) {
      content = content.replace(/^draft:\s*(true|false)/m, `draft: ${draft}`);
    } else {
      content = content.replace(/^---\r?\n/, (match) => `${match}draft: ${draft}\n`);
    }
    writeFileSync(mdPath, content, "utf8");
    bumpSession();
    res.json({ ok: true, slug, draft, ...sessionPayload() });
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : String(err));
  }
});

app.post("/api/articles/delete", async (req, res) => {
  try {
    const { slug } = req.body as { slug: string };
    if (!slug) return fail(res, 400, "slug is required");
    const mdPath = join(ARTICLES_DIR, `${slug}.md`);
    if (!existsSync(mdPath)) return fail(res, 404, "Article not found");
    unlinkSync(mdPath);
    for (const ext of [".png", ".jpg", ".jpeg", ".webp"]) {
      const imgPath = join(ARTICLE_ASSETS, `${slug}${ext}`);
      if (existsSync(imgPath)) {
        unlinkSync(imgPath);
        break;
      }
    }
    bumpSession();
    res.json({ ok: true, slug, ...sessionPayload() });
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : String(err));
  }
});

function parseIncomingFiles(files: Express.Multer.File[]) {
  const markdown: ReturnType<typeof parseMarkdownBuffer>[] = [];
  const images = new Map<string, Express.Multer.File>();
  const unmatched: Express.Multer.File[] = [];

  for (const file of files) {
    const name = file.originalname.toLowerCase();
    if (name.endsWith(".zip")) {
      const zip = new AdmZip(file.buffer);
      for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue;
        const base = entry.entryName.split("/").pop() || entry.entryName;
        const fake = {
          originalname: base,
          buffer: entry.getData(),
          mimetype: "",
          size: entry.header.size,
        } as Express.Multer.File;
        if (base.toLowerCase().endsWith(".md")) markdown.push(parseMarkdownBuffer(fake));
        else if (/\.(png|jpe?g|webp)$/i.test(base)) images.set(normalizedStem(base), fake);
      }
    } else if (name.endsWith(".md")) {
      markdown.push(parseMarkdownBuffer(file));
    } else if (/\.(png|jpe?g|webp)$/i.test(name)) {
      images.set(normalizedStem(file.originalname), file);
    } else {
      unmatched.push(file);
    }
  }
  return { markdown, images, unmatched };
}

app.post("/api/parse", upload.any(), (req, res) => {
  try {
    const files = (req.files as Express.Multer.File[]) || [];
    const { markdown, images } = parseIncomingFiles(files);
    const author = String(req.body.author || DEFAULT_AUTHOR);
    const rows = markdown.map((md) => {
      const paired = images.get(normalizedStem(md.filename));
      const intake = validateFrontmatter({
        filenameStem: md.stem,
        rawData: md.data,
        rawBody: md.body,
        draft: false,
        authorOverride: author,
      });
      const warnings = [...intake.warnings];
      if (paired) warnings.push(...heroWarning(paired.buffer).map((message) => ({ field: "image", message })));
      else if (!intake.data.image) warnings.push({ field: "image", message: "No paired hero image" });
      return {
        slug: md.stem,
        filename: md.filename,
        ok: intake.ok,
        errors: intake.errors,
        warnings,
        data: intake.data,
        body: intake.body,
        hasImage: Boolean(paired),
      };
    });
    const assigned = new Set(markdown.map((m) => normalizedStem(m.filename)));
    const unassigned = [...images.entries()]
      .filter(([s]) => !assigned.has(s))
      .map(([s, f]) => ({ stem: s, filename: f.originalname }));
    res.json({ ok: true, ...sessionPayload(), rows, unassigned, defaultAuthor: author });
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : String(err));
  }
});

app.post("/api/generate", upload.any(), (req, res) => {
  try {
    const files = (req.files as Express.Multer.File[]) || [];
    const { markdown, images } = parseIncomingFiles(files);
    const payloads = req.body.rows ? JSON.parse(String(req.body.rows)) as {
      slug: string;
      author?: string;
      draft?: boolean;
      imageStem?: string;
    }[] : markdown.map((m) => ({ slug: m.stem, author: req.body.author, draft: false }));

    const mdStems = new Set(markdown.map((m) => normalizedStem(m.filename)));
    const fallbackImage = [...images.entries()].find(([s]) => !mdStems.has(s))?.[1];

    const results = [];
    for (const row of payloads) {
      const md = markdown.find((m) => m.stem === row.slug);
      if (!md) {
        results.push({ slug: row.slug, ok: false, error: "Markdown missing from payload" });
        continue;
      }
      const imageFile =
        (row.imageStem && images.get(normalizedStem(row.imageStem))) ||
        images.get(normalizedStem(row.slug)) ||
        fallbackImage;
      if (imageFile) {
        stagedHeroes.set(row.slug, { buffer: imageFile.buffer, ext: heroExtFromName(imageFile.originalname) });
      }
      const intake = validateFrontmatter({
        filenameStem: row.slug,
        rawData: md.data,
        rawBody: md.body,
        draft: Boolean(row.draft),
        authorOverride: row.author || req.body.author || DEFAULT_AUTHOR,
      });
      if (!intake.ok) {
        results.push({ slug: row.slug, ok: false, error: intake.errors.map((e) => e.message).join("; "), errors: intake.errors });
        continue;
      }
      try {
        const written = writeArticle({ data: intake.data, body: intake.body, slug: intake.slug });
        if (written.changed) bumpSession();
        results.push({ slug: row.slug, ok: true, changed: written.changed, warnings: intake.warnings });
      } catch (err) {
        results.push({ slug: row.slug, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
    res.json({ ok: true, ...sessionPayload(), results });
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : String(err));
  }
});

app.post("/api/health/connect-internal", async (_req, res) => {
  try {
    const result = await connectInternalLinks();
    bumpSession(result.updated.length);
    res.json({ ok: true, ...result, ...sessionPayload() });
  } catch (err) {
    fail(res, 500, err instanceof Error ? err.message : String(err));
  }
});

app.get("/api/health/external-count", (_req, res) => {
  res.json({ ok: true, calls: countUncachedSerpCalls(), ...sessionPayload() });
});

app.post("/api/health/search-external", async (_req, res) => {
  try {
    const result = await searchExternalLinks();
    res.json({ ok: true, ...result, ...sessionPayload() });
  } catch (err) {
    fail(res, 500, err instanceof Error ? err.message : String(err));
  }
});

app.post("/api/health/connect-external", (req, res) => {
  try {
    const result = connectExternalLinks(req.body.selections || []);
    bumpSession(result.updated.length);
    res.json({ ok: true, ...result, ...sessionPayload() });
  } catch (err) {
    fail(res, 500, err instanceof Error ? err.message : String(err));
  }
});

async function headStatus(url: string): Promise<number | "timeout" | "error"> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const resHead = await fetch(url, { method: "HEAD", signal: controller.signal, redirect: "follow" });
    return resHead.status;
  } catch (err) {
    return (err as { name?: string })?.name === "AbortError" ? "timeout" : "error";
  } finally {
    clearTimeout(timer);
  }
}

app.get("/api/health", async (_req, res) => {
  try {
    const articles = readArticles();
    const published = articles.filter((a) => a.data.draft !== true);
    const titles = new Map<string, string[]>();
    const descs = new Map<string, string[]>();
    const targets = new Map<string, string[]>();
    for (const a of published) {
      const t = String(a.data.title || "");
      const d = String(a.data.description || "");
      const k = String(a.data.targetKeyword || "").trim().toLowerCase();
      titles.set(t, [...(titles.get(t) || []), a.slug]);
      descs.set(d, [...(descs.get(d) || []), a.slug]);
      if (k) targets.set(k, [...(targets.get(k) || []), a.slug]);
    }

    const inbound = new Map<string, number>();
    for (const a of published) inbound.set(a.slug, 0);
    for (const a of published) {
      for (const link of (a.data.internalLinks as { slug: string }[]) || []) {
        inbound.set(link.slug, (inbound.get(link.slug) || 0) + 1);
      }
    }

    const rows = [];
    for (const article of articles) {
      const pub = article.data.draft !== true;
      const internals = (article.data.internalLinks as { slug: string }[]) || [];
      const externals = (article.data.externalLinks as { url: string }[]) || [];
      const pillars = published.filter(
        (p) =>
          String(p.data.articleType).toLowerCase() === "comprehensive" &&
          !p.data.supportingKeyword &&
          String(p.data.pillarKeyword || "").trim().toLowerCase() ===
            String(article.data.pillarKeyword || "").trim().toLowerCase(),
      );
      const missingPillarLink = pub && !(!article.data.supportingKeyword && String(article.data.articleType).toLowerCase() === "comprehensive")
        && pillars.length > 0 && !internals.some((l) => pillars.some((p) => p.slug === l.slug));

      const broken: { url: string; status: number | string }[] = [];
      if (pub) {
        for (const link of externals) {
          const status = await headStatus(link.url);
          if (status !== 200) broken.push({ url: link.url, status });
        }
      }

      const title = String(article.data.title || "");
      const description = String(article.data.description || "");
      rows.push({
        slug: article.slug,
        title: article.data.title,
        date: article.data.date,
        updatedDate: article.data.updatedDate,
        draft: article.data.draft === true,
        published_url: article.data.published_url,
        indicators: {
          links: {
            type: "actionable",
            orphan: pub ? (inbound.get(article.slug) || 0) === 0 : false,
            missingPillarLink: Boolean(missingPillarLink),
            externalCount: externals.length,
            externalLow: pub && externals.length < MIN_EXTERNAL_LINKS,
            externalHigh: pub && externals.length > MAX_EXTERNAL_LINKS,
            broken,
          },
          meta: {
            type: "diagnostic",
            titleLength: title.length,
            descriptionLength: description.length,
            duplicateTitle: (titles.get(title) || []).length > 1,
            duplicateDescription: (descs.get(description) || []).length > 1,
          },
          cluster: {
            type: "diagnostic",
            cannibalization: pub && (targets.get(String(article.data.targetKeyword || "").trim().toLowerCase()) || []).length > 1,
            comprehensiveWithoutPillar:
              String(article.data.articleType).toLowerCase() === "comprehensive" && !article.data.pillarKeyword,
          },
          body: {
            type: "diagnostic",
            wts: /WHERE-THINGS-STAND:START/.test(article.body) && /WHERE-THINGS-STAND:END/.test(article.body),
            keyTakeaways: /^## Key Takeaways\s*$/m.test(article.body),
            singleH1: article.body.split(/\n/).filter((l) => /^#\s+/.test(l) && !/^##/.test(l)).length === 0,
            imageAlt: typeof article.data.imageAlt === "string" && article.data.imageAlt.length >= 10,
          },
          schemaSitemap: {
            type: "diagnostic",
            jsonLd: pub ? distJsonLd(article.slug) : { ok: false, reason: "draft" },
            inSitemap: pub ? distHasSlug(article.slug) : false,
          },
          speed: {
            type: "diagnostic",
            scanned: false,
          },
        },
      });
    }
    res.json({ ok: true, ...sessionPayload(), minExternal: MIN_EXTERNAL_LINKS, maxExternal: MAX_EXTERNAL_LINKS, rows });
  } catch (err) {
    fail(res, 500, err instanceof Error ? err.message : String(err));
  }
});

app.post("/api/health/pagespeed", async (req, res) => {
  try {
    const url = String(req.body.url || "");
    if (!url) return fail(res, 400, "url is required");
    const result = await runPagespeedPanel({ siteUrl: url });
    res.json({ ok: true, result, ...sessionPayload() });
  } catch (err) {
    fail(res, 500, err instanceof Error ? err.message : String(err));
  }
});

app.post("/api/update/preview", upload.single("file"), (req, res) => {
  try {
    let payload: unknown;
    if (req.file) payload = JSON.parse(req.file.buffer.toString("utf8"));
    else payload = req.body.updates ?? JSON.parse(String(req.body.json || "[]"));
    if (!Array.isArray(payload)) return fail(res, 400, "Update payload must be a JSON array");
    const articles = readArticles();
    const rows = payload.map((item: { slug: string; newParagraph: string; newUpdatedDate: string; newSources: { title: string; url: string }[] }) => {
      const article = articles.find((a) => a.slug === item.slug);
      const current = article
        ? (article.body.match(/<!--\s*WHERE-THINGS-STAND:START\s*-->[\s\S]*?<!--\s*WHERE-THINGS-STAND:END\s*-->/) || [""])[0]
        : "";
      return {
        ...item,
        matched: Boolean(article),
        currentParagraph: current,
      };
    });
    const unmatched = rows.filter((r) => !r.matched).map((r) => r.slug);
    res.json({ ok: true, unmatched, rows, ...sessionPayload() });
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : String(err));
  }
});

app.post("/api/update/confirm", (req, res) => {
  try {
    const items = req.body.items as {
      slug: string;
      newParagraph: string;
      newUpdatedDate: string;
      newSources?: { title: string; url: string; checked?: boolean }[];
    }[];
    const confirmedAt = new Date().toISOString();
    const confirmed = [];
    for (const item of items) {
      const article = readArticles().find((a) => a.slug === item.slug);
      if (!article) continue;
      const body = replaceWtsParagraph(article.body, item.newParagraph);
      const externals = Array.isArray(article.data.externalLinks)
        ? [...(article.data.externalLinks as { label: string; url: string; addedAt: string }[])]
        : [];
      for (const source of item.newSources || []) {
        if (source.checked === false) continue;
        if (externals.some((e) => e.url === source.url)) continue;
        externals.push({ label: source.title, url: source.url, addedAt: todayIso() });
      }
      writeArticle({
        data: { ...article.data, updatedDate: item.newUpdatedDate, externalLinks: externals },
        body,
        slug: article.slug,
      });
      const receipt = { slug: item.slug, confirmedDate: item.newUpdatedDate, confirmedAt };
      receipts.push(receipt);
      confirmed.push(receipt);
      bumpSession();
    }
    res.json({ ok: true, confirmed, ...sessionPayload() });
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : String(err));
  }
});

app.get("/api/update/receipt", (_req, res) => {
  const date = todayIso();
  const slug = SITE_NAME.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "site-name";
  res.json({
    ok: true,
    filename: `${slug}-confirmation-receipt-${date}.json`,
    receipts,
    ...sessionPayload(),
  });
});

app.use(express.static(join(here, "public")));

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  fail(res, 500, err instanceof Error ? err.message : String(err));
});

const port = 3737;
app.listen(port, "127.0.0.1", () => {
  console.log(`CMS on http://127.0.0.1:${port}`);
});
