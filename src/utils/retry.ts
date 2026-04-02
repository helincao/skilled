import { log } from "./logger.js";

export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 3 */
  attempts?: number;
  /** Base delay in ms before first retry. Default: 1000 */
  baseDelay?: number;
  /** Maximum delay in ms between retries. Default: 10000 */
  maxDelay?: number;
  /** Label for log messages. */
  label?: string;
  /** Whether to log retries. Default: true */
  silent?: boolean;
}

const TRANSIENT_CODES = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
  "UND_ERR_SOCKET",
]);

/** Returns true if the error looks transient (network blip, server 5xx). */
export function isTransient(err: unknown): boolean {
  if (err && typeof err === "object") {
    // Node network errors
    const code = (err as { code?: string }).code;
    if (code && TRANSIENT_CODES.has(code)) return true;

    // HTTP status from Octokit / fetch wrappers
    const status = (err as { status?: number }).status;
    if (status && (status >= 500 || status === 429)) return true;

    // Abort errors (from our timeout signals)
    if ((err as Error).name === "AbortError" || (err as Error).name === "TimeoutError") return true;
  }
  return false;
}

/**
 * Retry an async function with exponential backoff.
 * Only retries on transient errors — permanent failures throw immediately.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const {
    attempts = 3,
    baseDelay = 1000,
    maxDelay = 10_000,
    label = "operation",
    silent = false,
  } = opts;

  let lastErr: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;

      if (!isTransient(err) || i === attempts - 1) {
        throw err;
      }

      const delay = Math.min(baseDelay * 2 ** i, maxDelay);
      if (!silent) {
        log.warn(`${label} failed (attempt ${i + 1}/${attempts}), retrying in ${delay}ms...`);
      }
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastErr;
}
