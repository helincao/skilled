import { resolve } from "node:path";

/**
 * Sanitize a skill name for safe use as a directory name.
 * Prevents path traversal and normalizes to a safe format.
 */
export function sanitizeName(name: string): string {
  let safe = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-") // replace non-alphanumeric with hyphens
    .replace(/-+/g, "-") // collapse consecutive hyphens
    .replace(/^[.-]+/, "") // remove leading dots and hyphens
    .replace(/[.-]+$/, "") // remove trailing dots and hyphens
    .slice(0, 255);

  return safe || "unnamed-skill";
}

/**
 * Validate that a resolved path stays within the base directory.
 * Returns false if the target escapes via ".." or symlink trickery.
 */
export function isPathSafe(base: string, target: string): boolean {
  const resolvedBase = resolve(base);
  const resolvedTarget = resolve(base, target);
  return resolvedTarget.startsWith(resolvedBase + "/") || resolvedTarget === resolvedBase;
}
