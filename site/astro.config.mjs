import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// TTFB is the priority. Ship static HTML from Cloudflare's edge.
// Inline critical CSS so the first paint fits in the initial TCP window.
export default defineConfig({
  output: "static",
  site: "https://ailb.pages.dev",
  compressHTML: true,
  build: {
    inlineStylesheets: "always",
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      watch: {
        usePolling: true,
        interval: 300,
      },
    },
  },
});
