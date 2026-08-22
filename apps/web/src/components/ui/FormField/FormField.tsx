import {
  useId,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import styles from "./FormField.module.css";
import { cx } from "@/lib/cx";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";

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

type TextFieldProps = BaseFieldProps & {
  /** Keeps `label` in the accessibility tree (still programmatically
   * associated via `htmlFor`) but hides it visually — for compact forms
   * where a `placeholder` carries the visible hint instead (e.g. a
   * single-field email-capture bar). Off by default; every existing
   * caller renders its label exactly as before. `TextField`-only: a
   * `TextArea` always needs a visible label. */
  hideLabel?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className">;

/** Self-contained labelled text input — label, hint, and error are all
 * programmatically associated (WCAG 3.3.2, 4.1.2). */
export function TextField({
  label,
  hideLabel,
  hint,
  error,
  required,
  className,
  ...rest
}: TextFieldProps) {
  const { id, hintId, errorId, describedBy } = useFieldIds(hint, error);
  const labelContent = (
    <>
      {label}
      {required && (
        <span aria-hidden="true" className={styles.required}>
          {" "}
          *
        </span>
      )}
    </>
  );
  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={id} className={styles.label}>
        {hideLabel ? (
          <VisuallyHidden>{labelContent}</VisuallyHidden>
        ) : (
          labelContent
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

type SelectFieldProps = BaseFieldProps & {
  hideLabel?: boolean;
  /** `<option>` elements, passed as children — same as a plain
   * `<select>`, so a caller can mix a placeholder `<option value="">`
   * with real values without this component inventing an "empty option"
   * convention of its own. */
  children: React.ReactNode;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "className">;

/** Self-contained labelled `<select>` — same associated-label/hint/error
 * pattern as `TextField`. Used for the registration form's (optional)
 * country selector today. */
export function SelectField({
  label,
  hideLabel,
  hint,
  error,
  required,
  className,
  children,
  ...rest
}: SelectFieldProps) {
  const { id, hintId, errorId, describedBy } = useFieldIds(hint, error);
  const labelContent = (
    <>
      {label}
      {required && (
        <span aria-hidden="true" className={styles.required}>
          {" "}
          *
        </span>
      )}
    </>
  );
  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={id} className={styles.label}>
        {hideLabel ? (
          <VisuallyHidden>{labelContent}</VisuallyHidden>
        ) : (
          labelContent
        )}
      </label>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      <select
        id={id}
        required={required}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={cx(styles.input, error && styles.inputError)}
        {...rest}
      >
        {children}
      </select>
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
