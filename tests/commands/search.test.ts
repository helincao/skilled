import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ── Mocks ────────────────────────────────────────────────
vi.mock("../../src/core/git.js", () => ({
  shallowClone: vi.fn(),
}));

import { shallowClone } from "../../src/core/git.js";
import { search } from "../../src/commands/search.js";

function createFakeRemote(
  tmp: string,
  skills: Array<{ name: string; description: string }>,
): string {
  const remoteDir = join(tmp, "_remote");
  const remoteSkillsDir = join(remoteDir, "skills");
  mkdirSync(remoteSkillsDir, { recursive: true });

  for (const skill of skills) {
    const skillDir = join(remoteSkillsDir, skill.name);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, "SKILL.md"),
      `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n# ${skill.name}\n`,
    );
  }

  return remoteDir;
}

function setupCloneMock(
  tmp: string,
  skills: Array<{ name: string; description: string }>,
) {
  const remoteDir = createFakeRemote(tmp, skills);
  vi.mocked(shallowClone).mockResolvedValue({
    dir: remoteDir,
    headSha: "abc1234567890def",
    cleanup: vi.fn(),
  });
  return remoteDir;
}

describe("search command", () => {
  let tmp: string;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "skilled-search-"));
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(shallowClone).mockReset();
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    consoleSpy.mockRestore();
  });

  it("lists all skills in a repo as JSON", async () => {
    setupCloneMock(tmp, [
      { name: "build", description: "Build the project" },
      { name: "test", description: "Run tests" },
    ]);

    await search("owner/repo", undefined, { json: true });

    const output = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(output).toHaveLength(2);
    expect(output[0].name).toBe("build");
    expect(output[1].name).toBe("test");
  });

  it("filters skills by query", async () => {
    setupCloneMock(tmp, [
      { name: "build", description: "Build the project" },
      { name: "test", description: "Run tests" },
      { name: "lint", description: "Lint source code" },
    ]);

    await search("owner/repo", "test", { json: true });

    const output = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(output).toHaveLength(1);
    expect(output[0].name).toBe("test");
  });

  it("filters by description match", async () => {
    setupCloneMock(tmp, [
      { name: "build", description: "Build the project" },
      { name: "deploy", description: "Deploy to production" },
    ]);

    await search("owner/repo", "production", { json: true });

    const output = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(output).toHaveLength(1);
    expect(output[0].name).toBe("deploy");
  });

  it("returns empty array when no skills match query", async () => {
    setupCloneMock(tmp, [
      { name: "build", description: "Build the project" },
    ]);

    await search("owner/repo", "nonexistent", { json: true });

    const output = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(output).toEqual([]);
  });

  it("falls back to recursive search when no skills/ dir exists", async () => {
    // Create a remote with SKILL.md files scattered in non-standard locations
    const remoteDir = join(tmp, "_remote");
    const nestedDir = join(remoteDir, "packages", "my-skill");
    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(
      join(nestedDir, "SKILL.md"),
      "---\nname: nested-skill\ndescription: Found via recursive search\n---\n",
    );
    // Also create an empty skills/ dir so findSkillsRoot returns it but it's empty
    mkdirSync(join(remoteDir, "skills"), { recursive: true });

    vi.mocked(shallowClone).mockResolvedValue({
      dir: remoteDir,
      headSha: "abc1234567890def",
      cleanup: vi.fn(),
    });

    await search("owner/repo", undefined, { json: true });

    const output = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(output).toHaveLength(1);
    expect(output[0].name).toBe("nested-skill");
  });

  it("handles repo with no skills at all", async () => {
    const remoteDir = join(tmp, "_remote");
    mkdirSync(join(remoteDir, "skills"), { recursive: true });

    vi.mocked(shallowClone).mockResolvedValue({
      dir: remoteDir,
      headSha: "abc1234567890def",
      cleanup: vi.fn(),
    });

    await search("owner/repo", undefined, { json: true });

    const output = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(output).toEqual([]);
  });

  it("includes a skill named 'build' via fallback recursive search (regression)", async () => {
    // Regression: "build" was in SKIP_DIRS, so the recursive fallback path would
    // silently skip any skill directory named "build".
    const remoteDir = join(tmp, "_remote");
    // No skills/ dir — forces fallback to findSkillDirs
    const buildSkillDir = join(remoteDir, "build");
    mkdirSync(buildSkillDir, { recursive: true });
    writeFileSync(
      join(buildSkillDir, "SKILL.md"),
      "---\nname: build\ndescription: Build the project\n---\n",
    );

    vi.mocked(shallowClone).mockResolvedValue({
      dir: remoteDir,
      headSha: "abc1234567890def",
      cleanup: vi.fn(),
    });

    await search("owner/repo", undefined, { json: true });

    const output = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(output).toHaveLength(1);
    expect(output[0].name).toBe("build");
  });

  it("includes 'build' skill among others via fallback recursive search (regression)", async () => {
    // Regression: ensure "build" is not omitted when other skills are also present.
    const remoteDir = join(tmp, "_remote");
    for (const name of ["build", "deploy", "test"]) {
      const dir = join(remoteDir, name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, "SKILL.md"),
        `---\nname: ${name}\ndescription: ${name} skill\n---\n`,
      );
    }

    vi.mocked(shallowClone).mockResolvedValue({
      dir: remoteDir,
      headSha: "abc1234567890def",
      cleanup: vi.fn(),
    });

    await search("owner/repo", undefined, { json: true });

    const output = JSON.parse(consoleSpy.mock.calls[0][0]);
    const names = output.map((s: { name: string }) => s.name);
    expect(names).toContain("build");
    expect(output).toHaveLength(3);
  });

  it("case-insensitive query matching", async () => {
    setupCloneMock(tmp, [
      { name: "Build", description: "Build the project" },
    ]);

    await search("owner/repo", "BUILD", { json: true });

    const output = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(output).toHaveLength(1);
  });
});
