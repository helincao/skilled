# Reference Design: Opinionated Static Site Baseline

Use this reference when a user asks for a solid default, does not care about a custom architecture, or wants a conventional marketing/docs hybrid.

## When to pick this design

- User gives high-level goals but few structural details
- User wants maintainable defaults over novel layout decisions
- User needs quick iteration with predictable SEO and navigation behavior

## Design principles

1. Keep output plain HTML/CSS/JS, easy to host anywhere
2. Keep pages source-first in `src/`, build output in `dist/`
3. Use shared partial markers for header/footer so build-time injection stays deterministic
4. Require quality gates before handing off: lint -> build -> validate

## Minimum file map

```text
site.config.json
_partials/
  header.html
  footer.html
src/
  index.html
  css/
    input.css
    site.css
  js/
  images/
content/
```

## Page contract (`src/**/*.html`)

Each page should include:

1. `<!DOCTYPE html>` and standard `<html>`, `<head>`, `<body>`
2. A `<!-- meta -->` block with at least:
   1. `title`
   2. `description`
   3. Optional `og_image`
3. Header and footer marker comments:
   1. `HEADER (from _partials/header.html)`
   2. `FOOTER (from _partials/footer.html)`

## Config contract (`site.config.json`)

Required keys:

1. `siteName`
2. `baseUrl`
3. `defaultDescription`
4. `defaultOgImage`
5. `locale`

## Workflow contract

Ensure these package scripts exist:

1. `lint:site`: source structure + metadata checks
2. `build`: `src/` -> `dist/`, partial and SEO injection
3. `validate:site`: output-level checks in `dist/`
4. `check:site`: runs `lint:site && build && validate:site`

## Customization guidance

- Change visual style freely (colors, typography, layout).
- Add new pages and sections freely.
- Keep build contract intact (`site.config.json`, `_partials/`, and HTML files in `src/`) unless the user asks to redesign the build pipeline too.
