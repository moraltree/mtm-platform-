"use client";
import { useEffect, useRef } from "react";
import { verify } from "./actions";
export function VerifyForm() {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (input.current) input.current.value = window.location.hash.slice(1);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  return (
    <form action={verify}>
      <input ref={input} type="hidden" name="token" />
      <button type="submit">Confirm email and sign in</button>
    </form>
  );
}
