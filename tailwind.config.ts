import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        paper: "#fbfaf7",
        ink: "#2d2a26",
        moss: "#697967",
        honey: "#d89b4a",
        clay: "#b8715d",
        mist: "#e8eee8"
      },
      boxShadow: {
        quiet: "0 18px 45px rgba(68, 56, 40, 0.08)"
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
