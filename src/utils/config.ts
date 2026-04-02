import { existsSync } from "node:fs";
import { join } from "node:path";

/** Find the project root by walking up to find skills.lock.json or .git */
export function findProjectRoot(from: string = process.cwd()): string {
  let dir = from;
  while (dir !== "/") {
    if (
      existsSync(join(dir, "skills.lock.json")) ||
      existsSync(join(dir, ".git"))
    ) {
      return dir;
    }
    dir = join(dir, "..");
  }
  return from;
}

export function skillsDir(root: string): string {
  return join(root, "skills");
}

export function lockfilePath(root: string): string {
  return join(root, "skills.lock.json");
}
