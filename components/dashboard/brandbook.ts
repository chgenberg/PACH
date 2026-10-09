"use client";

import { useCallback, useSyncExternalStore } from "react";
import { PRINT_PER_UNIT, PRINT_SETUP } from "@/lib/pricing";

export const FONTS = ["Nunito", "Inter", "Montserrat", "Playfair Display", "Oswald", "Bebas Neue", "Lato", "Roboto Condensed"] as const;

export type Brandbook = {
  company: { name: string; orgnr: string; address: string; email: string; phone: string; website: string };
  brand: { logo: string; colors: string[]; headingFont: string; bodyFont: string };
  terms: { printPerUnit: number; setup: number; validDays: number; paymentDays: number; vatPct: number };
};

export const DEFAULT_BRANDBOOK: Brandbook = {
  company: { name: "Spotify AB", orgnr: "556703-7485", address: "Regeringsgatan 19, 111 53 Stockholm", email: "inkop@spotify.com", phone: "08-120 120 00", website: "spotify.com" },
  brand: { logo: "/api/brand-logo?host=spotify.com", colors: ["#1DB954", "#191414", "#FFFFFF", "#B3B3B3", "#535353"], headingFont: "Montserrat", bodyFont: "Inter" },
  terms: { printPerUnit: PRINT_PER_UNIT, setup: PRINT_SETUP, validDays: 30, paymentDays: 30, vatPct: 25 },
};

const KEY = "pach.brandbook.v1";
const listeners = new Set<() => void>();
let cache: Brandbook | null = null;

function read(): Brandbook {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULT_BRANDBOOK, ...(JSON.parse(raw) as Brandbook) } : DEFAULT_BRANDBOOK;
  } catch {
    cache = DEFAULT_BRANDBOOK;
  }
  return cache;
}

function write(next: Brandbook) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Brandbook shared by settings and the design tool; demo storage is the browser. */
export function useBrandbook() {
  const book = useSyncExternalStore(subscribe, read, () => DEFAULT_BRANDBOOK);
  const save = useCallback((next: Brandbook) => write(next), []);
  const reset = useCallback(() => write(DEFAULT_BRANDBOOK), []);
  return { book, save, reset };
}
