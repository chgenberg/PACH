"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  productId: string;
  qty: number;
  /** Brandad bild (data-URL) om kunden angett sin URL, annars tom. */
  image?: string;
};

type CartState = {
  items: CartItem[];
  host: string;
  brand: string;
  setBrand: (host: string, brand: string) => void;
  add: (productId: string, image?: string) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  setImage: (productId: string, image: string) => void;
  clear: () => void;
  has: (productId: string) => boolean;
  qtyOf: (productId: string) => number;
  count: number;
};

const STORAGE_KEY = "pach.cart.v1";

const CartContext = createContext<CartState | null>(null);

type Persisted = { items: CartItem[]; host: string; brand: string };

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [host, setHost] = useState("");
  const [brand, setBrandName] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Persisted;
        setItems(Array.isArray(p.items) ? p.items : []);
        setHost(p.host ?? "");
        setBrandName(p.brand ?? "");
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, host, brand } satisfies Persisted));
    } catch {
      /* ignore */
    }
  }, [items, host, brand, ready]);

  const add = useCallback((productId: string, image?: string) => {
    setItems((prev) => (prev.some((i) => i.productId === productId) ? prev : [...prev, { productId, qty: 50, image }]));
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, qty: Math.max(1, Math.round(qty)) } : i)));
  }, []);

  const setImage = useCallback((productId: string, image: string) => {
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, image } : i)));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const setBrand = useCallback((h: string, b: string) => {
    setHost(h);
    setBrandName(b);
  }, []);

  const value = useMemo<CartState>(
    () => ({
      items,
      host,
      brand,
      setBrand,
      add,
      remove,
      setQty,
      setImage,
      clear,
      has: (id) => items.some((i) => i.productId === id),
      qtyOf: (id) => items.find((i) => i.productId === id)?.qty ?? 0,
      count: items.length,
    }),
    [items, host, brand, setBrand, add, remove, setQty, setImage, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
