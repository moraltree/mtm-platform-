import type { ElementType, ComponentPropsWithoutRef, ReactNode } from "react";
import styles from "./VisuallyHidden.module.css";

type VisuallyHiddenProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children">;

/** Screen-reader-only content — present in the a11y tree, invisible on screen. */
export function VisuallyHidden<T extends ElementType = "span">({
  as,
  children,
  ...rest
}: VisuallyHiddenProps<T>) {
  const Tag = as || "span";
  return (
    <Tag className={styles.visuallyHidden} {...rest}>
      {children}
    </Tag>
  );
}
