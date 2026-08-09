import {
  useId,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import styles from "./FormField.module.css";
import { cx } from "@/lib/cx";

interface BaseFieldProps {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
}

function useFieldIds(hint?: string, error?: string) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return { id, hintId, errorId, describedBy };
}

type TextFieldProps = BaseFieldProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className">;

/** Self-contained labelled text input — label, hint, and error are all
 * programmatically associated (WCAG 3.3.2, 4.1.2). */
export function TextField({
  label,
  hint,
  error,
  required,
  className,
  ...rest
}: TextFieldProps) {
  const { id, hintId, errorId, describedBy } = useFieldIds(hint, error);
  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && (
          <span aria-hidden="true" className={styles.required}>
            {" "}
            *
          </span>
        )}
      </label>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      <input
        id={id}
        required={required}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={cx(styles.input, error && styles.inputError)}
        {...rest}
      />
      {error && (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}

type TextAreaProps = BaseFieldProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "className">;

export function TextArea({
  label,
  hint,
  error,
  required,
  rows = 5,
  className,
  ...rest
}: TextAreaProps) {
  const { id, hintId, errorId, describedBy } = useFieldIds(hint, error);
  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && (
          <span aria-hidden="true" className={styles.required}>
            {" "}
            *
          </span>
        )}
      </label>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      <textarea
        id={id}
        rows={rows}
        required={required}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={cx(styles.input, error && styles.inputError)}
        {...rest}
      />
      {error && (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
