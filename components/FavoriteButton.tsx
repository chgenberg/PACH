"use client";

import { useFavorites } from "@/lib/favorites";

export function FavoriteButton({ id, name, compact }: { id: string; name: string; compact?: boolean }) {
  const fav = useFavorites();
  const on = fav.has(id);
  return (
    <button
      type="button"
      className={`fav-btn${on ? " is-on" : ""}${compact ? " is-compact" : ""}`}
      aria-pressed={on}
      aria-label={on ? `Ta bort ${name} från favoriter` : `Spara ${name} som favorit`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        fav.toggle(id);
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M12 20s-7-4.6-9.5-8.4C.6 8.6 2.2 5 6 5c2 0 3.3 1.2 4 2.2C10.7 6.2 12 5 14 5c3.8 0 5.4 3.6 3.5 6.6C19 15.4 12 20 12 20z" />
      </svg>
    </button>
  );
}