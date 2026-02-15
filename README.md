# Skilled

A static site generator where AI agent skills replace the framework.

## What This Is

You tell an AI agent what you want. The agent reads skills — folders with instructions, scripts, and references — and does the work. Standard HTML and CSS come out. No templating language, no framework API.

- **Skills replace the framework.** Capabilities like site building, image generation, and issue triage are delivered as skill folders with a `SKILL.md`, scripts, and reference materials.
- **The agent is the interface.** Claude Code, Codex, and similar agents discover skills in their native directories (`.claude/skills/`, `.codex/skills/`). The agent reads `SKILL.md` and acts.
- **Drop-in by design.** This project only uses skills + scripts: repo-contained, works immediately with minimal agent-specific setup. MCP is not prioritized because it still requires agent-specific tool registration.
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
npm run setup:skills --agent=claude  # Claude Code
npm run setup:skills --agent=codex  # OpenAI Codex
```

Then, in your agent interface:

- Codex: `/start-project` or `$start-project`
- Claude Code: `/start-project` or plain language, e.g. "start a project"

This package currently ships these skills:

1. `start-project`
2. `build`
3. `github-issues`
4. `image-gen`

Copy `.env.example` to `.env` and fill in the values for skills that need them.

## Reference Design

Project structure follows a simple ownership rule: `skills/` is upstream, everything else is yours.

Agents scan their native skill directory (`.claude/skills/` or `.codex/skills/`). Each entry is either:

- **A symlink** to `skills/<name>` for a core skill that updates via merge
- **A real folder** for your custom skill that upstream never touches

Run `npm run setup:skills` after pulling upstream updates to create symlinks for any new core skills.

To create a custom skill, add a folder with `SKILL.md` under `.claude/skills/` or `.codex/skills/`. Keep it as a real folder (not a symlink) so upstream updates cannot overwrite it.

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

File issues on [GitHub](https://github.com/helincao/skilled). For code: fork, feature branch, keep `skills/` generic, test with a fresh clone + invoke `start-project` + `npm run check:site`, submit a PR.


## License

MIT
