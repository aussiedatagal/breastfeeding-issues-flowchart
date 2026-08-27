import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// On GitHub Pages a project site is served from https://<user>.github.io/<repo>/,
// so assets must be requested from "/<repo>/". The deploy workflow sets
// GITHUB_REPOSITORY ("<user>/<repo>"); locally we serve from root.
const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
const base = process.env.VITE_BASE ?? (repo ? `/${repo}/` : "/");

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
