const BASE = "http://localhost:3737";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const seedDir = path.dirname(fileURLToPath(import.meta.url));

async function api(pathname, options = {}) {
  const res = await fetch(BASE + pathname, options);
  const data = await res.json().catch(() => null);
  if (!data || data.ok === false || !res.ok) {
    throw new Error(`${pathname}: ${data?.error || res.status}`);
  }
  return data;
}

const photo = fs.readFileSync(
  path.resolve(seedDir, "../../site/src/assets/team/dori-fussmann.png")
);
const teamFd = new FormData();
teamFd.append(
  "data",
  JSON.stringify({
    name: "Dori Fussmann",
    slug: "dori-fussmann",
    role: "Founder",
    bio: "Dori Fussmann is the founder of The Night Ventures. He designs SEO and content systems that turn keyword architecture into published articles with durable E-E-A-T signals.",
    credentials: "Founder, The Night Ventures",
    sameAs: [],
  })
);
teamFd.append(
  "photo",
  new Blob([photo], { type: "image/png" }),
  "dori-fussmann.png"
);
await api("/api/team", { method: "POST", body: teamFd });
console.log("team written");

const zip = fs.readFileSync(path.join(seedDir, "technical-seo-drafts.zip"));
const zipFd = new FormData();
zipFd.append("files", new Blob([zip], { type: "application/zip" }), "technical-seo-drafts.zip");
const parsed = await api("/api/parse-batch", { method: "POST", body: zipFd });
console.log(
  "parsed",
  parsed.rows.map((r) => ({
    slug: r.slug,
    missing: r.validation.missing.map((m) => m.field),
    staged: Boolean(r.stagedHeroId),
  }))
);

const items = parsed.rows.map((row) => ({
  data: { ...row.data, author: "dori-fussmann", draft: false },
  body: row.body,
  stagingId: row.stagedHeroId,
}));

for (const item of items) {
  const check = await fetch(BASE + "/api/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      markdown: `---\ntitle: "${item.data.title}"\ndescription: "${item.data.description}"\nslug: ${item.data.slug}\ndate: ${item.data.date}\nauthor: dori-fussmann\ncategory: ${item.data.category}\ntags:\n  - a\n  - b\n  - c\n  - d\nimageAlt: "${item.data.imageAlt}"\n---\n`,
      stagedHero: true,
    }),
  }).then((r) => r.json());
  console.log("precheck", item.data.slug, check.validation?.missing);
}

const written = await api("/api/articles/batch", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ items }),
});
console.log("written", written.results);

const connected = await api("/api/health/connect-all", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});
console.log(
  "connected",
  connected.results.map((r) => ({ slug: r.slug, added: r.added.map((a) => a.slug) }))
);

const proposed = await api("/api/health/propose-all", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});
console.log(
  "proposed",
  JSON.stringify(
    {
      skipped: proposed.skipped,
      slugs: (proposed.proposals || []).map((p) => ({
        slug: p.slug,
        n: p.candidates.length,
        sample: p.candidates.slice(0, 2),
      })),
    },
    null,
    2
  )
);

for (const p of proposed.proposals || []) {
  const links = (p.candidates || [])
    .filter((c) => c.confidence === "high" || c.source === "serp")
    .slice(0, 3)
    .map((c) => ({ label: c.label, url: c.url }));
  if (!links.length) continue;
  await api("/api/health/add-external", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: p.slug, links }),
  });
  console.log("added external", p.slug, links.length);
}
