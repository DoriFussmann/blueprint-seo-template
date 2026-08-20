import { tokens } from "./design-tokens.mjs";

function remToScreens(breakpoints) {
  const screens = {};
  for (const [name, value] of Object.entries(breakpoints)) {
    screens[name] = value;
  }
  return screens;
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,ts}"],
  theme: {
    extend: {
      colors: {
        bg: tokens.colors.bg,
        fg: tokens.colors.fg,
        accent: {
          DEFAULT: tokens.colors.accent,
          hover: tokens.colors["accent-hover"],
        },
        highlight: tokens.colors.highlight,
        muted: tokens.colors.muted,
        border: tokens.colors.border,
        surface: tokens.colors.surface,
        focus: tokens.colors.focus,
      },
      fontFamily: {
        sans: [tokens.fonts.sans, "system-ui", "sans-serif"],
        serif: [tokens.fonts.serif, "Georgia", "serif"],
      },
      fontSize: tokens.typeScale,
      spacing: {
        unit: tokens.spacingUnit,
      },
      screens: remToScreens(tokens.breakpoints),
      maxWidth: {
        container: tokens.maxWidth.container,
        article: tokens.maxWidth.article,
      },
    },
  },
  plugins: [],
};
