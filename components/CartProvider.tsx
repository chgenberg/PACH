"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  productId: string;
  qty: number;
  /** Bild i vald färg, med loggan om kunden angett sin URL. */
  image?: string;
  /** Vald produktfärg (hex); saknas = katalogfotots svarta original. */
  color?: string;
};

type CartState = {
  items: CartItem[];
  host: string;
  brand: string;
  brandColor: string;
  setBrand: (host: string, brand: string, color?: string) => void;
  add: (productId: string, image?: string) => void;
  save: (productId: string, line: Omit<CartItem, "productId">) => void;
  itemOf: (productId: string) => CartItem | null;
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  setImage: (productId: string, image: string) => void;
  clear: () => void;
  has: (productId: string) => boolean;
  qtyOf: (productId: string) => number;
  count: number;
  /** True once the saved cart has been read from localStorage. */
  ready: boolean;
};

const STORAGE_KEY = "pach.cart.v1";

const CartContext = createContext<CartState | null>(null);

type Persisted = { items: CartItem[]; host: string; brand: string; brandColor?: string };

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [host, setHost] = useState("");
  const [brand, setBrandName] = useState("");
  const [brandColor, setBrandColor] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Persisted;
        setItems(Array.isArray(p.items) ? p.items : []);
        setHost(p.host ?? "");
        setBrandName(p.brand ?? "");
        setBrandColor(p.brandColor ?? "");
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, host, brand, brandColor } satisfies Persisted));
    } catch {
      /* ignore */
    }
  }, [items, host, brand, brandColor, ready]);

  const add = useCallback((productId: string, image?: string) => {
    setItems((prev) => (prev.some((i) => i.productId === productId) ? prev : [...prev, { productId, qty: 50, image }]));
  }, []);

  const save = useCallback((productId: string, line: Omit<CartItem, "productId">) => {
    const next = { ...line, productId, qty: Math.max(1, Math.round(line.qty)) };
    setItems((prev) => (prev.some((i) => i.productId === productId) ? prev.map((i) => (i.productId === productId ? next : i)) : [...prev, next]));
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, qty: Math.max(1, Math.round(qty)) } : i)));
  }, []);

  /** Swap in the freshly branded photo, unless the customer already picked another colour. */
  const setImage = useCallback((productId: string, image: string) => {
    setItems((prev) => prev.map((i) => (i.productId === productId && !i.color ? { ...i, image } : i)));
  }, []);

  /** Start over: no products, no company. */
  const clear = useCallback(() => {
    setItems([]);
    setHost("");
    setBrandName("");
    setBrandColor("");
  }, []);

  const setBrand = useCallback((h: string, b: string, color?: string) => {
    setHost(h);
    setBrandName(b);
    setBrandColor(color ?? "");
  }, []);

  const value = useMemo<CartState>(
    () => ({
      items,
      host,
      brand,
      brandColor,
      setBrand,
      add,
      save,
      itemOf: (id) => items.find((i) => i.productId === id) ?? null,
      remove,
      setQty,
      setImage,
      clear,
      has: (id) => items.some((i) => i.productId === id),
      qtyOf: (id) => items.find((i) => i.productId === id)?.qty ?? 0,
      count: items.length,
      ready,
    }),
    [items, host, brand, brandColor, ready, setBrand, add, save, remove, setQty, setImage, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
