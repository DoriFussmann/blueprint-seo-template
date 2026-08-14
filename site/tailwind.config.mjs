import { tokens } from "./design-tokens.mjs";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,ts}"],
  theme: {
    screens: tokens.screens,
    extend: {
      colors: tokens.colors,
      fontFamily: {
        heading: tokens.fonts.heading,
        body: tokens.fonts.body,
        sans: tokens.fonts.body,
        mono: tokens.fonts.mono,
      },
      fontSize: tokens.fontSize,
      maxWidth: {
        container: tokens.maxContainer,
        article: tokens.maxArticle,
      },
      spacing: {
        unit: `${tokens.spacingUnit}px`,
      },
    },
  },
  plugins: [],
};
