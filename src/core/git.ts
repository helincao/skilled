import simpleGit, { type SimpleGit } from "simple-git";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { retry } from "../utils/retry.js";

/** Timeout for git clone operations (ms). */
const CLONE_TIMEOUT = 120_000;

/** Timeout for other git operations (ms). */
const GIT_TIMEOUT = 60_000;

function timedGit(cwd?: string, timeout = GIT_TIMEOUT): SimpleGit {
  return simpleGit(cwd ? { baseDir: cwd, timeout: { block: timeout } } : { timeout: { block: timeout } });
}

export interface CloneResult {
  dir: string;
  headSha: string;
  cleanup: () => void;
}

/** Shallow-clone a repo into a temp directory. Returns path, HEAD SHA, and cleanup fn. */
export async function shallowClone(cloneUrl: string): Promise<CloneResult> {
  const dir = mkdtempSync(join(tmpdir(), "skilled-"));

  try {
    await retry(
      async () => {
        const git = timedGit(undefined, CLONE_TIMEOUT);
        await git.clone(cloneUrl, dir, ["--depth", "1"]);
      },
      { label: `clone ${cloneUrl}` },
    );
  } catch (err) {
    // Clean up the temp directory if clone fails
    rmSync(dir, { recursive: true, force: true });
    throw err;
  }

  const clonedGit = timedGit(dir);
  const headSha = (await clonedGit.revparse(["HEAD"])).trim();

  return {
    dir,
    headSha,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** Get the list of changed files in a given path relative to the repo root. */
export async function getChangedFiles(
  repoDir: string,
  path: string,
): Promise<string[]> {
  try {
    const git = timedGit(repoDir);
    const status = await git.status();
    return status.files
      .map((f) => f.path)
      .filter((p) => p.startsWith(path));
  } catch (err) {
    throw new Error(
      `Failed to get changed files in ${repoDir}: ${(err as Error).message}`,
      { cause: err },
    );
  }
}

/**
 * Extract diff output from a simple-git error thrown by `git diff --no-index`.
 *
 * `git diff --no-index` exits with code 1 when differences exist (not an error).
 * simple-git wraps this in a GitResponseError. We check the exit code to
 * distinguish "files differ" (code 1) from real failures (code 128, signal, etc).
 */
function extractDiffFromError(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;

  const gitErr = err as {
    git?: { exitCode?: number; diff?: string; stdOut?: string[] };
    message?: string;
  };

  // Exit code 1 = differences found (not an error)
  // Exit code 0 should not be here. Anything else (128, etc.) is a real error.
  const exitCode = gitErr.git?.exitCode;
  if (exitCode !== undefined && exitCode !== 1) return null;

  // Extract output: structured data first, then stdout buffer, then message
  const output =
    gitErr.git?.diff ??
    gitErr.git?.stdOut?.join("") ??
    gitErr.message ??
    "";

  return output.length > 0 ? output : null;
}

/**
 * Get the diff between two directories (using git diff --no-index).
 */
export async function diffDirs(
  dirA: string,
  dirB: string,
): Promise<string> {
  const git = timedGit();
  try {
    const result = await git.diff([
      "--no-index",
      "--stat",
      "--",
      dirA,
      dirB,
    ]);
    return result;
  } catch (err: unknown) {
    const diff = extractDiffFromError(err);
    if (diff !== null) return diff;
    throw err;
  }
}

/** Get full patch diff between two directories. */
export async function diffDirsFull(
  dirA: string,
  dirB: string,
): Promise<string> {
  const git = timedGit();
  try {
    const result = await git.diff(["--no-index", "--", dirA, dirB]);
    return result;
  } catch (err: unknown) {
    const diff = extractDiffFromError(err);
    if (diff !== null) return diff;
    throw err;
  }
}

/** Get the commit range being pushed (for pre-push hook). */
export async function getCommitRange(
  repoDir: string,
  localRef: string,
  remoteRef: string,
): Promise<string[]> {
  try {
    const git = timedGit(repoDir);
    const result = await git.log({ from: remoteRef, to: localRef });
    return result.all.map((c) => c.hash);
  } catch (err) {
    throw new Error(
      `Failed to get commit range ${remoteRef}..${localRef}: ${(err as Error).message}`,
      { cause: err },
    );
  }
}
