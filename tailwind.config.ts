import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0a0a0a",
        paper: "#fafafa",
        brand: {
          50: "#f0f4ff",
          100: "#e0e9ff",
          200: "#c2d3ff",
          300: "#9ab3ff",
          400: "#6d8bff",
          500: "#4a63f5",
          600: "#3a47db",
          700: "#2f37b0",
          800: "#282f8c",
          900: "#242a6e",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(0,0,0,0.04), 0 1px 3px 0 rgba(0,0,0,0.06)",
        "card-hover": "0 4px 12px -2px rgba(20,20,43,0.08), 0 2px 6px -2px rgba(20,20,43,0.06)",
        glow: "0 0 0 1px rgba(74,99,245,0.1), 0 8px 24px -4px rgba(74,99,245,0.25)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #4a63f5 0%, #7c3aed 50%, #ec4899 100%)",
        "brand-gradient-soft": "linear-gradient(135deg, #eef2ff 0%, #faf5ff 50%, #fdf2f8 100%)",
        "mesh-radial":
          "radial-gradient(circle at 20% 20%, rgba(74,99,245,0.15), transparent 40%), radial-gradient(circle at 80% 0%, rgba(236,72,153,0.12), transparent 40%), radial-gradient(circle at 50% 100%, rgba(124,58,237,0.1), transparent 45%)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.5s ease-out both",
        "fade-in-up": "fade-in-up 0.6s cubic-bezier(0.16,1,0.3,1) both",
        "scale-in": "scale-in 0.35s cubic-bezier(0.16,1,0.3,1) both",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
