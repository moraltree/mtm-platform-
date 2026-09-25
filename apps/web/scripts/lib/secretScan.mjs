/**
 * Repository secret scan (Phase 5). Reports file:line and the pattern name
 * only — never the matched text.
 *
 * Patterns target real credential shapes (length thresholds above any test
 * fixture). Lines explicitly marked as fixtures (FIXTURE, CANARY, SENTINEL,
 * example.test/.invalid hosts) are ignored so tests can exercise redaction.
 */
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const REPO_PATTERNS = [
  ["stripe-secret-key", /\b(sk|rk)_(live|test)_[A-Za-z0-9]{24,}/],
  ["stripe-webhook-secret", /\bwhsec_[A-Za-z0-9+/=]{24,}/],
  ["resend-api-key", /\bre_[A-Za-z0-9]{6,}_[A-Za-z0-9]{12,}/],
  [
    "database-url-with-password",
    /\bpostgres(ql)?:\/\/[^\s:/@"'`]+:[^\s@"'`]{6,}@(?!(localhost|127\.0\.0\.1|db\.example\.test|example)\b)/i,
  ],
  ["private-key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["bearer-token", /\bBearer\s+[A-Za-z0-9._~+/=-]{32,}/],
];
const FIXTURE = /FIXTURE|CANARY|SENTINEL|example\.(test|invalid)/;
const SKIP =
  /(^|\/)(node_modules|\.next|\.git)\/|package-lock\.json$|\.(png|jpe?g|gif|webp|ico|woff2?|pdf|mp3|mp4)$/i;

/** Files to scan: tracked plus untracked-but-not-ignored (new work). */
export function repoFiles(root) {
  const out = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return [...new Set(out.split("\0").filter(Boolean))].filter(
    (f) => !SKIP.test(f),
  );
}

/** Tracked (or trackable) files that look like environment files with values. */
export function envFiles(files) {
  return files.filter(
    (f) => /(^|\/)\.env(\.|$)/.test(f) && !/\.env\.example$/.test(f),
  );
}

export async function scan(root, files = repoFiles(root)) {
  const findings = [];
  for (const file of files) {
    let text;
    try {
      text = await readFile(join(root, file), "utf8");
    } catch {
      continue; // Deleted in the working tree.
    }
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      if (FIXTURE.test(line)) return;
      for (const [name, pattern] of REPO_PATTERNS)
        if (pattern.test(line))
          findings.push({ file, line: i + 1, pattern: name });
    });
  }
  return findings;
}
