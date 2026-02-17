# Skilled

A static site generator where AI agent skills replace the framework.

## What This Is

You tell an AI agent what you want. The agent reads skills — folders with instructions, scripts, and references — and does the work. Standard HTML and CSS come out. No templating language, no framework API.

- **Skills replace the framework.** Capabilities like site building, image generation, and issue triage are delivered as skill folders with a `SKILL.md`, scripts, and reference materials.
- **The agent is the interface.** Claude Code, Codex, and similar agents discover skills in their native directories (`.claude/skills/`, `.codex/skills/`). The agent reads `SKILL.md` and acts.
- **Drop-in by design.** This project only uses skills + scripts: repo-contained, works immediately with minimal agent-specific setup. MCP is not prioritized because it still requires agent-specific tool registration.
- **You own the output.** Plain HTML, CSS, and config files. No proprietary format, no runtime dependency.
- **Core skills update cleanly.** `skills/` updates without touching your content.

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

- **Requires an AI agent.** 
- **Skills are natural language.** Different agents may interpret `SKILL.md` differently.
- **No incremental builds.** Full copy of `src/` to `dist/` every time.

## Quick Start

```bash
# Install skills directly from GitHub
npx skills add https://github.com/helincao/skilled/
```

Then, in your agent interface to invoke the `start-project` skill and say your project details.

This repo currently ships these skills:

1. `start-project`
2. `build`
3. `github-issues`
4. `image-gen`

Note: some of the skills require API keys. "github-issues" skill requires a GitHub token with `repo` scope. "image-gen" skill requires an Gemini key with access. Copy `.env.example` to `.env` and fill in the values for skills that need them.

## Skill Management

Skilled relies on the upstream `skills` CLI for all skill lifecycle operations.

Install core skills:

```bash
# Default install flow
npx skills add https://github.com/helincao/skilled/

# Target one agent
npx skills add https://github.com/helincao/skilled/ --all --agent codex --yes
npx skills add https://github.com/helincao/skilled/ --all --agent claude-code --yes

# Non-interactive install for both Codex and Claude Code
npx skills add https://github.com/helincao/skilled/ --all --agent codex --agent claude-code --yes
```

Inspect and maintain installed skills:

```bash
npx skills list
npx skills find "image"
npx skills check --all
npx skills update --all --yes
```

Create or remove skills:

```bash
npx skills init my-custom-skill --agent codex --yes
npx skills remove <skill-name> --agent codex --yes
```

## Reference Design

Project structure follows a simple ownership rule: `skills/` is upstream, everything else is yours.

Agents scan their native skill directory (typically `~/.claude/skills/` or `~/.codex/skills/`). Each entry is either:

- **A managed install** created by `skills add` from the remote repository
- **A real folder** for your custom skill that upstream never touches

Run `npx skills add https://github.com/helincao/skilled/ --all --agent codex --agent claude-code --yes` after pulling upstream updates to register any new core skills.

## Security

Skills are scripts that run on your machine with your user permissions. Same trust model as any local script you execute.

- **Review before merging.** Check `git diff` on `skills/` before running new skills.
- **API keys are shared.** All skills can read `.env`. Don't store secrets beyond what skills require.
- **Scripts run unsandboxed.** A compromised skill has full user-level access.
- **Custom skills are your responsibility.** Core skills are maintained upstream. Custom skills are on you.

### Customizing a core skill

To customize one core skill for a specific agent, install it as a non-linked copy:

```bash
npx skills remove build --agent codex --yes
npx skills add https://github.com/helincao/skilled/ --skill build --agent codex --link false --yes
```

That copy is now yours to edit. Upstream changes won't auto-apply until you reinstall/update it.

## Deployment

Point any static host at `dist/`. Build generates `sitemap.xml` and `robots.txt` automatically:

```bash
node skills/build/scripts/build.mjs --project-root .
```

Recommended pre-deploy check:

```bash
node skills/start-project/scripts/lint-site.mjs --project-root .
node skills/build/scripts/build.mjs --project-root .
node skills/start-project/scripts/validate-site.mjs --project-root .
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

File issues on [GitHub](https://github.com/helincao/skilled). For code: fork, feature branch, keep `skills/` generic, test with a fresh clone + invoke `start-project` + run lint/build/validate scripts, submit a PR.


## License

MIT
