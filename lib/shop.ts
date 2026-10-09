export const SHOPS = [
  {
    slug: "massa-event",
    name: "Mässa & Event",
    tone: "#d7ecfb",
    ink: "#16324a",
    wide: true,
    hint: "Podium, flaggor och det som syns på håll",
    hero: "DEMO-P040",
  },
  {
    slug: "klader",
    name: "Kläder",
    tone: "#f7d7e4",
    ink: "#4a1730",
    hint: "T-shirt, hoodie, keps och jacka",
    hero: "DEMO-P001",
  },
  {
    slug: "vaskor",
    name: "Väskor & Påsar",
    tone: "#dce7f7",
    ink: "#1a2d4a",
    hint: "Tygkasse, ryggsäck och fodral",
    hero: "DEMO-P015",
  },
  {
    slug: "paraplyer",
    name: "Paraplyer",
    tone: "#f6e38b",
    ink: "#3d3208",
    hint: "Ett motiv som syns i regn",
    hero: "DEMO-P029",
  },
  {
    slug: "pennor",
    name: "Reklampennor",
    tone: "#e4f3c9",
    ink: "#2a3d12",
    hint: "Pennor till montern och skrivbordet",
    hero: "DEMO-P024",
  },
  {
    slug: "elektronik",
    name: "Elektronik",
    tone: "#cfe4f8",
    ink: "#12344d",
    hint: "Laddning, ljud och sladdar",
    hero: "DEMO-P034",
  },
  {
    slug: "godis",
    name: "Godis",
    tone: "#f8e4cf",
    ink: "#4a2a12",
    hint: "Askar som får följa med hem",
    hero: "DEMO-P039",
  },
  {
    slug: "sakerhet",
    name: "Säkerhet",
    tone: "#f4d4d2",
    ink: "#4a1814",
    hint: "Reflex och plagg som syns",
    hero: "DEMO-P030",
  },
  {
    slug: "kontor",
    name: "Kontor",
    tone: "#eceaf1",
    ink: "#2b2433",
    hint: "Mugg, flaska, block och band",
    hero: "DEMO-P021",
  },
] as const;

export type ShopSlug = (typeof SHOPS)[number]["slug"];

export const shopOf = (slug: string) => SHOPS.find((item) => item.slug === slug) ?? null;
