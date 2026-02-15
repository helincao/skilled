---
name: build
description: Internal utility skill for regenerating site output. Use after any change to `src/`, `_partials/`, or `site.config.json`, or whenever another skill requires refreshed `dist/` artifacts. Runs `skills/build/scripts/build.mjs` through `npm run build`.
---

# Build

## Inputs

- Project root containing `src/`, `_partials/`, and `site.config.json`
- Optional precompiled CSS at `src/css/site.css`

## Steps

1. From project root, run:
   ```bash
   npm run build
   ```
2. If npm scripts are unavailable, run:
   ```bash
   node skills/build/scripts/build.mjs --project-root .
   ```
3. Confirm `dist/` exists and contains built HTML files.
4. If this skill is called by another skill workflow, fail fast on build errors and return the exact error text.

## Output

- `dist/` refreshed from `src/`
- Header/footer partials injected in built HTML files
- SEO/canonical/Open Graph metadata injected from `<!-- meta -->` blocks
- `dist/sitemap.xml` and `dist/robots.txt` regenerated

## Conventions

- Treat this as deterministic infrastructure: do not invent content here.
- Prefer calling via `npm run build` so repo-level scripts remain the single interface.
