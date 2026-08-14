"use client";

import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import styles from "./CartView.module.css";

/**
 * Cart contents + subtotal + checkout entry point. Client component: the
 * cart only exists in localStorage (lib/cart.ts), so there's nothing to
 * render server-side. Checkout itself (the Server Action that turns this
 * into a Stripe Checkout Session) is a separate, not-yet-built piece —
 * this component only reads/mutates the display-only cart.
 */
export function CartView() {
  const {
    items,
    itemCount,
    subtotal,
    currency,
    updateCartQuantity,
    removeFromCart,
  } = useCart();

  if (itemCount === 0) {
    return <p className={styles.empty}>Your cart is empty.</p>;
  }

  return (
    <div className={styles.wrap}>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.stripePriceId} className={styles.item}>
            <div className={styles.itemMedia}>
              {item.imageSrc && (
                <Image
                  src={item.imageSrc}
                  alt=""
                  fill
                  sizes="6rem"
                  className={styles.itemImage}
                />
              )}
            </div>
            <div className={styles.itemBody}>
              <p className={styles.itemTitle}>{item.title}</p>
              <p className={styles.itemPrice}>
                {formatPrice(item.unitAmount, item.currency)}
                {item.priceType === "subscription" ? " / billing cycle" : ""}
              </p>
            </div>
            <div className={styles.itemControls}>
              {item.priceType === "subscription" ? (
                <span className={styles.qtyFixed}>Qty {item.quantity}</span>
              ) : (
                <label className={styles.qtyLabel}>
                  Qty
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={item.quantity}
                    className={styles.qtyInput}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (Number.isFinite(next)) {
                        updateCartQuantity(
                          item.stripePriceId,
                          Math.max(1, Math.min(99, next)),
                        );
                      }
                    }}
                  />
                </label>
              )}
              <button
                type="button"
                className={styles.remove}
                onClick={() => removeFromCart(item.stripePriceId)}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className={styles.summary}>
        <p className={styles.subtotal}>
          Subtotal: {currency ? formatPrice(subtotal, currency) : null}
        </p>
        <p className={styles.note}>
          Taxes (VAT), if applicable, are calculated at checkout. Subscription
          items renew until cancelled.
        </p>
        <Button href="/checkout" size="lg">
          Checkout
        </Button>
      </div>
    </div>
  );
}
