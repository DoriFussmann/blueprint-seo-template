# Design Guide

Generic placeholder tokens for the Layer 1 template. Replace every value at Site Activation (Layer 2).

## Brand identity

Site Name is a calm, editorial publication system. Visual language is typographic first: a readable serif for article titles, a variable sans for interface and body, and a restrained blue accent used for links, focus, and primary actions. Imagery is documentary rather than decorative. There is no client mark in this template — the favicon is a geometric placeholder.

## Color palette

Background is a warm off-white. Text is near-black, never pure black. Accent blue is used for links and chrome, not large fills. Gold is a sparse highlight (hero rules, not body text). Muted stone is for bylines, captions, and secondary labels. All text/background pairs in this file meet WCAG AA.

## Typography

Primary UI and body: Inter variable. Display and article titles: Source Serif 4 variable. `font-display: swap`. No Google Fonts request in Layer 1 — both families are self-hosted via Fontsource. Body size is 1.125rem with a 1.7 line-height for long reading. Labels and admin UI stay on the sans family at a denser scale.

## Spacing & layout

Spacing unit is 4px. The same max-width container wraps every page. Article body uses that same container; a slightly tighter measure is applied only to the prose column for line length, never to the page chrome. Breakpoints follow a simple sm/md/lg/xl scale. Vertical rhythm is 6/8/12 spacing steps between sections.

## Imagery

Hero images are 16:9, `object-fit: cover`, width and height always present. Team photos are square. Alt text is required and descriptive.

## Voice & tone

Plain, specific, and operator-facing in the CMS. On the public site: editorial, complete sentences, no marketing superlatives in placeholder copy.

## Token block

Parseable JSON. `site/design-tokens.mjs` reads this fence and feeds `tailwind.config.mjs`.

```tokens
{
  "colors": {
    "bg": "#FAFAF7",
    "fg": "#1C1917",
    "accent": "#1D4E89",
    "accent-hover": "#163A66",
    "highlight": "#C4A35A",
    "muted": "#57534E",
    "border": "#E7E5E4",
    "surface": "#FFFFFF",
    "focus": "#1D4E89"
  },
  "fonts": {
    "sans": "Inter Variable",
    "serif": "Source Serif 4 Variable"
  },
  "typeScale": {
    "xs": "0.75rem",
    "sm": "0.875rem",
    "base": "1rem",
    "lg": "1.125rem",
    "xl": "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem"
  },
  "spacingUnit": "4px",
  "breakpoints": {
    "sm": "640px",
    "md": "768px",
    "lg": "1024px",
    "xl": "1280px"
  },
  "maxWidth": {
    "container": "72rem",
    "article": "72rem"
  }
}
```
