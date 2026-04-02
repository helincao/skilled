import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { hashDirectory } from "../../src/core/hash.js";

describe("hashDirectory", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "skilled-hash-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns a 16-char hex string", () => {
    writeFileSync(join(tmp, "file.txt"), "hello");
    const hash = hashDirectory(tmp);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("produces the same hash for identical content", () => {
    writeFileSync(join(tmp, "file.txt"), "hello");
    const hash1 = hashDirectory(tmp);

    const tmp2 = mkdtempSync(join(tmpdir(), "skilled-hash-"));
    writeFileSync(join(tmp2, "file.txt"), "hello");
    const hash2 = hashDirectory(tmp2);
    rmSync(tmp2, { recursive: true, force: true });

    expect(hash1).toBe(hash2);
  });

  it("produces different hash for different content", () => {
    writeFileSync(join(tmp, "file.txt"), "hello");
    const hash1 = hashDirectory(tmp);

    writeFileSync(join(tmp, "file.txt"), "world");
    const hash2 = hashDirectory(tmp);

    expect(hash1).not.toBe(hash2);
  });

  it("includes nested files", () => {
    writeFileSync(join(tmp, "a.txt"), "a");
    const hash1 = hashDirectory(tmp);

    mkdirSync(join(tmp, "sub"));
    writeFileSync(join(tmp, "sub", "b.txt"), "b");
    const hash2 = hashDirectory(tmp);

    expect(hash1).not.toBe(hash2);
  });

  it("ignores .git and node_modules directories", () => {
    writeFileSync(join(tmp, "file.txt"), "content");
    const hash1 = hashDirectory(tmp);

    mkdirSync(join(tmp, ".git"));
    writeFileSync(join(tmp, ".git", "HEAD"), "ref");
    mkdirSync(join(tmp, "node_modules"));
    writeFileSync(join(tmp, "node_modules", "pkg.js"), "module");
    const hash2 = hashDirectory(tmp);

    expect(hash1).toBe(hash2);
  });
});
