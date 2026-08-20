import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Blob } from "node:buffer";

const cms = "http://127.0.0.1:3737";
const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");

async function json(path, opts) {
  const res = await fetch(`${cms}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(`${path}: ${data.error || res.status}`);
  return data;
}

const bio = `Dori Fussmann is a seasoned finance and operations executive with deep expertise in entrepreneurship, business strategy, and data-driven decision-making. As Chief Financial Officer of BlueMark, Dori leads the firm's financial strategy and planning, operational excellence, and growth execution – helping ensure the organization's continued leadership in impact verification and intelligence.

Before joining BlueMark, Dori was the Founder and CEO of The Vets, a U.S. home pet care company. Earlier in his career, Dori spent several years in investment banking at Citi, Ion Pacific, and Morgan Stanley, advising on mergers and acquisitions, IPOs, and strategic financing transactions across consumer and technology sectors.

Dori also serves as a mentor in Cornell Tech's Runway Startups Program, supporting early-stage founders working on applied technology solutions.

Dori also serves as a mentor in Yale's Tsai Center for Innovative Thinking (Tsai CITY) Thematic Mentoring Program, advising student founders and venture teams on business model development, go-to-market strategy, product positioning, and commercialization pathways.

Fluent in English and Hebrew and proficient in German, Dori earned dual degrees in Accounting and Business Management (B.A.) and Law (LL.B.) from the Interdisciplinary Centre (IDC) Herzliya.`;

const photo = readFileSync(join(repo, "site", "src", "assets", "team", "dori-fussmann.jpg"));
const teamFd = new FormData();
teamFd.set("name", "Dori Fussmann");
teamFd.set("role", "Founder, The Night Ventures");
teamFd.set("bio", bio);
teamFd.set(
  "credentials",
  [
    "Chief Financial Officer, BlueMark",
    "Founder & CEO, The Vets",
    "Investment banking: Citi, Ion Pacific, Morgan Stanley",
    "Mentor, Cornell Tech Runway Startups Program",
    "Mentor, Yale Tsai CITY Thematic Mentoring Program",
    "B.A. Accounting & Business Management, LL.B., IDC Herzliya",
  ].join("\n"),
);
teamFd.set("knowsAbout", "business strategy, finance and operations, entrepreneurship, mergers and acquisitions, go-to-market strategy");
teamFd.set("sameAs", "https://www.linkedin.com/in/dori-fussmann-663ba242/");
teamFd.set("photo", new Blob([photo], { type: "image/jpeg" }), "dori-fussmann.jpg");
teamFd.set("slug", "dori-fussmann");
console.log("team", (await json("/api/team", { method: "POST", body: teamFd })).slug);

const zip = readFileSync(join(here, "seed-drafts.zip"));
const genFd = new FormData();
genFd.set("files", new Blob([zip], { type: "application/zip" }), "seed-drafts.zip");
genFd.set("author", "dori-fussmann");
const parsed = await json("/api/parse", { method: "POST", body: genFd });
console.log("parse", parsed.rows.map((r) => ({ slug: r.slug, ok: r.ok, errors: r.errors })));

const slugs = parsed.rows.map((r) => r.slug);
for (let i = 0; i < slugs.length; i++) {
  const fd = new FormData();
  fd.set("files", new Blob([zip], { type: "application/zip" }), "seed-drafts.zip");
  fd.set("author", "dori-fussmann");
  fd.set("rows", JSON.stringify([{ slug: slugs[i], author: "dori-fussmann", draft: false }]));
  const result = await json("/api/generate", { method: "POST", body: fd });
  console.log("generate", i + 1, "of", slugs.length, result.results);
}

const first = await json("/api/health/connect-internal", { method: "POST" });
console.log("internal 1", first);
const second = await json("/api/health/connect-internal", { method: "POST" });
console.log("internal 2", second);

const count = await json("/api/health/external-count");
console.log("serp calls", count.calls);
if (count.calls > 0) {
  const search = await json("/api/health/search-external", { method: "POST" });
  const selections = search.rows.map((row) => ({
    slug: row.slug,
    links: (row.candidates || []).map((c) => ({ label: c.title, url: c.url })),
  }));
  console.log("search", search.rows.map((r) => ({ slug: r.slug, available: r.available, reason: r.reason, n: r.candidates?.length })));
  const connected = await json("/api/health/connect-external", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selections }),
  });
  console.log("external", connected);
  const count2 = await json("/api/health/external-count");
  console.log("serp calls after cache", count2.calls);
}

const update = [
  {
    slug: "technical-seo-foundations",
    newParagraph: "The conversation around crawlability has shifted toward rendering honesty and canonical agreement rather than more sitemap files.",
    newUpdatedDate: "2026-08-20",
    newSources: [
      { title: "Google Search Central documentation", url: "https://developers.google.com/search/docs" },
      { title: "web.dev documentation", url: "https://web.dev/" },
    ],
  },
];
const previewFd = new FormData();
previewFd.set("json", JSON.stringify(update));
const preview = await json("/api/update/preview", { method: "POST", body: previewFd });
console.log("update preview unmatched", preview.unmatched);
const confirmed = await json("/api/update/confirm", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ items: preview.rows.map((r) => ({ ...r, newSources: (r.newSources || []).map((s) => ({ ...s, checked: true })) })) }),
});
console.log("confirmed", confirmed.confirmed);
const receipt = await json("/api/update/receipt");
console.log("receipt", receipt.filename, receipt.receipts);
