import { useId, type InputHTMLAttributes } from "react";
import styles from "./Checkbox.module.css";
import { cx } from "@/lib/cx";

type CheckboxProps = {
  /** The visible label text, as a full sentence — a checkbox's label
   * *is* the thing being agreed to/confirmed, unlike a text field where
   * the label just names the field. Rendered as real DOM content (not
   * hidden), same accessibility bar as `TextField`. */
  label: React.ReactNode;
  error?: string;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className" | "type">;

/** Self-contained labelled checkbox — same programmatic-association and
 * error-announcement pattern as `TextField`/`TextArea`
 * (`components/ui/FormField`), specialised for a single boolean
 * confirmation (adult/guardian confirmation, Terms/Privacy acceptance,
 * marketing consent) rather than a text value. A 44px min touch target
 * on the input itself, not just its label, since this is the control
 * mobile QR-campaign visitors interact with most on this form. */
export function Checkbox({
  label,
  error,
  required,
  className,
  ...rest
}: CheckboxProps) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cx(styles.field, className)}>
      <div className={styles.row}>
        <input
          id={id}
          type="checkbox"
          required={required}
          aria-describedby={errorId}
          aria-invalid={error ? true : undefined}
          className={cx(styles.input, error && styles.inputError)}
          {...rest}
        />
        <label htmlFor={id} className={styles.label}>
          {label}
          {required && (
            <span aria-hidden="true" className={styles.required}>
              {" "}
              *
            </span>
          )}
        </label>
      </div>
      {error && (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
