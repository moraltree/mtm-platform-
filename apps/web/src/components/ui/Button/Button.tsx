import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";
import Link from "next/link";
import styles from "./Button.module.css";
import { cx } from "@/lib/cx";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

interface BaseProps {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
}

interface ButtonAsButton
  extends
    BaseProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps> {
  href?: undefined;
}

interface ButtonAsLink
  extends
    BaseProps,
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof BaseProps> {
  href: string;
  /** External links render a plain `<a>` (new tab); internal use next/link. */
  external?: boolean;
}

export type ButtonProps = ButtonAsButton | ButtonAsLink;

/** The single interactive-affordance component — every CTA in the design
 * system (hero, CTA panel, cards) renders through this, link or button. */
export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = cx(styles.button, styles[variant], styles[size], className);

  if ("href" in rest && rest.href) {
    const { href, external, ...anchorRest } = rest;
    if (external) {
      return (
        <a
          href={href}
          className={classes}
          target="_blank"
          rel="noopener noreferrer"
          {...anchorRest}
        >
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={classes} {...anchorRest}>
        {children}
      </Link>
    );
  }

  return (
    <button
      className={classes}
      {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {children}
    </button>
  );
}
