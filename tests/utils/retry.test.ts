import { describe, it, expect, vi } from "vitest";
import { retry, isTransient } from "../../src/utils/retry.js";

describe("isTransient", () => {
  it("returns true for network error codes", () => {
    expect(isTransient({ code: "ETIMEDOUT" })).toBe(true);
    expect(isTransient({ code: "ECONNRESET" })).toBe(true);
    expect(isTransient({ code: "ECONNREFUSED" })).toBe(true);
    expect(isTransient({ code: "ENOTFOUND" })).toBe(true);
    expect(isTransient({ code: "EAI_AGAIN" })).toBe(true);
  });

  it("returns true for server 5xx status", () => {
    expect(isTransient({ status: 500 })).toBe(true);
    expect(isTransient({ status: 502 })).toBe(true);
    expect(isTransient({ status: 503 })).toBe(true);
  });

  it("returns true for rate limit 429", () => {
    expect(isTransient({ status: 429 })).toBe(true);
  });

  it("returns true for AbortError", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    expect(isTransient(err)).toBe(true);
  });

  it("returns true for TimeoutError", () => {
    const err = new Error("timeout");
    err.name = "TimeoutError";
    expect(isTransient(err)).toBe(true);
  });

  it("returns false for client errors", () => {
    expect(isTransient({ status: 404 })).toBe(false);
    expect(isTransient({ status: 401 })).toBe(false);
    expect(isTransient({ status: 422 })).toBe(false);
  });

  it("returns false for non-error values", () => {
    expect(isTransient(null)).toBe(false);
    expect(isTransient(undefined)).toBe(false);
    expect(isTransient("string error")).toBe(false);
  });
});

describe("retry", () => {
  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await retry(fn, { attempts: 3, silent: true });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on transient error and succeeds", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ code: "ECONNRESET" })
      .mockResolvedValue("ok");

    const result = await retry(fn, { attempts: 3, baseDelay: 1, silent: true });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws immediately on non-transient error", async () => {
    const err = { status: 404, message: "Not Found" };
    const fn = vi.fn().mockRejectedValue(err);

    await expect(retry(fn, { attempts: 3, baseDelay: 1, silent: true }))
      .rejects.toEqual(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting all attempts", async () => {
    const err = { code: "ETIMEDOUT" };
    const fn = vi.fn().mockRejectedValue(err);

    await expect(retry(fn, { attempts: 3, baseDelay: 1, silent: true }))
      .rejects.toEqual(err);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("uses exponential backoff", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ code: "ECONNRESET" })
      .mockRejectedValueOnce({ code: "ECONNRESET" })
      .mockResolvedValue("ok");

    const start = Date.now();
    await retry(fn, { attempts: 3, baseDelay: 50, silent: true });
    const elapsed = Date.now() - start;

    // First retry: ~50ms, second retry: ~100ms → total ~150ms minimum
    expect(elapsed).toBeGreaterThanOrEqual(100);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
