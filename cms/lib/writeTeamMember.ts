import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SLUG_RE } from "./constants";
import { TEAM_ASSETS, TEAM_DIR } from "./paths";
import { serializeMarkdown } from "./serialize";
import { slugifyName } from "./coerceDate";

export function writeTeamMember(opts: {
  name: string;
  role: string;
  bio: string;
  credentials?: string[];
  knowsAbout?: string[];
  sameAs?: string[];
  email?: string;
  photo?: { buffer: Buffer; ext: string };
  slug?: string;
}): { slug: string; path: string } {
  const slug = opts.slug || slugifyName(opts.name);
  if (!SLUG_RE.test(slug)) throw new Error(`Invalid team slug "${slug}"`);
  mkdirSync(TEAM_DIR, { recursive: true });
  mkdirSync(TEAM_ASSETS, { recursive: true });

  const photoName = `${slug}.jpg`;
  const photoPath = join(TEAM_ASSETS, photoName);
  if (opts.photo) {
    writeFileSync(photoPath, opts.photo.buffer);
  } else if (!existsSync(photoPath)) {
    throw new Error("Team photo is required");
  }

  const data: Record<string, unknown> = {
    name: opts.name,
    role: opts.role,
    bio: opts.bio.replace(/\r\n/g, "\n"),
    credentials: opts.credentials ?? [],
    knowsAbout: opts.knowsAbout ?? [],
    photo: `../../assets/team/${photoName}`,
    sameAs: opts.sameAs ?? [],
  };
  if (opts.email) data.email = opts.email;

  const outPath = join(TEAM_DIR, `${slug}.md`);
  writeFileSync(outPath, serializeMarkdown(data, ""), "utf8");
  return { slug, path: outPath };
}
