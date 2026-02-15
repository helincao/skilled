# Skilled

A static site generator where AI agent skills replace the framework.

## What This Is

You tell an AI agent what you want. The agent reads skills — folders with instructions, scripts, and references — and does the work. Standard HTML and CSS come out. No templating language, no framework API.

- **Skills replace the framework.** Capabilities like site building, image generation, and issue triage are delivered as skill folders with a `SKILL.md`, scripts, and reference materials.
- **The agent is the interface.** Claude Code, Codex, and similar agents discover skills in their native directories (`.claude/skills/`, `.codex/skills/`). The agent reads `SKILL.md` and acts.
- **Drop-in by design.** This project only uses skills + scripts: repo-contained, works immediately with minimal agent-specific setup. MCP is not prioritized because it still requires agent-specific tool registration and authentication setup.
- **You own the output.** Plain HTML, CSS, and config files. No proprietary format, no runtime dependency.
- **Core skills update cleanly.** `skills/` updates via `git merge` without touching your content.

Frameworks give developers abstractions to code against. Skills give agents instructions to act on. The unit of reuse is a workflow, not a library.

## How It Compares

|  | **Skilled** | **Jekyll / Hugo / 11ty** |
|---|:---:|:---:|
| Static output, simple hosting | Yes | Yes |
| No database required | Yes | Yes |
| Natural language authoring | Yes | No |
| AI-native workflow (scaffold, build, image generation, issue triage) | Yes | No |
| Framework/templating language to learn | No | Yes |
| Content generated, not just templated | Yes | No |
| Built-in image generation | Yes | No |
| Built-in issue triage | Yes | No |

**Trade-offs:**

- **Requires an AI agent.** Without one, you can still `npm run build`, but you lose the skill-powered workflow.
- **Skills are natural language.** Different agents may interpret `SKILL.md` differently.
- **No incremental builds.** Full copy of `src/` to `dist/` every time.

## Quick Start

```bash
npx degit helincao/skilled my-site
cd my-site
npm install
npm run setup:skills

# Optional: target one agent
npm run setup:skills --agent=claude
npm run setup:skills --agent=codex

# In your agent:
/start-project
```

This package currently ships these skills:

1. `start-project`
2. `build`
3. `github-issues`
4. `image-gen`


## Project Structure

### At clone time

```
my-site/
├── skills/
│   ├── start-project/                  # Agent-first project creation + workflow checks
│   ├── build/                          # Assembles src/ → dist/
│   ├── github-issues/                  # Triages GitHub issues
│   └── image-gen/                      # Generates images via AI
│
├── setup-skills.mjs                    # Creates symlinks for agent discovery
├── package.json
├── .env.example
└── .gitignore
```

No `src/`, no `_partials/`, no `site.config.json` yet. `/start-project` creates these directly (agent-first), with an optional legacy scaffold fallback.

### After `npm run setup:skills`

```
my-site/
├── skills/...                          # Unchanged
├── .claude/skills/
│   ├── start-project -> ../../skills/start-project
│   ├── build -> ../../skills/build
│   ├── github-issues -> ../../skills/github-issues
│   └── image-gen -> ../../skills/image-gen
├── .codex/skills/
│   ├── start-project -> ../../skills/start-project
│   ├── build -> ../../skills/build
│   ├── github-issues -> ../../skills/github-issues
│   └── image-gen -> ../../skills/image-gen
├── package.json
└── .env.example
```

### After `/start-project`

```
my-site/
├── skills/...                          # Unchanged
├── .claude/skills/...                  # Unchanged
├── .codex/skills/...                   # Unchanged
│
├── site.config.json
├── _partials/
│   ├── header.html
│   └── footer.html
│
├── src/
│   ├── index.html
│   ├── css/
│   │   ├── input.css
│   │   └── site.css
│   ├── js/
│   └── images/
│
├── content/
└── dist/                               # Created after running build
```

**The rule:** `skills/` is upstream. Everything else is yours.

## Skills

A skill is a folder:

```
my-skill/
├── SKILL.md              # Instructions for the agent (required)
├── scripts/              # CLI tools the agent runs (optional)
│   └── my-tool.mjs
└── references/           # Context documents (optional)
```

### SKILL.md specification

Every skill needs a `SKILL.md`. This is the contract between the skill and the agent.

| Section | Required | Purpose |
|---|---|---|
| **Title and summary** | Yes | One-line description |
| **When to use** | Yes | Trigger conditions |
| **Inputs** | Yes | What the skill needs (user input, files, env vars) |
| **Steps** | Yes | Ordered instructions |
| **Output** | Yes | What the skill produces (files, side effects) |
| **Conventions** | No | Project-specific rules |
| **Examples** | No | Sample invocations |

**Scripts** are plain Node.js CLI tools. Node.js built-ins only (plus declared `package.json` dependencies). Input via CLI args, output to stdout or files. Exit 0 on success, non-zero on failure.

**References** are static files the agent reads for context. Never executed.

### Discovery

Agents scan their native directory (`.claude/skills/`, `.codex/skills/`). Each entry is either:

- **A symlink** to `skills/<name>` — core skill, updates via merge
- **A real folder** — your custom skill, upstream never touches it

