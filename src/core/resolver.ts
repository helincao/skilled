import { join } from "node:path";

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
