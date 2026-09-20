import { getEnv } from "@/lib/cf/bindings";

/**
 * Minimal, Workers-friendly Sentry reporter. Uses the HTTP store endpoint via
 * fetch (no Node SDK, which Workers only partially supports) and scrubs PII
 * before sending (brief: "Sentry PII scrubbing on"). No-ops when SENTRY_DSN is
 * unset, and never throws — error reporting must not create errors.
 */

interface ParsedDsn {
  host: string;
  projectId: string;
  publicKey: string;
}

function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\/+/, "");
    if (!u.username || !projectId) return null;
    return { host: u.host, projectId, publicKey: u.username };
  } catch {
    return null;
  }
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const TOKEN_RE = /\b(sk|pk|rk|whsec|re)_[A-Za-z0-9]{6,}\b/g;

/** Redact emails and secret-looking tokens from any string. */
export function scrub(input: string): string {
  return input.replace(EMAIL_RE, "[redacted-email]").replace(TOKEN_RE, "[redacted-token]");
}

export interface CaptureContext {
  tags?: Record<string, string>;
  extra?: Record<string, string>;
}

export async function captureException(error: unknown, context?: CaptureContext): Promise<void> {
  let dsn: string | undefined;
  let environment = "production";
  try {
    const env = getEnv();
    dsn = env.SENTRY_DSN;
    environment = env.APP_ENV ?? environment;
  } catch {
    return; // no runtime env (e.g. build/test) — nothing to report to
  }
  if (!dsn) return;

  const parsed = parseDsn(dsn);
  if (!parsed) return;

  const err = error instanceof Error ? error : new Error(String(error));
  const event = {
    event_id: crypto.randomUUID().replace(/-/g, ""),
    timestamp: Date.now() / 1000,
    platform: "javascript",
    level: "error",
    environment,
    tags: context?.tags,
    extra: context?.extra ? Object.fromEntries(Object.entries(context.extra).map(([k, v]) => [k, scrub(v)])) : undefined,
    exception: {
      values: [
        {
          type: err.name,
          value: scrub(err.message),
          stacktrace: err.stack ? { frames: [{ function: scrub(err.stack).slice(0, 2000) }] } : undefined,
        },
      ],
    },
  };

  try {
    const url = `https://${parsed.host}/api/${parsed.projectId}/store/?sentry_version=7&sentry_key=${parsed.publicKey}`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
  } catch {
    // Swallow: reporting failures must never surface to the user.
  }
}
