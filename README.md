# Skilled

Skill lifecycle manager for AI coding agents. Install, sync, and upstream skills across 40+ agents — Claude Code, Cursor, Copilot, Windsurf, Cline, Gemini CLI, and more — from any GitHub repo.

## The Problem

AI agent skills live as local files. Once copied in, they go stale. If you improve one locally, there's no easy way to push it back. Teams end up with diverged, out-of-date skills and no single source of truth.

## How Skilled Fixes It

```
┌──────────────────────┐
│ remote skill repo    │
│ team/skills          │
│ skill-1              │
│ skill-2              │
└───────┬────────┬─────┘
        │        ▲
        │        │  upstream
        │        │  skill-1 PR
        │        │
install / sync   │
        ▼        │
┌──────────────────────┐
│ local project repo   │
│ ~/projects/my-app    │
│ skills/skill-1       │
│ skills/skill-2       │
│ skills.lock.json     │
└──────────┬───────────┘
           │ git push
           │ optional pre-push:
           │ check
           ▼
┌──────────────────────┐
│ remote app repo      │
│ origin/team/my-app   │
└──────────────────────┘

  check: compare local copy vs tracked source,
  then keep local, sync, or upstream
```

## Features

- **Install** skills from any GitHub repo — specific skills, entire repos, or restore from lockfile
- **Search** available skills in a remote repo before installing
- **Sync** to pull latest upstream changes
- **Upstream** local improvements back to the source via pull request
- **Check** for drift — local modifications, remote updates, or conflicts
- **Auto-detect conflicts** on `git push` via a pre-push hook
- **Multi-agent** — supports 40+ coding agents out of the box
- **Structured output** via `--json` for scripting and agent consumption

## Install

```bash
npm install -g skilled
```

Or use directly:

```bash
npx skilled install <owner/repo>
```

## Quick Start

```bash
# Install all skills from a repo
skilled install <owner/repo>

# Install a specific skill
skilled install <owner/repo> --skill build

# Restore from lockfile (like npm install after a fresh clone)
skilled install

# Browse available skills in a repo
skilled search <owner/repo>

# Check for drift/conflicts with remote
skilled check

# Pull latest from remote
skilled sync

# Push local changes back upstream as a PR
skilled upstream build

# Set up pre-push hook for automatic conflict warnings
skilled hooks install
```

## Multi-Agent Support

Skilled supports 40+ coding agents. All skills are stored once in `.agents/skills/` — the canonical directory and single source of truth. For agents that read from a different directory (e.g. `.claude/skills`, `.windsurf/skills`), Skilled creates relative symlinks pointing back to the canonical copy. No duplication, no drift between agents.

Your instruction files (CLAUDE.md, .cursorrules, etc.) are yours to manage.

| Agent | Skills Dir | Symlink | Detection |
|-------|-----------|---------|-----------|
| AdaL | `.adal/skills` | yes | `.adal/` exists |
| Amp | `.agents/skills` | — | `.agents/` exists |
| Antigravity | `.agents/skills` | — | `.agents/` exists |
| Augment | `.augment/skills` | yes | `.augment/` exists |
| IBM Bob | `.bob/skills` | yes | `.bob/` exists |
| Claude Code | `.claude/skills` | yes | `.claude/` exists |
| Cline | `.agents/skills` | — | `.agents/` exists |
| CodeBuddy | `.codebuddy/skills` | yes | `.codebuddy/` exists |
| Codex | `.agents/skills` | — | `.agents/` exists |
| Command Code | `.commandcode/skills` | yes | `.commandcode/` exists |
| Continue | `.continue/skills` | yes | `.continue/` exists |
| GitHub Copilot | `.agents/skills` | — | `.agents/` exists |
| Cortex Code | `.cortex/skills` | yes | `.cortex/` exists |
| Crush | `.crush/skills` | yes | `.crush/` exists |
| Cursor | `.agents/skills` | — | `.cursor/`, `.cursorrules`, or `.agents/` exists |
| Deep Agents | `.agents/skills` | — | `.agents/` exists |
| Droid | `.factory/skills` | yes | `.factory/` exists |
| Firebender | `.agents/skills` | — | `.agents/` exists |
| Gemini CLI | `.agents/skills` | — | `.agents/` exists |
| Goose | `.goose/skills` | yes | `.goose/` exists |
| iFlow CLI | `.iflow/skills` | yes | `.iflow/` exists |
| Junie | `.junie/skills` | yes | `.junie/` exists |
| Kilo Code | `.kilocode/skills` | yes | `.kilocode/` exists |
| Kimi Code CLI | `.agents/skills` | — | `.agents/` exists |
| Kiro | `.kiro/skills` | yes | `.kiro/` exists |
| Kode | `.kode/skills` | yes | `.kode/` exists |
| MCPJam | `.mcpjam/skills` | yes | `.mcpjam/` exists |
| Mistral Vibe | `.vibe/skills` | yes | `.vibe/` exists |
| Mux | `.mux/skills` | yes | `.mux/` exists |
| Neovate | `.neovate/skills` | yes | `.neovate/` exists |
| OpenClaw | `skills` | yes | `.openclaw/`, `.clawdbot/`, or `.moltbot/` exists |
| OpenCode | `.agents/skills` | — | `.agents/` exists |
| OpenHands | `.openhands/skills` | yes | `.openhands/` exists |
| Pi | `.pi/skills` | yes | `.pi/` exists |
| Pochi | `.pochi/skills` | yes | `.pochi/` exists |
| Qoder | `.qoder/skills` | yes | `.qoder/` exists |
| Qwen Code | `.qwen/skills` | yes | `.qwen/` exists |
| Replit | `.agents/skills` | — | `.agents/` or `.replit` exists |
| Roo Code | `.roo/skills` | yes | `.roo/` exists |
| Trae | `.trae/skills` | yes | `.trae/` exists |
| Trae CN | `.trae/skills` | yes | `.trae/` exists |
| Warp | `.agents/skills` | — | `.agents/` exists |
| Windsurf | `.windsurf/skills` | yes | `.windsurf/` or `.windsurfrules` exists |
| Zencoder | `.zencoder/skills` | yes | `.zencoder/` exists |

