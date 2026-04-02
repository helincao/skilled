import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Compute a deterministic SHA-256 hash of a directory's contents.
 * Hashes file paths (sorted) + file contents, ignoring .git and node_modules.
 */
export function hashDirectory(dir: string): string {
  const hash = createHash("sha256");
  const files = collectFiles(dir).sort();

  for (const file of files) {
    const rel = relative(dir, file);
    hash.update(rel);
    hash.update(readFileSync(file));
  }

  return hash.digest("hex").slice(0, 16);
}

function collectFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full));
    } else {
      results.push(full);
    }
  }

  return results;
}
