import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the built assets work when served from a GitHub Pages
// project site (https://<user>.github.io/<repo>/) as well as locally.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    host: true,
    port: 5173,
  },
});
