import type { Config } from "tailwindcss";

/**
 * Design system aligned to the RYA brand: deep RYA navy, a confident RYA blue
 * accent, Fira Sans throughout. Functional status colours (starboard-green =
 * covered/confirmed, port-red = conflict, amber = attention) are kept.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0A2E52",
          50: "#eef4fa",
          700: "#0c3a68",
          800: "#0A2E52",
          900: "#071f39",
        },
        canvas: "#EEF3F8",
        // RYA blue — the primary accent (kept under the `teal` key so existing
        // bg-teal/text-teal usages re-skin to brand blue in one change).
        teal: {
          DEFAULT: "#0072CE",
          600: "#0072CE",
          700: "#005CAB",
        },
        ryablue: {
          DEFAULT: "#0072CE",
          bright: "#009EDB",
          dark: "#005CAB",
        },
        starboard: "#1E8E5A", // covered / confirmed
        port: "#C43D3D", // conflict
        // Expiring / attention. DEFAULT is the brand amber; the numbered shades are
        // Tailwind's standard amber scale, kept so warning banners (bg-amber-50,
        // text-amber-800 and so on) render. A bare string here would remove them.
        amber: {
          DEFAULT: "#B9821A",
          50: "#fffbeb", 100: "#fef3c7", 200: "#fde68a", 300: "#fcd34d", 400: "#fbbf24",
          500: "#f59e0b", 600: "#d97706", 700: "#b45309", 800: "#92400e", 900: "#78350f",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Fira Sans", "system-ui", "sans-serif"],
        display: ["var(--font-sans)", "Fira Sans", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "0.85rem",
      },
    },
  },
  plugins: [],
};

export default config;
