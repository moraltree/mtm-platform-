"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { addToCart, type CartItem } from "@/lib/cart";

export interface AddToCartButtonProps {
  item: Omit<CartItem, "quantity">;
}

export function AddToCartButton({ item }: AddToCartButtonProps) {
  const [added, setAdded] = useState(false);

  function handleClick() {
    addToCart(item);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2000);
  }

  return (
    <Button type="button" onClick={handleClick} aria-live="polite">
      {added ? "Added to cart" : "Add to cart"}
    </Button>
  );
}
