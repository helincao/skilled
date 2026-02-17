# Skilled

`Skilled` is a static-site workflow where AI skills replace the framework.
You describe what you want, the agent runs skills, and you keep plain HTML/CSS output.

## Why Use It

- **Workflow-first:** Reusable skills (`SKILL.md` + scripts) instead of framework APIs.
- **Agent-native:** Works with agents that read skill folders (for example Codex and Claude Code).
- **Portable output:** Build artifacts are standard static files you can host anywhere.

## Included Skills

- `start-project`: Project setup plus lint/validation helpers.
- `build`: Builds `src/` into `dist/` and generates `sitemap.xml` and `robots.txt`.
- `github-issues`: Triage and resolve GitHub issues from the CLI.
- `image-gen`: Generate images for site/content workflows.

## Quick Start

Install from GitHub:

```bash
npx skills add https://github.com/helincao/skilled/
```

Then in your agent, invoke `start-project` and provide your project details.
Use the reference scaffolding by default unless you intentionally want to diverge from the baseline architecture.

## Reference Scaffolding

Skilled ships an opinionated reference scaffolding that core skills work best with.
Start from this baseline first, then adapt it to your project needs.

Reference: [`skills/start-project/references/reference-design.md`](skills/start-project/references/reference-design.md)

## Required Keys

Some skills need credentials. Copy `.env.example` to `.env` and set only what you use:

- `github-issues`: GitHub token (`repo` scope).
- `image-gen`: Gemini API key.

## Common Skill Commands

```bash
# Install/update/check
npx skills add https://github.com/helincao/skilled/ --all --agent codex --agent claude-code --yes
npx skills check --all
npx skills update --all --yes

# Explore installed skills
npx skills list
npx skills find "image"
```

Customize one core skill (non-linked copy):

```bash
npx skills remove build --agent codex --yes
npx skills add https://github.com/helincao/skilled/ --skill build --agent codex --link false --yes
```

## Build and Deploy

Run local checks before deploy:

```bash
node skills/start-project/scripts/lint-site.mjs --project-root .
node skills/build/scripts/build.mjs --project-root .
node skills/start-project/scripts/validate-site.mjs --project-root .
```

Deploy `dist/` to any static host (Cloudflare Pages, Netlify, GitHub Pages, Vercel, etc.).

## Security Notes

- Skills execute as local scripts with your user permissions.
- Review `skills/` changes before running new or updated skills.
- Treat `.env` as shared across skills in this repo.

## Current Limits

- No incremental build pipeline (full `src/` copy each build).
- No built-in asset optimization/minification pipeline.
- Skill behavior can vary by agent implementation.

## License

MIT
