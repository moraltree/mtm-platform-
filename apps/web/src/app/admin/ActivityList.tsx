import type { FeedKind } from "@/lib/admin/insightsSnapshot";
import { timestamp } from "./components";
import styles from "./admin.module.css";

const labels: Record<FeedKind, { title: string; detail: string }> = {
  registration: { title: "Account registered", detail: "Account created" },
  trial_started: { title: "Trial started", detail: "Platform trial began" },
  conversion: {
    title: "Trial converted to paid",
    detail: "Recorded billing event",
  },
  new_paid: {
    title: "New paid subscription",
    detail: "First positive paid invoice",
  },
  payment: {
    title: "Successful subscription payment",
    detail: "Recorded billing event",
  },
  payment_failed: {
    title: "Payment attempt failed",
    detail: "Recorded billing event",
  },
  cancellation: {
    title: "Subscription canceled",
    detail: "Recorded billing event",
  },
  refund: { title: "Refund recorded", detail: "Recorded billing event" },
  dispute: { title: "Dispute update", detail: "Recorded billing event" },
};
const attention = new Set<FeedKind>([
  "payment_failed",
  "cancellation",
  "refund",
  "dispute",
]);

/** Generic labels and UTC times only: no names, emails, amounts or provider IDs. */
export function ActivityList({
  items,
}: {
  items: { kind: FeedKind; at: string }[];
}) {
  if (!items.length)
    return (
      <p className={styles.empty}>
        No account or billing activity has been recorded yet.
      </p>
    );
  return (
    <ol className={styles.activity}>
      {items.map((event, index) => {
        const label = labels[event.kind];
        if (!label) return null;
        return (
          <li key={`${event.at}-${index}`}>
            <span
              className={
                attention.has(event.kind) ? styles.dotAttention : styles.dot
              }
              aria-hidden="true"
            />
            <div>
              <strong>{label.title}</strong>
              <span>{label.detail}</span>
            </div>
            <time dateTime={event.at}>{timestamp(event.at)}</time>
          </li>
        );
      })}
    </ol>
  );
}
