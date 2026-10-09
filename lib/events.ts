import { families } from "@/lib/catalog";
import { eventTags, EVENT_IDS, type EventId } from "@/lib/eventAgent";

export type EventDef = {
  slug: EventId;
  name: string;
  tone: string;
  ink: string;
  hint: string;
  /** Produkt-id vars bild används som motiv i rutan. */
  hero: string;
  wide?: boolean;
  /** Neutral "DIN LOGO"-scen som brandas med kundens logga. */
  scene: string;
  /** Laddningstexter som visas medan scenen och produkterna skapas. */
  stages: string[];
  /** Två livsstilsfoton med riktiga personer och en av händelsens produkter. */
  photos: [EventPhoto, EventPhoto];
};

export type EventPhoto = { product: string; caption: string; scene: string };

const PRODUCT_STAGES = ["Lägger er logga på produkterna…", "Kvalitetsgranskar bilderna…", "Sista detaljerna…"];

export const EVENTS: EventDef[] = [
  {
    slug: "massa",
    name: "Mässa",
    tone: "#d7ecfb",
    ink: "#16324a",
    wide: true,
    hint: "Monter, giveaways och det som syns på håll",
    hero: "DEMO-P040",
    scene: "/scenes/massa.jpg",
    stages: ["Bygger montern…", "Trycker mässväggen…", "Klär personalen i profilkläder…", ...PRODUCT_STAGES],
    photos: [
      { product: "DEMO-P001", caption: "Personalen i montern", scene: "A friendly young woman working at a trade show booth, smiling and handing a brochure to a visitor, wearing the black t-shirt. A busy, softly out-of-focus exhibition hall behind her, warm hall lighting." },
      { product: "DEMO-P014", caption: "Besökarna tar med sig er", scene: "A visitor in his thirties walking through a bright exhibition hall aisle, carrying the tote bag over his shoulder with a few brochures in it, three-quarter view with the bag facing the camera. Other visitors softly out of focus." },
    ],
  },
  {
    slug: "kickoff",
    name: "Kick-off",
    tone: "#f7d7e4",
    ink: "#4a1730",
    hint: "Profilkläder och produkter som bygger laget",
    hero: "DEMO-P004",
    scene: "/scenes/kickoff.jpg",
    stages: ["Klär lokalen…", "Trycker bannerväggen…", "Klär laget i hoodies…", ...PRODUCT_STAGES],
    photos: [
      { product: "DEMO-P004", caption: "Laget i samma hoodie", scene: "Three colleagues laughing together outdoors on a crisp autumn day at a Scandinavian lakeside kick-off, the woman in the middle wearing the hoodie, front view, golden afternoon light, forest softly out of focus." },
      { product: "DEMO-P020", caption: "Med på aktiviteterna", scene: "A young man taking a break during a team hike on a Swedish mountain trail, holding the water bottle with the front facing the camera, smiling, wide landscape behind him." },
    ],
  },
  {
    slug: "konferens",
    name: "Konferens",
    tone: "#eceaf1",
    ink: "#2b2433",
    hint: "Block, pennor och teknik för deltagarna",
    hero: "DEMO-P026",
    scene: "/scenes/konferens.jpg",
    stages: ["Bygger scenen…", "Trycker scenväggen…", "Dukar registreringen…", ...PRODUCT_STAGES],
    photos: [
      { product: "DEMO-P026", caption: "Anteckningar som stannar kvar", scene: "A conference participant in a light blazer sitting at a bright conference table, the closed notebook lying in front of her with the front cover facing up towards the camera, a pen and a glass of water beside it, a blurred stage in the background." },
      { product: "DEMO-P028", caption: "Alla bär er logga", scene: "Two smiling conference attendees talking in a bright foyer during a coffee break, the man in front wearing the lanyard around his neck with the strap clearly visible on his chest, coffee cups in hand." },
    ],
  },
  {
    slug: "sommar",
    name: "Sommar",
    tone: "#f6e38b",
    ink: "#3d3208",
    hint: "Utomhus, sol och svalka",
    hero: "DEMO-P035",
    scene: "/scenes/sommar.jpg",
    stages: ["Dukar upp vid sjön…", "Trycker fotoväggen…", "Klär laget i sommarkläder…", ...PRODUCT_STAGES],
    photos: [
      { product: "DEMO-P011", caption: "Sol, hamn och er keps", scene: "A smiling young woman at a sunny Swedish harbour in summer, wearing the baseball cap, three-quarter front view with the front of the cap clearly visible, boats and red wooden houses softly out of focus." },
      { product: "DEMO-P036", caption: "Ett dopp efter jobbet", scene: "A man sitting on a wooden jetty by a calm lake in warm evening sun, the bath towel draped over his shoulders with the logo facing the camera, relaxed and smiling." },
    ],
  },
  {
    slug: "event",
    name: "Event & fest",
    tone: "#f8e4cf",
    ink: "#4a2a12",
    hint: "Mingel, bar och det gästerna minns",
    hero: "DEMO-P038",
    scene: "/scenes/event.jpg",
    stages: ["Bygger eventet…", "Trycker fotoväggen…", "Ställer i ordning baren…", ...PRODUCT_STAGES],
    photos: [
      { product: "DEMO-P037", caption: "Baren i er profil", scene: "A bartender mixing a cocktail behind a stylish bar at an evening brand event, wearing the apron, front view, warm string lights and bokeh behind him." },
      { product: "DEMO-P038", caption: "Gåvan gästerna minns", scene: "A smiling guest in an elegant dress receiving the gift box from a host at the exit of an evening event, the box held with the lid facing the camera, warm light." },
    ],
  },
  {
    slug: "julklapp",
    name: "Julklapp & gåva",
    tone: "#f4d4d2",
    ink: "#4a1814",
    hint: "Något att ge bort och ta med hem",
    hero: "DEMO-P039",
    scene: "/scenes/julklapp.jpg",
    stages: ["Dukar julbordet…", "Slår in paketen…", "Trycker presentaskarna…", ...PRODUCT_STAGES],
    photos: [
      { product: "DEMO-P012", caption: "Varm hela vintern", scene: "A young woman walking on a snowy Stockholm street at dusk in December, wearing the knitted beanie with the front clearly visible, warm Christmas lights softly out of focus behind her." },
      { product: "DEMO-P021", caption: "Julklappen som används varje dag", scene: "Two hands in knitted mittens holding the insulated tumbler with steam rising, the front facing the camera, a snowy forest and a red cottage softly out of focus." },
    ],
  },
];

export const eventOf = (slug: string): EventDef | null => EVENTS.find((e) => e.slug === slug) ?? null;

/** Produkter som flödesagenten taggat för den här händelsen. */
export const familiesForEvent = (slug: EventId) => families.filter((f) => eventTags(f).includes(slug));

export { EVENT_IDS };
export type { EventId };
