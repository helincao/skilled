import { Octokit } from "octokit";
import { log } from "../utils/logger.js";
import { retry, isTransient } from "../utils/retry.js";

/** Timeout for individual HTTP requests (ms). */
const REQUEST_TIMEOUT = 30_000;

/** Maximum time to wait for a rate-limit reset (ms). */
const MAX_RATE_LIMIT_WAIT = 60_000;

export function getGitHubToken(): string | undefined {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || undefined;
}

export function getOctokit(): Octokit {
  const token = getGitHubToken();
  if (!token) {
    throw new Error(
      "GitHub token required. Set GITHUB_TOKEN or GH_TOKEN environment variable.",
    );
  }
  return new Octokit({
    auth: token,
    request: { timeout: REQUEST_TIMEOUT },
  });
}

/**
 * Quick connectivity check — fails fast if GitHub API is unreachable.
 * Returns true if reachable, false otherwise.
 */
export async function isGitHubReachable(): Promise<boolean> {
  try {
    await fetch("https://api.github.com/zen", {
      signal: AbortSignal.timeout(5_000),
    });
    return true;
  } catch {
    return false;
  }
}

export interface CreatePrOptions {
  owner: string;
  repo: string;
  title: string;
  body: string;
  head: string;
  base: string;
}

/** Create a pull request on the upstream repo. */
export async function createPullRequest(
  opts: CreatePrOptions,
): Promise<string> {
  const octokit = getOctokit();
  const { data } = await retry(
    () =>
      octokit.rest.pulls.create({
        owner: opts.owner,
        repo: opts.repo,
        title: opts.title,
        body: opts.body,
        head: opts.head,
        base: opts.base,
      }),
    { label: "create pull request" },
  );
  return data.html_url;
}

/** Check if the authenticated user has a fork of the given repo. */
export async function ensureFork(
  owner: string,
  repo: string,
): Promise<{ owner: string; repo: string }> {
  const octokit = getOctokit();

  // Try to create a fork (idempotent — returns existing fork if one exists)
  const { data } = await retry(
    () => octokit.rest.repos.createFork({ owner, repo }),
    { label: `fork ${owner}/${repo}` },
  );

  log.dim(`Fork: ${data.full_name}`);
  return { owner: data.owner.login, repo: data.name };
}

/** Get the default branch of a repo. */
export async function getDefaultBranch(
  owner: string,
  repo: string,
): Promise<string> {
  const octokit = getOctokit();
  const { data } = await retry(
    () => octokit.rest.repos.get({ owner, repo }),
    { label: `get default branch for ${owner}/${repo}` },
  );
  return data.default_branch;
}

/**
 * Find an existing open PR from the given head ref.
 * Returns the PR URL if one exists, null otherwise.
 * Throws on auth/permission errors — only swallows transient failures.
 */
export async function findExistingPR(
  owner: string,
  repo: string,
  head: string,
): Promise<string | null> {
  const octokit = getOctokit();
  try {
    const { data } = await retry(
      () =>
        octokit.rest.pulls.list({
          owner,
          repo,
          head,
          state: "open",
          per_page: 1,
        }),
      { label: "find existing PR", silent: true },
    );
    return data.length > 0 ? data[0].html_url : null;
  } catch (err) {
    // Let auth/permission errors propagate — they indicate real problems
    if (!isTransient(err)) throw err;
    log.warn(`Could not check for existing PRs (network issue). Proceeding without.`);
    return null;
  }
}

/**
 * Check if a branch exists on a remote.
 * Returns false for 404 (not found). Retries on transient errors.
 * Throws on auth/permission errors.
 */
