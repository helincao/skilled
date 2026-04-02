import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["bin/skilled.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist/bin",
  splitting: false,
  sourcemap: true,
  clean: true,
  bundle: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  // Don't bundle CJS deps — let Node resolve them at runtime
  external: ["commander", "simple-git", "octokit", "chalk"],
});
