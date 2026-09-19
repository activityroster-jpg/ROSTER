import type { Config } from "tailwindcss";

/**
 * Design system (brief §10): chart-plotter feel — navy sidebar, cool light
 * canvas, teal accent, with status colours starboard-green (covered/confirmed),
 * port-red (conflict) and amber (expiring/attention).
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
          DEFAULT: "#0F2A3F",
          50: "#f0f5f9",
          700: "#12324b",
          800: "#0F2A3F",
          900: "#0a1d2c",
        },
        canvas: "#F4F7FA",
        teal: {
          DEFAULT: "#0C6B74",
          600: "#0C6B74",
          700: "#095860",
        },
        starboard: "#1E8E5A", // covered / confirmed
        port: "#C43D3D", // conflict
        amber: "#B9821A", // expiring / attention
      },
      fontFamily: {
        sans: ["var(--font-plex-sans)", "IBM Plex Sans", "system-ui", "sans-serif"],
        display: ["var(--font-spectral)", "Spectral", "Georgia", "serif"],
      },
      borderRadius: {
        card: "0.75rem",
      },
    },
  },
  plugins: [],
};

export default config;
