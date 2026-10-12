"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { SEARCH_CHIPS } from "@/lib/assortment";
import { fromPrice, searchFamilies } from "@/lib/catalog";
import { sek } from "@/lib/pricing";

const ROTATE_MS = 2600;

export function HeaderSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [chip, setChip] = useState(0);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (focused || q) return;
    const t = setInterval(() => setChip((c) => (c + 1) % SEARCH_CHIPS.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [focused, q]);

  const hits = useMemo(() => (q.trim().length > 1 ? searchFamilies(q).slice(0, 6) : []), [q]);
  const open = focused && q.trim().length > 1;

  const go = (query: string) => {
    const v = query.trim();
    if (!v) return;
    setFocused(false);
    input.current?.blur();
    router.push(`/sok?q=${encodeURIComponent(v)}`);
  };

  return (
    <form
      ref={box}
      role="search"
      className={`qs${focused ? " is-focus" : ""}${q ? " has-text" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (active >= 0 && hits[active]) {
          setFocused(false);
          router.push(`/p/${hits[active].id}`);
        } else go(q);
      }}
    >
      <svg className="qs-icon" viewBox="0 0 24 24" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        ref={input}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(-1);
        }}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (e.relatedTarget && box.current?.contains(e.relatedTarget as Node)) return;
          setFocused(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setQ("");
            input.current?.blur();
          }
          if (!hits.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % hits.length);
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a <= 0 ? hits.length - 1 : a - 1));
          }
        }}
        placeholder={focused ? "Sök bland profilprodukter…" : ""}
        aria-label="Sök produkter"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls="qs-results"
      />

      {!focused && !q ? (
        <div className="qs-hint">
          <span>Jag letar efter</span>
          <span className="qs-chips">
            {SEARCH_CHIPS.map((c, n) => (
              <Link
                key={c.q}
                href={`/sok?q=${encodeURIComponent(c.q)}`}
                className={n === chip ? "is-on" : n === (chip - 1 + SEARCH_CHIPS.length) % SEARCH_CHIPS.length ? "is-out" : ""}
                tabIndex={n === chip ? 0 : -1}
                aria-hidden={n !== chip}
              >
                {c.label}
              </Link>
            ))}
          </span>
        </div>
      ) : null}

      {q ? (
        <button
          type="button"
          className="qs-clear"
          aria-label="Rensa sökningen"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setQ("");
            input.current?.focus();
          }}
        >
          ×
        </button>
      ) : null}

      {open ? (
        <div id="qs-results" className="qs-results" role="listbox">
          {hits.length ? (
            <>
              {hits.map((f, n) => (
                <Link
                  key={f.id}
                  href={`/p/${f.id}`}
                  role="option"
                  aria-selected={n === active}
                  className={`qs-hit${n === active ? " is-on" : ""}`}
                  onMouseEnter={() => setActive(n)}
                  onClick={() => setFocused(false)}
                >
                  <Image src={f.image} alt="" width={56} height={56} />
                  <span>
                    <b>{f.name}</b>
                    <small>{f.subcategory}</small>
                  </span>
                  <em>från {sek(fromPrice(f))}</em>
                </Link>
              ))}
              <button type="submit" className="qs-all">
                Visa alla träffar för ”{q.trim()}” →
              </button>
            </>
          ) : (
            <p className="qs-empty">Inget träffade ”{q.trim()}”. Prova t-shirt, mugg eller penna.</p>
          )}
        </div>
      ) : null}
    </form>
  );
}