export async function remoteBranchExists(
  owner: string,
  repo: string,
  branch: string,
): Promise<boolean> {
  const octokit = getOctokit();
  try {
    await retry(
      () => octokit.rest.repos.getBranch({ owner, repo, branch }),
      { label: `check branch ${branch}`, silent: true },
    );
    return true;
  } catch (err) {
    // 404 = branch doesn't exist (expected)
    if (err && typeof err === "object" && (err as { status?: number }).status === 404) {
      return false;
    }
    // Transient errors after retries exhausted — treat as "unknown, assume not there"
    if (isTransient(err)) {
      log.warn(`Could not check if branch "${branch}" exists (network issue). Assuming it does not.`);
      return false;
    }
    // Auth/permission errors should propagate
    throw err;
  }
}

export type FetchTreeResult =
  | { status: "ok"; sha: string }
  | { status: "not_found" }
  | { status: "network_error"; message: string }
  | { status: "rate_limited"; resetsAt?: string };

/**
 * Fetch the tree SHA for a skill folder using the GitHub Trees API.
 * Makes a single HTTP request per branch attempt — no clone needed.
 *
 * Returns a typed result so callers can distinguish between network
 * errors, rate limits, and genuine "not found" cases.
 */
export async function fetchTreeSha(
  owner: string,
  repo: string,
  skillPath: string,
): Promise<string | null>;
export async function fetchTreeSha(
  owner: string,
  repo: string,
  skillPath: string,
  typed: true,
): Promise<FetchTreeResult>;
export async function fetchTreeSha(
  owner: string,
  repo: string,
  skillPath: string,
  typed?: boolean,
): Promise<string | null | FetchTreeResult> {
  const result = await fetchTreeShaTyped(owner, repo, skillPath);
  if (typed) return result;
  // Legacy compat: return string | null
  return result.status === "ok" ? result.sha : null;
}

async function fetchTreeShaTyped(
  owner: string,
  repo: string,
  skillPath: string,
): Promise<FetchTreeResult> {
  const token = getGitHubToken();
  const branches = ["main", "master"];
  let lastError: string | undefined;

  for (const branch of branches) {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
      const headers: Record<string, string> = {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "skilled-cli",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await retry(
        () => fetch(url, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT) }),
        { label: `fetch tree SHA (${branch})`, silent: true },
      );

      // Handle rate limiting — wait if reset is soon enough
      const remaining = response.headers.get("x-ratelimit-remaining");
      if (remaining !== null && parseInt(remaining, 10) === 0) {
        const resetAt = response.headers.get("x-ratelimit-reset");
        const resetMs = resetAt ? parseInt(resetAt, 10) * 1000 - Date.now() : 0;
        const resetDate = resetAt
          ? new Date(parseInt(resetAt, 10) * 1000).toLocaleTimeString()
          : "soon";

        if (resetMs > 0 && resetMs <= MAX_RATE_LIMIT_WAIT) {
          log.warn(`Rate limited. Waiting ${Math.ceil(resetMs / 1000)}s for reset...`);
          await new Promise((r) => setTimeout(r, resetMs + 1000));
          // Retry this branch after waiting
          continue;
        }

        log.warn(`GitHub API rate limit exhausted. Resets at ${resetDate}.`);
        return { status: "rate_limited", resetsAt: resetDate };
      }

      if (!response.ok) continue;

      const data = (await response.json()) as {
        sha: string;
        tree: Array<{ path: string; type: string; sha: string }>;
      };

      // Normalize path: remove trailing slashes
      const folderPath = skillPath.replace(/\/+$/, "");

      if (!folderPath) return { status: "ok", sha: data.sha };

      const entry = data.tree.find(
        (e) => e.type === "tree" && e.path === folderPath,
      );

      if (entry) return { status: "ok", sha: entry.sha };
      // Path not in tree — try next branch
    } catch (err) {
      lastError = (err as Error).message ?? String(err);
      log.warn(`Could not reach GitHub API for ${owner}/${repo} (branch: ${branch})`);
      continue;
    }
  }

  // If we had network errors, report that — otherwise it's genuinely not found
  if (lastError) {
    return { status: "network_error", message: lastError };
  }
  return { status: "not_found" };
}