Run `npm run setup:skills` (or `node setup-skills.mjs`) after pulling upstream updates to create symlinks for new core skills. By default it syncs both Claude and Codex directories.

To sync only one agent, pass `--agent`:

```bash
npm run setup:skills --agent=claude
npm run setup:skills --agent=codex
# or direct CLI args:
node setup-skills.mjs --project-root . --agent claude
```

### Dependencies between skills

Skills can depend on other skills. For example, `start-project` creates `src/` and `_partials/`, then runs quality gates (`lint:site`, `build`, `validate:site`). Dependencies are documented in each `SKILL.md`. The agent chains skills in the right order — no automatic resolution.

### Included skills

| Skill | Invoke | What it does | Env vars |
|---|---|---|---|
| `start-project` | `/start-project` | Creates project files directly from a brief, optionally using an opinionated reference design, then runs lint/build/validate workflow | — |
| `build` | `/build` | Compiles CSS, injects partials and SEO into `dist/`, generates sitemap and robots.txt | — |
| `github-issues` | `/github-issues` | Triages and addresses GitHub issues | `GITHUB_API_KEY`, `GITHUB_REPOSITORY` |
| `image-gen` | `/image-gen` | Generates images via AI (Google Gemini) | `GEMINI_API_KEY` |

Copy `.env.example` to `.env` and fill in the values for skills that need them.

### Custom skills

Create a folder in `.claude/skills/` or `.codex/skills/` with a `SKILL.md`. Follow the spec above. Custom skills are real folders, not symlinks — upstream updates never touch them.

## Security

Skills are scripts that run on your machine with your user permissions. Same trust model as npm packages.

- **Review before merging.** Check `git diff` on `skills/` before running new skills.
- **API keys are shared.** All skills can read `.env`. Don't store secrets beyond what skills require.
- **Scripts run unsandboxed.** A compromised skill has full user-level access.
- **Custom skills are your responsibility.** Core skills are maintained upstream. Custom skills are on you.

## Upstream Updates

`skills/` updates via `git merge`. You never edit `skills/`, so merges are clean.

```bash
# One-time: add remote
git remote add skilled https://github.com/helincao/skilled.git

# Update
git fetch skilled
git merge skilled/main

# Review
git diff HEAD~1 -- skills/ setup-skills.mjs

# Symlink new skills
npm run setup:skills
```

### Ejecting a skill

To customize a core skill, copy it out of `skills/`:

```bash
cp -r skills/build .claude/skills/build
# The real folder replaces the symlink
```

That skill is now yours. Upstream changes won't affect it. Ejection is one-way — no mechanism to selectively merge upstream changes back in.

## Deployment

Point any static host at `dist/`. Build command is `npm run build` everywhere. Build generates `sitemap.xml` and `robots.txt` automatically.

Recommended pre-deploy check:

```bash
npm run check:site
```

Works with Cloudflare Pages, Netlify, GitHub Pages, Vercel — anything that serves static files.

## Limitations

- **No incremental builds.** Full `src/` copy every time. Fine for most sites.
- **No content lifecycle.** No drafts, no scheduling. Files exist or they don't.
- **No asset pipeline.** No image optimization, no responsive images, no minification by default.
- **No skill versioning.** No semver, no changelog. Review diffs before merging.
- **Single-agent workflow.** No multi-agent coordination. Use git for conflicts.
- **Agent portability varies.** Tested with Claude Code. Other agents may interpret skills differently.

## Contributing

File issues on [GitHub](https://github.com/helincao/skilled). For code: fork, feature branch, keep `skills/` generic, test with a fresh clone + `/start-project` + `npm run check:site`, submit a PR.

**Guidelines:**

- Everything is a skill. New capabilities go in `skills/<name>/`.
- Skills are self-contained. `SKILL.md` alone should be enough.
- Follow the spec. Required sections: title, when to use, inputs, steps, output.
- Zero build dependencies. Node.js built-ins only.

### Backlog

Priority order.

| # | Feature | Why |
|---|---|---|
| 1 | **Complete core skill set** | `start-project`, `build`, `github-issues`, and `image-gen` are in `skills/`; add `create-page` for full authoring flow. |
| 2 | **Improve `setup-skills.mjs` lifecycle** | Add stale-link cleanup and richer reporting so upgrades stay deterministic in long-lived repos. |
| 3 | **Build-time validation** | Check well-formed HTML, required meta fields, broken links, missing images before they reach `dist/`. |
| 4 | **`SKILL.md` linter** | Validate skills against the spec — required sections present. Run in CI or standalone. |
| 5 | **Incremental builds** | Track file hashes. Only process changed files. Matters past ~50 pages. |
| 6 | **Changelog and release tags** | Semver tags and `CHANGELOG.md` so consumers know what changed. |
| 7 | **Draft support** | `draft: true` in the meta block. Build skips drafts from `dist/` and `sitemap.xml`. |
| 8 | **Asset optimization** | Image compression, `srcset`, cache-busting hashes. New `optimize` skill or extend `build`. |
| 9 | **Agent adapter system** | Detect `.claude/`, `.codex/`, `.cursor/`, etc. and create symlinks in each. |
| 10 | **Skill test harness** | Fixtures (input + expected output) in `tests/` per skill. Run via `node test-skills.mjs`. |

## License

MIT
