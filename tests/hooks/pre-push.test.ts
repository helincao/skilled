import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { installHook } from "../../src/hooks/pre-push.js";

describe("installHook", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "skilled-hook-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("throws when not a git repository", () => {
    expect(() => installHook(tmp)).toThrow("Not a git repository");
  });

  it("creates pre-push hook file", () => {
    mkdirSync(join(tmp, ".git"), { recursive: true });
    installHook(tmp);

    const hookPath = join(tmp, ".git", "hooks", "pre-push");
    expect(existsSync(hookPath)).toBe(true);

    const content = readFileSync(hookPath, "utf-8");
    expect(content).toContain("# skilled-pre-push-hook");
    expect(content).toContain("skilled check");
  });

  it("makes hook file executable", () => {
    mkdirSync(join(tmp, ".git"), { recursive: true });
    installHook(tmp);

    const hookPath = join(tmp, ".git", "hooks", "pre-push");
    const mode = statSync(hookPath).mode;
    // Check executable bit is set (owner execute = 0o100)
    expect(mode & 0o111).toBeGreaterThan(0);
  });

  it("appends to existing hook without marker", () => {
    mkdirSync(join(tmp, ".git", "hooks"), { recursive: true });
    const hookPath = join(tmp, ".git", "hooks", "pre-push");
    writeFileSync(hookPath, "#!/bin/bash\necho 'existing hook'\n");

    installHook(tmp);

    const content = readFileSync(hookPath, "utf-8");
    expect(content).toContain("existing hook");
    expect(content).toContain("# skilled-pre-push-hook");
  });

  it("does not duplicate if hook already installed", () => {
    mkdirSync(join(tmp, ".git", "hooks"), { recursive: true });
    const hookPath = join(tmp, ".git", "hooks", "pre-push");
    writeFileSync(hookPath, "#!/bin/bash\n# skilled-pre-push-hook\nskilled check\n");

    installHook(tmp);

    const content = readFileSync(hookPath, "utf-8");
    const matches = content.match(/# skilled-pre-push-hook/g);
    expect(matches).toHaveLength(1);
  });
});
