import { describe, expect, it } from "vitest";
import { databaseConfig, describeTarget } from "./policy.mjs";

// Canary credentials: must never appear in any error message.
const SECRET = "canary-db-password-5c1f";
const remote = (query = "sslmode=verify-full") =>
  `postgresql://mtm_app:${SECRET}@db.example.test:5432/mtm?${query}`;
const env = (extra: Record<string, string> = {}) => ({ ...extra });

function rejects(url: string | undefined, e = env(), pattern?: RegExp) {
  let message = "";
  try {
    databaseConfig(url, { env: e });
  } catch (error) {
    message = (error as Error).message;
    expect((error as Error).name).toBe("DatabaseConfigError");
  }
  expect(message).not.toBe("");
  expect(message).not.toContain(SECRET);
  expect(message).not.toContain("db.example.test");
  if (pattern) expect(message).toMatch(pattern);
}

describe("database TLS policy", () => {
  it("allows the loopback test cluster without TLS", () => {
    for (const host of ["127.0.0.1", "localhost", "[::1]"]) {
      const config = databaseConfig(
        `postgresql://stuart@${host}:55439/mtm_subscription_test`,
        { env: env() },
      );
      expect(config.ssl).toBe(false);
    }
  });

  it("requires verify-full for every non-loopback host", () => {
    for (const mode of [
      "",
      "sslmode=disable",
      "sslmode=allow",
      "sslmode=prefer",
      "sslmode=require",
      "sslmode=verify-ca",
    ])
      rejects(remote(mode), env(), /verify-full/);
  });

  it("verifies certificate and host name and strips sslmode from the URL", () => {
    const config = databaseConfig(remote(), { env: env() });
    expect(config.ssl).toEqual({ rejectUnauthorized: true });
    // node-postgres lets URL parameters override explicit options.
    expect(config.connectionString).not.toMatch(/ssl/i);
  });

  it("accepts a private CA only as PEM text", () => {
    const pem = "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----";
    expect(
      databaseConfig(remote(), { env: env({ SUBSCRIPTIONS_DATABASE_CA: pem }) })
        .ssl,
    ).toEqual({ rejectUnauthorized: true, ca: pem });
    rejects(remote(), env({ SUBSCRIPTIONS_DATABASE_CA: "/etc/ca.pem" }), /PEM/);
  });

  it("rejects parameters that could redirect the host or read local files", () => {
    for (const p of [
      "host=evil.example",
      "hostaddr=10.0.0.1",
      "sslrootcert=/etc/passwd",
      "sslcert=/tmp/x",
      "sslkey=/tmp/x",
      "ssl=false",
      "sslnegotiation=direct",
      "uselibpqcompat=true",
    ])
      rejects(remote(`sslmode=verify-full&${p}`), env(), /not permitted/);
    // A loopback URL cannot be pointed elsewhere through ?host= either.
    rejects("postgresql://u@127.0.0.1:55439/db?host=db.example.test", env());
  });

  it("refuses loopback databases on Vercel", () => {
    rejects(
      "postgresql://u@127.0.0.1:5432/mtm",
      env({ VERCEL: "1" }),
      /Vercel/,
    );
  });

  it("never echoes malformed or missing URLs", () => {
    rejects(undefined, env(), /not configured/);
    rejects(`not a url ${SECRET}`, env(), /valid URL/);
    rejects(`mysql://u:${SECRET}@db.example.test/mtm`, env(), /postgres/);
    rejects(
      `postgresql://u:${SECRET}@db.example.test:5432/`,
      env(),
      /database/,
    );
  });

  it("describes a target without credentials", () => {
    expect(JSON.stringify(describeTarget(remote()))).not.toContain(SECRET);
    expect(describeTarget(remote())).toEqual({
      host: "db.example.test",
      port: "5432",
      database: "mtm",
      tls: true,
    });
  });
});

describe("serverless pool sizing", () => {
  it("uses a small bounded pool with short idle time on Vercel", () => {
    const config = databaseConfig(remote(), { env: env({ VERCEL: "1" }) });
    expect(config.max).toBe(3);
    expect(config.idleTimeoutMillis).toBe(5000);
    expect(config.allowExitOnIdle).toBe(true);
    expect(config.maxLifetimeSeconds).toBe(300);
    expect(config.query_timeout).toBe(15000);
    expect(config).not.toHaveProperty("statement_timeout");
  });

  it("bounds the configurable pool size", () => {
    expect(
      databaseConfig(remote(), {
        env: env({ SUBSCRIPTIONS_DATABASE_POOL_MAX: "1" }),
      }).max,
    ).toBe(1);
    for (const bad of ["0", "11", "-1", "2.5", "many"])
      rejects(remote(), env({ SUBSCRIPTIONS_DATABASE_POOL_MAX: bad }), /POOL/);
  });

  it("gives the migrator a single connection and no query timeout", () => {
    const config = databaseConfig(remote(), {
      env: env({ SUBSCRIPTIONS_DATABASE_POOL_MAX: "9" }),
      role: "migration",
    });
    expect(config.max).toBe(1);
    expect(config.query_timeout).toBe(0);
    expect(config.application_name).toBe("mtm-migrate");
  });
});
