import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { updateAgentInstructions } from "../../src/core/instructions.js";

function installSkill(root: string, name: string, description: string) {
  const dir = join(root, "skills", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`,
  );
}

describe("updateAgentInstructions", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "skilled-instr-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("creates CLAUDE.md with managed block for claude-code", () => {
    installSkill(tmp, "build", "Build the project");
    updateAgentInstructions(tmp, ["claude-code"]);

    const content = readFileSync(join(tmp, "CLAUDE.md"), "utf-8");
    expect(content).toContain("<!-- skilled:managed-start -->");
    expect(content).toContain("<!-- skilled:managed-end -->");
    expect(content).toContain("**build**");
    expect(content).toContain("Build the project");
  });

  it("creates cursor .mdc file with frontmatter", () => {
    installSkill(tmp, "lint", "Lint code");
    updateAgentInstructions(tmp, ["cursor"]);

    const content = readFileSync(
      join(tmp, ".cursor", "rules", "skills.mdc"),
      "utf-8",
    );
    expect(content).toContain("alwaysApply: true");
    expect(content).toContain("**lint**");
  });

  it("creates copilot instructions file", () => {
    installSkill(tmp, "test", "Run tests");
    updateAgentInstructions(tmp, ["copilot"]);

    const content = readFileSync(
      join(tmp, ".github", "copilot-instructions.md"),
      "utf-8",
    );
    expect(content).toContain("**test**");
  });

  it("replaces existing managed block", () => {
    const claudeMd = join(tmp, "CLAUDE.md");
    writeFileSync(
      claudeMd,
      "# My Project\n\n<!-- skilled:managed-start -->\nOLD CONTENT\n<!-- skilled:managed-end -->\n\nOther stuff\n",
    );

    installSkill(tmp, "deploy", "Deploy app");
    updateAgentInstructions(tmp, ["claude-code"]);

    const content = readFileSync(claudeMd, "utf-8");
    expect(content).toContain("# My Project");
    expect(content).toContain("**deploy**");
    expect(content).not.toContain("OLD CONTENT");
    expect(content).toContain("Other stuff");
  });

  it("appends managed block to existing file without markers", () => {
    const claudeMd = join(tmp, "CLAUDE.md");
    writeFileSync(claudeMd, "# Existing content\n");

    installSkill(tmp, "format", "Format code");
    updateAgentInstructions(tmp, ["claude-code"]);

    const content = readFileSync(claudeMd, "utf-8");
    expect(content).toContain("# Existing content");
    expect(content).toContain("<!-- skilled:managed-start -->");
    expect(content).toContain("**format**");
  });

  it("does not create file when no skills are installed and file does not exist", () => {
    updateAgentInstructions(tmp, ["claude-code"]);
    expect(existsSync(join(tmp, "CLAUDE.md"))).toBe(false);
  });

  it("handles multiple skills", () => {
    installSkill(tmp, "build", "Build project");
    installSkill(tmp, "test", "Run tests");
    updateAgentInstructions(tmp, ["claude-code"]);

    const content = readFileSync(join(tmp, "CLAUDE.md"), "utf-8");
    expect(content).toContain("**build**");
    expect(content).toContain("**test**");
  });

  it("updates multiple agent systems at once", () => {
    installSkill(tmp, "build", "Build project");
    updateAgentInstructions(tmp, ["claude-code", "codex"]);

    expect(existsSync(join(tmp, "CLAUDE.md"))).toBe(true);
    expect(existsSync(join(tmp, "AGENTS.md"))).toBe(true);
  });
});
