"use client";

import { useEffect } from "react";
import { clearCart } from "@/lib/cart";

/**
 * Empties the localStorage cart once, on mount — used by the checkout
 * success page after Stripe confirms payment. Renders nothing; this is a
 * side effect only (calling a module-level function, not setting local
 * component state), so it doesn't trip the set-state-in-effect lint rule.
 */
export function ClearCartOnMount() {
  useEffect(() => {
    clearCart();
  }, []);

  return null;
}
