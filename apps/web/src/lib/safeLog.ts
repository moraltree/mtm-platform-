/**
 * Log-safe error descriptions (Phase 5).
 *
 * Provider errors can carry far more than a message: Stripe's signature
 * error holds the raw event payload and signature header, and HTTP client
 * errors can echo request details. Server logs must receive only a small,
 * fixed set of classification fields, with anything secret-shaped removed.
 */

// Credential shapes that must never reach a log line.
export const SECRET_PATTERNS: RegExp[] = [
  /\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]{8,}/g,
  /\bwhsec_[A-Za-z0-9+/=_-]{8,}/g,
  /\bre_[A-Za-z0-9_]{16,}/g,
  /\b(postgres(ql)?|mysql|redis):\/\/[^\s"'@]*@[^\s"']+/gi,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
];

export function redactSecrets(text: string): string {
  let out = text;
  for (const pattern of SECRET_PATTERNS)
    out = out.replace(pattern, "[redacted]");
  return out;
}

const field = (value: unknown) =>
  typeof value === "string" || typeof value === "number"
    ? redactSecrets(String(value)).slice(0, 120)
    : undefined;

/** Name/type/code/status only: never payloads, headers, messages or stacks. */
export function errorSummary(error: unknown): Record<string, string> {
  if (!error || typeof error !== "object") return { name: typeof error };
  const e = error as Record<string, unknown>;
  const summary: Record<string, string | undefined> = {
    name: field(e.name),
    type: field(e.type),
    code: field(e.code),
    status: field(e.statusCode ?? e.status),
  };
  return Object.fromEntries(
    Object.entries(summary).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  );
}
