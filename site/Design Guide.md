# Design Guide

Neutral placeholder tokens for the template. Swap this file at Site Activation with the real brand guide. Do not treat these values as a client identity.

## Brand identity

Name: Site Name (template). Intended feel: calm, readable, editorial. Mission and values are filled at Activation. Emotional goal: visitors can scan and trust the content. Reference: a quiet publisher, not a SaaS dashboard. Anti-reference: neon startup chrome, heavy decoration.

## Color palette

Light mode only. Contrast target: WCAG AA.

- Primary: `#1F2937` (near-black ink)
- Secondary: `#4B5563` (slate)
- Accent: `#1D4E89` (muted blue, links and focus)
- Background: `#FAFAF9` (warm paper)
- Surface: `#FFFFFF`
- Border: `#E7E5E4`
- Muted text: `#78716C`
- Heading: `#1C1917`
- Body: `#44403C`
- Success: `#166534`
- Warning: `#B45309`
- Error: `#B91C1C`

Palette justification: ink-on-paper so long articles stay readable. Accent is only for links, focus rings, and a thin header rule.

## Typography

Google Fonts with `font-display: swap`. Headings: Source Serif 4. Body: Source Sans 3. Mono: ui-monospace.

Type scale (px / line-height):

- xs: 14 / 1.5
- sm: 16 / 1.6
- base: 18 / 1.7
- lg: 20 / 1.6
- xl: 24 / 1.4
- 2xl: 30 / 1.3
- 3xl: 36 / 1.2
- 4xl: 44 / 1.15

Weights: 400 body, 600 headings. Avoid 900.

## Spacing & layout

Base unit: 8px. Max container width: 72rem (page chrome, home, listing, team). Max article body width: 42rem (readable measure). Breakpoints: sm 640, md 768, lg 1024, xl 1280. Grid rhythm uses the 8px unit. Editorial, not dashboard-dense.

## Imagery & photography

Photography is documentary and specific. Avoid stock handshakes. Hero images are 16:9, cropped with `object-fit: cover`. Icons stay simple and monochrome.

## Tone, voice & motion

Tone: plain, specific, unhurried. Voice: explain, do not hype. Motion: none beyond smooth scroll and focus states.

## Explicit anti-patterns

Generic startup purple. `outline: none` with no replacement. Horizontal scroll at 200% zoom. Client-side style computation. Decorative animation. Invented testimonials or brand colors at template time.

<!-- tokens:start -->
{
  "colors": {
    "primary": "#1F2937",
    "secondary": "#4B5563",
    "accent": "#1D4E89",
    "background": "#FAFAF9",
    "surface": "#FFFFFF",
    "border": "#E7E5E4",
    "muted": "#78716C",
    "heading": "#1C1917",
    "body": "#44403C",
    "success": "#166534",
    "warning": "#B45309",
    "error": "#B91C1C"
  },
  "fonts": {
    "heading": ["Source Serif 4", "Georgia", "serif"],
    "body": ["Source Sans 3", "system-ui", "sans-serif"],
    "mono": ["ui-monospace", "monospace"]
  },
  "fontSize": {
    "xs": ["14px", { "lineHeight": "1.5" }],
    "sm": ["16px", { "lineHeight": "1.6" }],
    "base": ["18px", { "lineHeight": "1.7" }],
    "lg": ["20px", { "lineHeight": "1.6" }],
    "xl": ["24px", { "lineHeight": "1.4" }],
    "2xl": ["30px", { "lineHeight": "1.3" }],
    "3xl": ["36px", { "lineHeight": "1.2" }],
    "4xl": ["44px", { "lineHeight": "1.15" }]
  },
  "spacingUnit": 8,
  "maxContainer": "72rem",
  "maxArticle": "42rem",
  "screens": {
    "sm": "640px",
    "md": "768px",
    "lg": "1024px",
    "xl": "1280px"
  },
  "googleFonts": [
    "Source+Serif+4:wght@400;600",
    "Source+Sans+3:wght@400;600"
  ]
}
<!-- tokens:end -->
