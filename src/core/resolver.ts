import { join, resolve as resolvePath } from "node:path";

export interface ResolvedRepo {
  /** "owner/repo" */
  slug: string;
  /** Full clone URL */
  cloneUrl: string;
  /** Owner */
  owner: string;
  /** Repo name */
  repo: string;
}

/**
 * Return true if the input looks like a local filesystem path rather than a
 * remote repo reference. Matches absolute paths and relative paths starting
 * with "./" or "../".
 */
export function isLocalPath(input: string): boolean {
  return (
    input.startsWith("/") ||
    input.startsWith("./") ||
    input.startsWith("../") ||
    input === "." ||
    input === ".."
  );
}

/**
 * Encode/decode a local path for storage in the lockfile repo field.
 * We use a "file:" prefix so sync/check can detect local installs.
 */
export function encodeLocalRepo(absolutePath: string): string {
  return `file:${absolutePath}`;
}

export function decodeLocalRepo(repo: string): string | null {
  return repo.startsWith("file:") ? repo.slice(5) : null;
}

/**
 * Resolve a repo reference to a clone URL and metadata.
 * Accepts:
 *   - "owner/repo"                          → HTTPS clone from github.com
 *   - "https://github.com/owner/repo"       → HTTPS clone (any host)
 *   - "git@github.com:owner/repo.git"       → SSH clone (any host, preserved as-is)
 */
export function resolveRepo(input: string): ResolvedRepo {
  // SSH format: git@<host>:owner/repo.git — preserve as SSH for cloning
  const sshMatch = input.match(/^git@([^:]+):(.+?)\/(.+?)(?:\.git)?$/);
  if (sshMatch) {
    const [, host, owner, repo] = sshMatch;
    return {
      slug: `${owner}/${repo}`,
      cloneUrl: `git@${host}:${owner}/${repo}.git`,
      owner,
      repo,
    };
  }

  // HTTPS format: https://<host>/owner/repo — any host
  const httpsMatch = input.match(
    /^https?:\/\/[^/]+\/(.+?)\/(.+?)(?:\.git)?\/?$/,
  );
  if (httpsMatch) {
    const [, owner, repo] = httpsMatch;
    // Normalize clone URL: ensure .git suffix
    const cloneUrl = input.replace(/\/?$/, "").replace(/(?<!\.git)$/, ".git");
    return {
      slug: `${owner}/${repo}`,
      cloneUrl,
      owner,
      repo,
    };
  }

  // Short format: owner/repo → defaults to github.com HTTPS
  const shortMatch = input.match(/^([^/]+)\/([^/]+)$/);
  if (shortMatch) {
    return {
      slug: input,
      cloneUrl: `https://github.com/${input}.git`,
      owner: shortMatch[1],
      repo: shortMatch[2],
    };
  }

  throw new Error(
    `Cannot resolve repo: "${input}". Use "owner/repo", an HTTPS URL, or an SSH URL.`,
  );
}

/**
 * Determine the skills directory within a cloned repo.
 * Looks for a "skills/" subdirectory; falls back to repo root.
 */
export function findSkillsRoot(cloneDir: string): string {
  return join(cloneDir, "skills");
}
