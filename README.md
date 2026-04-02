# Skilled

Skill lifecycle manager for AI agent skills. Install skills from remote repos, keep them in sync, and upstream local changes — all in one tool.

## Why

AI agent skills (Claude Code, Cursor, Copilot) live as local directories. Once installed, they go stale. If you improve a skill locally, there's no easy way to push it back. Skilled solves the full lifecycle:

- **Search** available skills in any GitHub repo before installing
- **Install** skills from any GitHub repo with one command
- **Check** for drift between your local copy and the remote source
- **Sync** to pull the latest version from upstream
- **Upstream** local changes back to the source via pull request
- **Auto-detect** conflicts on `git push` via a pre-push hook
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

# Restore all skills from the lockfile (like npm install)
skilled install

# Install targeting specific agent systems
skilled install <owner/repo> --agent claude-code cursor copilot

# Browse available skills in a repo
skilled search <owner/repo>

# Search for a specific skill by keyword
skilled search <owner/repo> deploy

# See what you have
skilled list

# Check for drift/conflicts with remote
skilled check

# Pull latest from remote
skilled sync

# Push your local changes back upstream as a PR
skilled upstream build

# Set up pre-push hook for automatic reminders
skilled hooks install
```

## Multi-Agent Support

Skilled automatically detects which agent systems are configured in your project and generates instruction files so each agent knows about your installed skills.

### Supported Agents

| Agent | Instruction File | Detection |
|-------|-----------------|-----------|
| Claude Code | `CLAUDE.md` | `CLAUDE.md` or `.claude/` exists |
| Cursor | `.cursor/rules/skills.mdc` | `.cursor/` or `.cursorrules` exists |
| GitHub Copilot | `.github/copilot-instructions.md` | `.github/copilot-instructions.md` exists |
| Windsurf | `.windsurfrules` | `.windsurfrules` exists |
| Codex | `AGENTS.md` | `AGENTS.md` exists |

### How It Works

On `install` and `sync`, Skilled:

1. **Auto-detects** which agents are configured (or uses `--agent` if specified)
2. **Generates a managed block** in each agent's instruction file listing available skills
3. **Preserves existing content** — only the `<!-- skilled:managed-start -->` / `<!-- skilled:managed-end -->` block is touched

To target specific agents instead of auto-detecting:

```bash
skilled install <owner/repo> --agent claude-code cursor
```

## How It Works

Skilled tracks provenance in a `skills.lock.json` file:

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

Each skill entry records where it came from, what commit it was pulled at, and a content hash at install time. This allows Skilled to detect:

- **Local modifications** — your hash differs from the installed hash
- **Remote updates** — the remote HEAD differs from your recorded commit
- **Conflicts** — both local and remote have changed

## Commands

### `skilled install [repo]`

Pull skills from a GitHub repo into your local `skills/` directory. When called without a repo, restores all skills tracked in `skills.lock.json` — useful after a fresh clone or when `skills/` is gitignored. Skills are grouped by source repo to minimize network requests.

| Flag | Description |
|------|-------------|
| `-s, --skill <name>` | Install only this skill |
| `-f, --force` | Overwrite existing local skills |
| `-a, --agent <types...>` | Target agent systems (auto-detects if omitted) |

Accepts `<owner/repo>`, HTTPS URLs, or SSH URLs.

### `skilled search <repo> [query]`

Browse available skills in a remote repository. Without a query, lists all skills. With a query, filters by keyword match against skill name and description.

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |

### `skilled list`

Show all tracked skills with their status: `clean`, `modified`, or `MISSING`.

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |

### `skilled check [skill]`

Compare local skills against their remote source. Reports:
- `✓` Up to date
- `↑` Local changes (not yet upstreamed)
- `↓` Remote has updates
- `⚡` Conflict (both sides changed)

Exits with code 1 if any conflicts are detected.

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |

### `skilled sync [skill]`

Pull the latest version from the remote source.

| Flag | Description |
|------|-------------|
| `-f, --force` | Overwrite local modifications |

Refuses to overwrite local changes unless `--force` is set. Upstream your changes first, or use `--force` to discard them.

### `skilled upstream <skill>`

Create a pull request on the source repository with your local changes.

Requires `GITHUB_TOKEN` or `GH_TOKEN` environment variable. Automatically forks the repo if needed, creates a branch, and opens a PR.

### `skilled hooks install`

Install a git `pre-push` hook that runs `skilled check` before every push. Warns (but does not block) if skills have un-upstreamed changes or conflicts.

## Included Skills

This repo also ships a set of built-in skills for static-site workflows:

- `start-project` — Project setup plus lint/validation helpers
- `build` — Builds `src/` into `dist/` with sitemap and robots.txt
- `github-issues` — Triage and resolve GitHub issues from the CLI
- `image-gen` — Generate images for site/content workflows
- `use-gmail` — Gmail integration skill

## Environment Variables

| Variable | Used by |
|----------|---------|
| `GITHUB_TOKEN` or `GH_TOKEN` | `upstream` command (PR creation) |

## License

MIT
