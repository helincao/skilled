---
name: start-project
description: Primary project-initialization orchestrator for Skilled. Use when a repository is missing site files or needs a fresh architecture. Create required files directly from the brief, optionally apply `references/reference-design.md`, then run lint/build/validate quality gates via installed skill scripts.
---

# Start Project

Use this skill to create the first runnable site from a brief and enforce workflow gates as part of initialization.

## When to use

- The project is freshly cloned and missing `site.config.json`, `_partials/`, or `src/index.html`.
- The user asks to initialize/bootstrap/create a new site.
- The user wants an agent-generated project layout (not a fixed scaffold template).
- The user wants a reproducible quality workflow (`lint` + `build` + `validate`).

## Inputs

- Site name and project goal (required)
- Optional: preferred information architecture (single-page, multi-page, docs, blog, landing)
- Optional: style direction or design references
- Optional: base URL (default `https://example.com`) and locale (default `en_US`)
- Optional: whether to bias toward the opinionated reference design

## Steps

1. Resolve required inputs:
   1. Site name
   2. Project goal (what the site should accomplish)
2. Decide project shape:
   1. If the user asks for an opinionated default (or gives minimal design direction), read `references/reference-design.md` and use it as a starting point.
   2. If the user asks for another style/structure, design a custom file layout that still satisfies the build skill contract.
3. Create files directly from the agent (do not run scaffolding CLI by default):
   1. Required for build compatibility: `site.config.json`, `_partials/header.html`, `_partials/footer.html`, and at least one HTML page in `src/`.
   2. Add any additional pages/assets/scripts needed for the chosen architecture.
4. Resolve script locations:
   1. `PROJECT_ROOT`: target user project root
   2. `SKILL_DIR`: directory containing this `SKILL.md`
   3. `BUILD_SKILL_DIR`: sibling `build` skill directory (same parent as `SKILL_DIR`)
   4. If `BUILD_SKILL_DIR` is missing, stop and ask the user to install the `build` skill.
5. Run the workflow from project root:
   ```bash
   node "$SKILL_DIR/scripts/lint-site.mjs" --project-root "$PROJECT_ROOT"
   node "$BUILD_SKILL_DIR/scripts/build.mjs" --project-root "$PROJECT_ROOT"
   node "$SKILL_DIR/scripts/validate-site.mjs" --project-root "$PROJECT_ROOT"
   ```
6. Fix any failures and rerun until checks pass.
7. Report:
   1. Files created/updated
   2. Whether reference design or custom design was used
   3. Lint/build/validate status

## Output

- A complete, runnable project file set tailored to the user brief
- Required build-contract files:
  - `site.config.json`
  - `_partials/header.html`
  - `_partials/footer.html`
  - `src/**/*.html` (at least one page)
- Passing quality gates from installed scripts:
  - `lint-site.mjs`
  - `build.mjs`
  - `validate-site.mjs`
- `dist/` output generated from `build`

## Conventions

- Do not overwrite existing files unless explicitly requested.
- Keep compatibility with `build/scripts/build.mjs`.
- Use the opinionated reference design as a default option, not a hard requirement.
- Use `scripts/start-project.mjs` only when the user explicitly asks for the legacy CLI scaffold path.