Agents marked with **—** read directly from the canonical `.agents/skills/` directory. Agents marked with **yes** get symlinks created automatically during install/sync.

To target specific agents:

```bash
skilled install <owner/repo> --agent claude-code cursor
```

## Lockfile

Skilled tracks provenance in `skills.lock.json`:

```json
{
  "version": 1,
  "skills": {
    "build": {
      "name": "build",
      "repo": "<owner/repo>",
      "remotePath": "skills/build",
      "commitSha": "245d134...",
      "syncedAt": "2026-03-31T...",
      "installedHash": "a1b2c3d4..."
    }
  }
}
```

Each entry records the source repo, commit SHA, and a content hash. This lets Skilled detect local modifications, remote updates, and conflicts between the two.

## Commands

### `skilled install [repo]`

Pull skills from a GitHub repo into your local `skills/` directory. Without a repo argument, restores all skills from `skills.lock.json`.

| Flag | Description |
|------|-------------|
| `-s, --skill <name>` | Install only this skill |
| `-f, --force` | Overwrite existing local skills |
| `-a, --agent <types...>` | Target agent systems (auto-detects if omitted) |

Accepts `<owner/repo>`, HTTPS URLs, or SSH URLs.

### `skilled search <repo> [query]`

List available skills in a remote repo. With a query, filters by keyword.

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |

### `skilled list`

Show all tracked skills with their status: `clean`, `modified`, or `MISSING`.

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |

### `skilled check [skill]`

Compare local skills against their remote source.

| Symbol | Meaning |
|--------|---------|
| `✓` | Up to date |
| `↑` | Local changes (not yet upstreamed) |
| `↓` | Remote has updates |
| `⚡` | Conflict (both sides changed) |

Exits with code 1 if any conflicts are detected.

Remote change detection uses the **GitHub Tree SHA** for the skill's directory (stored as `treeSha` in the lockfile), not the repository-level commit SHA (`commitSha`). This means only changes to that specific skill directory trigger `remoteModified: true` — unrelated commits to other parts of the repo are ignored. To simulate a stale lockfile in tests, corrupt `treeSha`, not `commitSha`.

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |

### `skilled sync [skill]`

Pull the latest version from the remote source. Refuses to overwrite local changes unless `--force` is set.

| Flag | Description |
|------|-------------|
| `-f, --force` | Overwrite local modifications |

### `skilled upstream <skill>`

Create a pull request on the source repo with your local changes. Automatically forks if needed, creates a branch, and opens a PR.

Requires `GITHUB_TOKEN` or `GH_TOKEN` environment variable.

### `skilled hooks install`

Install a git `pre-push` hook that runs `skilled check` before every push. Warns (but does not block) if skills have un-upstreamed changes or conflicts.

## Demo Skills

This repo includes a set of [web-builder-skills](web-builder-skills/) for static-site workflows (`build`, `start-project`, `github-issues`, `image-gen`, `use-gmail`). These exist as a demo — try installing them with `skilled install helincao/skilled` to see the tool in action.

## Environment Variables

| Variable | Used by |
|----------|---------|
| `GITHUB_TOKEN` or `GH_TOKEN` | `upstream` command (PR creation) |

## License

MIT
