/**
 * Listening telemetry contract (Phase 4). SCHEMA AND VALIDATION ONLY.
 *
 * Nothing in the application calls `recordListeningEvents` yet: wiring it to
 * the audio route or a client beacon is production instrumentation and needs
 * explicit approval (privacy notice, consent/retention decision). Until then
 * `mtm_listening_events` stays empty and the Founder Console shows listening
 * analytics as awaiting telemetry.
 *
 * Privacy decisions encoded here:
 * - no IP address, user agent, precise location, email or free text;
 * - device is a coarse class only (never a fingerprint or device ID);
 * - session IDs are random per playback session, not per device;
 * - the listener's class (paid/trial/anonymous) is derived on the server
 *   from the current entitlement, never accepted from the client;
 * - listener_id is the internal account UUID, never returned by analytics.
 */
import type { PoolClient } from "pg";

/**
 * Phase 5 kill switch. Even once something calls the recorder, nothing is
 * written unless LISTENING_TELEMETRY_ENABLED is exactly "true" — so merely
 * deploying code can never start collection. Activation is a separate,
 * explicit decision (privacy notice, retention, coverage row).
 */
export const listeningTelemetryEnabled = () =>
  process.env.LISTENING_TELEMETRY_ENABLED === "true";

export const LISTENING_EVENT_TYPES = [
  "story_started",
  "progress",
  "story_completed",
  "sleep_timer_set",
  "sleep_timer_ended",
] as const;
export const DEVICE_CLASSES = [
  "phone",
  "tablet",
  "desktop",
  "speaker",
  "unknown",
] as const;
export type ListeningEventType = (typeof LISTENING_EVENT_TYPES)[number];
export type DeviceClass = (typeof DEVICE_CLASSES)[number];
export type ListenerClass = "paid" | "trial" | "anonymous" | "unknown";

/** What a client may send. Anything else is rejected, not stored. */
export interface ListeningEventInput {
  sessionId: string;
  seq: number;
  type: ListeningEventType;
  storyId: string;
  occurredAt: string;
  positionSeconds?: number;
  /** Seconds actually listened since the previous event in this session. */
  listenedSeconds?: number;
  storyDurationSeconds?: number;
  device?: DeviceClass;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORY = /^[a-zA-Z0-9_-]{1,128}$/;
const ALLOWED_KEYS = new Set([
  "sessionId",
  "seq",
  "type",
  "storyId",
  "occurredAt",
  "positionSeconds",
  "listenedSeconds",
  "storyDurationSeconds",
  "device",
]);
const int = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** Maximum client clock skew accepted, and how far back a buffered event may be. */
export const MAX_FUTURE_MS = 5 * 60_000;
export const MAX_AGE_MS = 7 * 86_400_000;

export function validateListeningEvent(
  value: unknown,
  now = new Date(),
): { ok: true; event: ListeningEventInput } | { ok: false; reason: string } {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return { ok: false, reason: "not an object" };
  const v = value as Record<string, unknown>;
  for (const key of Object.keys(v))
    if (!ALLOWED_KEYS.has(key))
      return { ok: false, reason: `unexpected field ${key.slice(0, 40)}` };
  if (typeof v.sessionId !== "string" || !UUID.test(v.sessionId))
    return { ok: false, reason: "invalid session" };
  if (!int(v.seq, 0, 100_000)) return { ok: false, reason: "invalid sequence" };
  if (!LISTENING_EVENT_TYPES.includes(v.type as ListeningEventType))
    return { ok: false, reason: "invalid type" };
  if (typeof v.storyId !== "string" || !STORY.test(v.storyId))
    return { ok: false, reason: "invalid story" };
  const at = typeof v.occurredAt === "string" ? new Date(v.occurredAt) : null;
  if (!at || !Number.isFinite(at.getTime()))
    return { ok: false, reason: "invalid time" };
  if (at.getTime() > now.getTime() + MAX_FUTURE_MS)
    return { ok: false, reason: "time in the future" };
  if (at.getTime() < now.getTime() - MAX_AGE_MS)
    return { ok: false, reason: "time too old" };
  if (v.positionSeconds !== undefined && !int(v.positionSeconds, 0, 86_400))
    return { ok: false, reason: "invalid position" };
  if (v.listenedSeconds !== undefined && !int(v.listenedSeconds, 0, 3600))
    return { ok: false, reason: "invalid listened seconds" };
  if (
    v.storyDurationSeconds !== undefined &&
    !int(v.storyDurationSeconds, 1, 86_400)
  )
    return { ok: false, reason: "invalid duration" };
  if (
    v.device !== undefined &&
    !DEVICE_CLASSES.includes(v.device as DeviceClass)
  )
    return { ok: false, reason: "invalid device class" };
  return { ok: true, event: v as unknown as ListeningEventInput };
}

/**
 * Idempotent write of already-validated events for one server-authenticated
 * listener. (session_id, seq) is unique, so client retries never double count.
 * NOT CALLED ANYWHERE YET — see the module comment.
 */
export async function recordListeningEvents(
  db: PoolClient,
  listener: { id: string | null; listenerClass: ListenerClass },
  events: ListeningEventInput[],
) {
  if (!listeningTelemetryEnabled())
    throw new Error("Listening telemetry is not enabled");
  let written = 0;
  for (const e of events) {
    const result = await db.query(
      `INSERT INTO mtm_listening_events(session_id,client_event_seq,event_type,story_id,listener_id,listener_class,device_class,
        position_seconds,listened_seconds,story_duration_seconds,occurred_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (session_id,client_event_seq) DO NOTHING`,
      [
        e.sessionId,
        e.seq,
        e.type,
        e.storyId,
        listener.id,
        listener.listenerClass,
        e.device ?? "unknown",
        e.positionSeconds ?? null,
        e.listenedSeconds ?? 0,
        e.storyDurationSeconds ?? null,
        e.occurredAt,
      ],
    );
    written += result.rowCount ?? 0;
  }
  return written;
}
