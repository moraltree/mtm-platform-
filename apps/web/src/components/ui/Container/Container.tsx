import type { ElementType, ComponentPropsWithoutRef, ReactNode } from "react";
import styles from "./Container.module.css";
import { cx } from "@/lib/cx";

type ContainerProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

/** Caps content width and applies the standard responsive gutter. */
export function Container<T extends ElementType = "div">({
  as,
  children,
  className,
  ...rest
}: ContainerProps<T>) {
  const Tag = as || "div";
  return (
    <Tag className={cx(styles.container, className)} {...rest}>
      {children}
    </Tag>
  );
}
