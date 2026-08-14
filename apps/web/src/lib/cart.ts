"use client";

import { useSyncExternalStore } from "react";

/**
 * Client-side cart, persisted to localStorage. No React Context/Provider:
 * there's only ever one cart per browser, so plain module-level state +
 * `useSyncExternalStore` (the same pattern `lib/consent.ts`/
 * `ConsentBanner` already use for exactly this kind of browser-storage
 * state) is enough — every component calling `useCart()` shares the same
 * underlying store and stays in sync via the change event below.
 *
 * Deliberately NOT the source of truth for what a customer is actually
 * charged: `unitAmount`/`currency` here are display-only, captured at
 * add-to-cart time. The checkout Server Action (app/checkout/actions.ts)
 * only ever sends `stripePriceId` + `quantity` to Stripe — never a
 * client-supplied amount — so a tampered localStorage cart can't change
 * what's actually charged.
 */
export interface CartItem {
  productId: string;
  slug: string;
  stripePriceId: string;
  title: string;
  priceType: "one-time" | "subscription";
  unitAmount: number;
  currency: string;
  imageSrc?: string;
  quantity: number;
}

const STORAGE_KEY = "mtm-cart";
const CHANGE_EVENT = "mtm-cart-change";
const EMPTY: CartItem[] = [];

// Cached parsed array, invalidated on notify — required for
// useSyncExternalStore: returning a freshly-parsed (and therefore new-
// reference) array on every getSnapshot() call would make React think
// the store changes on every render.
let cache: CartItem[] | null = null;

function readFromStorage(): CartItem[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): CartItem[] {
  if (cache === null) cache = readFromStorage();
  return cache;
}

function getServerSnapshot(): CartItem[] {
  return EMPTY;
}

function persist(items: CartItem[]) {
  cache = items;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function subscribe(onStoreChange: () => void) {
  function handleChange() {
    cache = null; // also covers cross-tab "storage" events we didn't write ourselves
    onStoreChange();
  }
  window.addEventListener(CHANGE_EVENT, handleChange);
  window.addEventListener("storage", handleChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handleChange);
    window.removeEventListener("storage", handleChange);
  };
}

export function addToCart(item: Omit<CartItem, "quantity">, quantity = 1) {
  const items = getSnapshot();
  const existing = items.find((i) => i.stripePriceId === item.stripePriceId);
  const next = existing
    ? items.map((i) =>
        i.stripePriceId === item.stripePriceId
          ? { ...i, quantity: i.quantity + quantity }
          : i,
      )
    : [...items, { ...item, quantity }];
  persist(next);
}

export function updateCartQuantity(stripePriceId: string, quantity: number) {
  const items = getSnapshot();
  const next =
    quantity <= 0
      ? items.filter((i) => i.stripePriceId !== stripePriceId)
      : items.map((i) =>
          i.stripePriceId === stripePriceId ? { ...i, quantity } : i,
        );
  persist(next);
}

export function removeFromCart(stripePriceId: string) {
  persist(getSnapshot().filter((i) => i.stripePriceId !== stripePriceId));
}

export function clearCart() {
  persist(EMPTY);
}

export function useCart() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.unitAmount * i.quantity, 0);
  // Single-currency storefront assumption: every product uses the Stripe
  // account's default currency, so the first item's currency stands for
  // the whole cart's subtotal.
  const currency = items[0]?.currency;

  return {
    items,
    itemCount,
    subtotal,
    currency,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
  };
}
