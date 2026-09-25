/**
 * PostgreSQL connection policy shared by the web app (lib/subscriptions/db.ts),
 * the migration runner (scripts/migrate.mjs) and the operator scripts.
 *
 * Plain JavaScript on purpose: the scripts run under plain Node without a
 * TypeScript build step, and one implementation means the app and the
 * migration tooling can never drift apart on TLS.
 *
 * Policy (fail closed, never prints the connection string):
 * - Loopback (localhost / 127.0.0.1 / ::1) may connect without TLS. That is
 *   the dedicated local test cluster; it is refused when running on Vercel,
 *   where a loopback database cannot be the intended one.
 * - Every other host must say `sslmode=verify-full` explicitly. The
 *   certificate chain and host name are then verified. Weaker modes
 *   (disable/allow/prefer/require/verify-ca) are rejected rather than
 *   upgraded silently, so a misconfiguration is visible, not guessed at.
 * - Query parameters that could redirect the host (`host`, `hostaddr`), read
 *   local files (`sslcert`, `sslkey`, `sslrootcert`) or change TLS semantics
 *   (`ssl`, `sslnegotiation`, `uselibpqcompat`, `sslpassword`) are rejected.
 *   node-postgres lets the URL override explicit options, so they must not
 *   survive into the string handed to it.
 * - A private CA may be supplied as PEM text via SUBSCRIPTIONS_DATABASE_CA
 *   (or MTM_MIGRATION_DATABASE_CA for the migrator). Public-CA providers
 *   need nothing extra.
 */

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const ALLOWED_PARAMS = new Set([
  "sslmode",
  "application_name",
  "options",
  "channel_binding",
  "connect_timeout",
]);

/** A configuration error whose message never contains the connection string. */
export class DatabaseConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "DatabaseConfigError";
  }
}

const int = (value, name, min, max, fallback) => {
  if (value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(String(value)))
    throw new DatabaseConfigError(`${name} must be an integer`);
  const n = Number(value);
  if (n < min || n > max)
    throw new DatabaseConfigError(`${name} must be between ${min} and ${max}`);
  return n;
};

/**
 * Validates a connection string and returns the node-postgres Pool config
 * the application must use. Throws DatabaseConfigError on any policy breach.
 *
 * @param {string | undefined} connectionString
 * @param {{ env?: Record<string, string | undefined>, ca?: string, role?: "app" | "migration" }} [options]
 */
export function databaseConfig(connectionString, options = {}) {
  const env = options.env ?? process.env;
  const role = options.role ?? "app";
  if (!connectionString)
    throw new DatabaseConfigError("Database URL is not configured");
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    // Node's URL error carries the input string; never rethrow it.
    throw new DatabaseConfigError("Database URL is not a valid URL");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:")
    throw new DatabaseConfigError("Database URL must use postgres://");
  if (!url.hostname)
    throw new DatabaseConfigError("Database URL must name a host");
  if (!url.pathname || url.pathname === "/")
    throw new DatabaseConfigError("Database URL must name a database");
  for (const key of url.searchParams.keys())
    if (!ALLOWED_PARAMS.has(key))
      throw new DatabaseConfigError(
        `Database URL parameter "${key}" is not permitted`,
      );

  const loopback = LOOPBACK.has(url.hostname);
  const sslmode = url.searchParams.get("sslmode");
  const onVercel = env.VERCEL === "1";
  if (loopback && onVercel)
    throw new DatabaseConfigError(
      "A loopback database cannot be used from a Vercel deployment",
    );
  const ca =
    options.ca ??
    (role === "migration"
      ? env.MTM_MIGRATION_DATABASE_CA
      : env.SUBSCRIPTIONS_DATABASE_CA);
  if (ca !== undefined && ca !== "" && !/-----BEGIN CERTIFICATE-----/.test(ca))
    throw new DatabaseConfigError("Database CA must be PEM certificate text");

  let ssl;
  if (loopback && (sslmode === null || sslmode === "disable")) {
    ssl = false;
  } else if (sslmode === "verify-full") {
    ssl = { rejectUnauthorized: true, ...(ca ? { ca } : {}) };
  } else {
    throw new DatabaseConfigError(
      loopback
        ? "Loopback database sslmode must be omitted, disable or verify-full"
        : "Remote database URL must set sslmode=verify-full",
    );
  }
  // Remove sslmode so node-postgres cannot override the explicit ssl object.
  url.searchParams.delete("sslmode");

  const serverless = onVercel;
  const max = int(
    role === "migration" ? "1" : env.SUBSCRIPTIONS_DATABASE_POOL_MAX,
    "SUBSCRIPTIONS_DATABASE_POOL_MAX",
    1,
    10,
    serverless ? 3 : 5,
  );
  return {
    connectionString: url.toString(),
    ssl,
    max,
    // Short idle lifetime so suspended serverless instances do not pin
    // connections; the managed pooler owns long-lived server connections.
    idleTimeoutMillis: serverless ? 5_000 : 10_000,
    connectionTimeoutMillis: 5_000,
    maxLifetimeSeconds: 300,
    allowExitOnIdle: true,
    // Client-side timeout: works through transaction-mode poolers, which
    // reject server startup parameters such as statement_timeout.
    query_timeout: role === "migration" ? 0 : 15_000,
    application_name:
      url.searchParams.get("application_name") ??
      (role === "migration" ? "mtm-migrate" : "mtm-web"),
  };
}

/** Non-secret description of a target, for operator output. */
export function describeTarget(connectionString) {
  try {
    const url = new URL(connectionString);
    return {
      host: url.hostname,
      port: url.port || "5432",
      database: decodeURIComponent(url.pathname.slice(1)),
      tls: url.searchParams.get("sslmode") === "verify-full",
    };
  } catch {
    return null;
  }
}
