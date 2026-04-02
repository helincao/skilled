import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { log } from "../utils/logger.js";

export interface SkillMeta {
  name: string;
  description: string;
}

/**
 * Parse name and description from a SKILL.md frontmatter using gray-matter.
 * Returns null if the file is missing, has no frontmatter, or lacks a valid
 * name field.
 */
export function parseSkillMeta(skillDir: string): SkillMeta | null {
  const skillMd = join(skillDir, "SKILL.md");
  if (!existsSync(skillMd)) return null;

  try {
    const content = readFileSync(skillMd, "utf-8");
    const { data } = matter(content);

    if (!data.name || typeof data.name !== "string") return null;

    const description =
      typeof data.description === "string" ? data.description : "";

    return { name: data.name, description };
  } catch (err) {
    log.warn(`Failed to parse SKILL.md in ${skillDir}: ${(err as Error).message}`);
    return null;
  }
}
