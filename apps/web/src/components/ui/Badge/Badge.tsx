import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import styles from "./Badge.module.css";

export interface BadgeProps {
  children: ReactNode;
  tone?: "neutral" | "brand";
  className?: string;
}

/** Small status/tag pill — Story World status and format labels today. */
export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span className={cx(styles.badge, styles[tone], className)}>
      {children}
    </span>
  );
}
