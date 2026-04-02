import { describe, it, expect } from "vitest";
import { sanitizeName, isPathSafe } from "../../src/utils/sanitize.js";

describe("sanitizeName", () => {
  it("lowercases and replaces non-alphanumeric chars with hyphens", () => {
    expect(sanitizeName("My Cool Skill")).toBe("my-cool-skill");
  });

  it("collapses consecutive hyphens", () => {
    expect(sanitizeName("a---b")).toBe("a-b");
  });

  it("removes leading dots and hyphens", () => {
    expect(sanitizeName("..hidden")).toBe("hidden");
    expect(sanitizeName("--leading")).toBe("leading");
  });

  it("removes trailing dots and hyphens", () => {
    expect(sanitizeName("trailing..")).toBe("trailing");
    expect(sanitizeName("trailing--")).toBe("trailing");
  });

  it("returns 'unnamed-skill' for empty/invalid input", () => {
    expect(sanitizeName("")).toBe("unnamed-skill");
    expect(sanitizeName("...")).toBe("unnamed-skill");
  });

  it("truncates to 255 characters", () => {
    const long = "a".repeat(300);
    expect(sanitizeName(long).length).toBe(255);
  });

  it("handles path traversal attempts", () => {
    expect(sanitizeName("../../etc/passwd")).toBe("etc-passwd");
  });
});

describe("isPathSafe", () => {
  it("returns true for paths within the base", () => {
    expect(isPathSafe("/project", "skills/build")).toBe(true);
  });

  it("returns true when target equals base", () => {
    expect(isPathSafe("/project", ".")).toBe(true);
  });

  it("returns false for path traversal", () => {
    expect(isPathSafe("/project/skills", "../../../etc/passwd")).toBe(false);
  });

  it("returns false for absolute path escaping base", () => {
    expect(isPathSafe("/project", "/etc/passwd")).toBe(false);
  });
});
