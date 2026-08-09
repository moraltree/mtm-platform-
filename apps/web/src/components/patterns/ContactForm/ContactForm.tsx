"use client";

import { useActionState, useEffect, useRef } from "react";
import Script from "next/script";
import { Container } from "@/components/ui/Container";
import { TextField, TextArea } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { submitContactForm, initialContactFormState } from "./actions";
import styles from "./ContactForm.module.css";

export interface ContactFormProps {
  heading?: string;
  intro?: string;
}

// Public by design (it identifies the widget, not a secret) — unset means
// the widget and its script simply don't render, so the form still works
// (backstopped by the honeypot + server-side rate limit) until a real key
// is configured. See .env.example.
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function ContactForm({ heading, intro }: ContactFormProps) {
  const [state, formAction, pending] = useActionState(
    submitContactForm,
    initialContactFormState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <section className={styles.section}>
      <Container className={styles.inner}>
        {heading && <h2>{heading}</h2>}
        {intro && <p className={styles.intro}>{intro}</p>}

        <form
          ref={formRef}
          action={formAction}
          className={styles.form}
          noValidate
        >
          {/* Honeypot — see actions.ts. Hidden off-screen (not display:none/
              hidden, which unsophisticated bots often skip) and out of both
              the tab order and the accessibility tree. */}
          <div className={styles.honeypot} aria-hidden="true">
            <label htmlFor="company">Company</label>
            <input
              id="company"
              name="company"
              type="text"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          <TextField
            label="Name"
            name="name"
            required
            error={state.fieldErrors?.name}
          />
          <TextField
            label="Email"
            name="email"
            type="email"
            required
            error={state.fieldErrors?.email}
          />
          <TextArea
            label="Message"
            name="message"
            required
            error={state.fieldErrors?.message}
          />

          {turnstileSiteKey && (
            <div className="cf-turnstile" data-sitekey={turnstileSiteKey} />
          )}

          {state.status === "error" && state.message && (
            <p role="alert" className={styles.formError}>
              {state.message}
            </p>
          )}
          {state.status === "success" && state.message && (
            <p role="status" className={styles.formSuccess}>
              {state.message}
            </p>
          )}

          <Button type="submit" disabled={pending}>
            {pending ? "Sending…" : "Send message"}
          </Button>
        </form>
      </Container>

      {turnstileSiteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          async
          defer
        />
      )}
    </section>
  );
}
