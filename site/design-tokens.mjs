import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const guidePath = path.join(root, "Design Guide.md");

const FALLBACK = {
  colors: {
    primary: "#1F2937",
    secondary: "#4B5563",
    accent: "#1D4E89",
    background: "#FAFAF9",
    surface: "#FFFFFF",
    border: "#E7E5E4",
    muted: "#78716C",
    heading: "#1C1917",
    body: "#44403C",
    success: "#166534",
    warning: "#B45309",
    error: "#B91C1C",
  },
  fonts: {
    heading: ["Source Serif 4", "Georgia", "serif"],
    body: ["Source Sans 3", "system-ui", "sans-serif"],
    mono: ["ui-monospace", "monospace"],
  },
  fontSize: {
    xs: ["14px", { lineHeight: "1.5" }],
    sm: ["16px", { lineHeight: "1.6" }],
    base: ["18px", { lineHeight: "1.7" }],
    lg: ["20px", { lineHeight: "1.6" }],
    xl: ["24px", { lineHeight: "1.4" }],
    "2xl": ["30px", { lineHeight: "1.3" }],
    "3xl": ["36px", { lineHeight: "1.2" }],
    "4xl": ["44px", { lineHeight: "1.15" }],
  },
  spacingUnit: 8,
  maxContainer: "72rem",
  maxArticle: "42rem",
  screens: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
  },
  googleFonts: [
    "Source+Serif+4:wght@400;600",
    "Source+Sans+3:wght@400;600",
  ],
};

export function loadDesignTokens() {
  try {
    const raw = fs.readFileSync(guidePath, "utf8");
    const match = raw.match(
      /<!--\s*tokens:start\s*-->\s*([\s\S]*?)\s*<!--\s*tokens:end\s*-->/i
    );
    if (!match) return FALLBACK;
    const parsed = JSON.parse(match[1]);
    return { ...FALLBACK, ...parsed, colors: { ...FALLBACK.colors, ...parsed.colors } };
  } catch {
    return FALLBACK;
  }
}

export const tokens = loadDesignTokens();
