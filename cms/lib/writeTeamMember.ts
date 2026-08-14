import fs from "node:fs";
import path from "node:path";
import type { TeamFrontmatter } from "./schema.ts";
import { serializeTeamMarkdown } from "./serialize.ts";
import { TEAM_DIR, TEAM_ASSETS_DIR, teamPhotoRel } from "./paths.ts";

export interface StagedFile {
  buffer: Buffer;
  originalName: string;
  mime?: string;
}

export function writeTeamMember(options: {
  data: TeamFrontmatter;
  photo?: StagedFile | null;
}): { slug: string; path: string } {
  const slug = String(options.data.slug || "").trim();
  if (!slug) throw new Error("team slug is required");

  let photoRel = options.data.photo || "";
  if (options.photo) {
    const ext = path.extname(options.photo.originalName || "").toLowerCase() || ".png";
    fs.mkdirSync(TEAM_ASSETS_DIR, { recursive: true });
    const destPhoto = path.join(TEAM_ASSETS_DIR, `${slug}${ext}`);
    fs.writeFileSync(destPhoto, options.photo.buffer);
    photoRel = teamPhotoRel(slug, ext);
  }
  if (!photoRel) throw new Error("team photo is required");

  const dest = path.join(TEAM_DIR, `${slug}.md`);
  fs.mkdirSync(TEAM_DIR, { recursive: true });
  fs.writeFileSync(
    dest,
    serializeTeamMarkdown({ ...options.data, slug, photo: photoRel }),
    "utf8"
  );
  return { slug, path: dest };
}
