import { WORLD_CITIES, cityId, REGION_LABELS } from "./cities";
import type { Market, Plan, PlanOptions, Stop } from "./types";

/*
 * Sample data used only when the live API is unreachable.
 * Everything here is illustrative, not real Qloo output.
 */

type ArtistSeed = {
  name: string;
  home: { city: string; lat: number; lng: number };
  tags: string[];
  openers: string[];
  sponsors: { name: string; why: string }[];
};

const SEEDS: Record<string, ArtistSeed> = {
  "kendrick lamar": {
    name: "Kendrick Lamar",
    home: { city: "Compton", lat: 33.9, lng: -118.22 },
    tags: ["Hip-hop", "Streetwear", "Sneakers", "Documentary film", "Jazz", "Podcasts"],
    openers: ["SZA", "Isaiah Rashad", "Baby Keem", "Ab-Soul", "Schoolboy Q"],
    sponsors: [
      { name: "Nike", why: "Fans over-index on sneaker culture" },
      { name: "Beats", why: "Heavy headphone and streaming overlap" },
      { name: "Apple Music", why: "Strong album-first listening habits" },
      { name: "Hennessy", why: "Premium spirits affinity in the core audience" },
    ],
  },
  "dave chappelle": {
    name: "Dave Chappelle",
    home: { city: "Washington, D.C.", lat: 38.91, lng: -77.04 },
    tags: ["Stand-up", "Documentaries", "Jazz", "Sitcoms", "Podcasts", "Cigars"],
    openers: ["Mike Epps", "Hannibal Buress", "Jon Stewart", "Neal Brennan", "Donnell Rawlings"],
    sponsors: [
      { name: "Netflix", why: "Audience watches long-form comedy specials" },
      { name: "Bulleit", why: "Whiskey affinity across the core audience" },
      { name: "Audible", why: "Podcast and audiobook crossover" },
      { name: "Lyft", why: "Late-night venue travel need" },
    ],
  },
  coldplay: {
    name: "Coldplay",
    home: { city: "London", lat: 51.51, lng: -0.13 },
    tags: ["Pop-rock", "Festivals", "Sustainability", "Indie film", "Coffee", "Travel"],
    openers: ["Maggie Rogers", "Fontaines D.C.", "Lizzy McAlpine", "Wet Leg", "Jacob Collier"],
    sponsors: [
      { name: "Spotify", why: "Heaviest playlist-driven listeners" },
      { name: "Patagonia", why: "Strong outdoor and sustainability signal" },
      { name: "Airbnb", why: "Fans who travel for shows" },
      { name: "Oatly", why: "Plant-based food affinity" },
    ],
  },
};

const GENERIC: Omit<ArtistSeed, "name"> = {
  home: { city: "Los Angeles", lat: 34.05, lng: -118.24 },
  tags: ["Live music", "Streaming", "Festivals", "Street food", "Fashion", "Podcasts"],
  openers: ["Rising local act", "Genre-adjacent support", "Hometown favourite", "Viral newcomer", "Fan-voted opener"],
  sponsors: [
    { name: "Spotify", why: "Streaming-first audience" },
    { name: "Red Bull", why: "Live-event and nightlife overlap" },
    { name: "Adidas", why: "Fashion and sneaker affinity" },
    { name: "Heineken", why: "Beer affinity at live shows" },
  ],
};

/** The demo acts. These are pre-warmed so they load instantly. See scripts/warm.mjs. */
export const SUGGESTIONS = ["Coldplay", "Kendrick Lamar", "Dave Chappelle", "Bad Bunny", "Arijit Singh"];

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seedFor(artist: string): ArtistSeed {
  const seed = SEEDS[artist.trim().toLowerCase()];
  if (seed) return seed;
  const name = artist.trim() || "Your artist";
  return { name, ...GENERIC };
}

function pick<T>(arr: T[], n: number, h: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[(h + i * 3) % arr.length]);
  return Array.from(new Set(out));
}

export function buildSamplePlan(artist: string, opts: PlanOptions): Plan & { markets: Market[] } {
  const seed = seedFor(artist);
  const pool = WORLD_CITIES.filter((c) => opts.region === "world" || c.region === opts.region);
  const all = pool.map((c) => ({ c, score: 50 + (hash(seed.name + c.city) % 50) })).sort((a, b) => b.score - a.score);

  // On a worldwide tour, cap any one region so the route spans the globe.
  const cap = Math.max(2, Math.ceil(opts.stops * 0.35));
  const count = new Map<string, number>();
  const picked: typeof all = [];
  for (const x of all) {
    if (picked.length >= opts.stops) break;
    if (opts.region === "world" && (count.get(x.c.region) ?? 0) >= cap) continue;
    count.set(x.c.region, (count.get(x.c.region) ?? 0) + 1);
    picked.push(x);
  }

  const venue = { club: "Club, 800 cap", theatre: "Theatre, 3,000 cap", arena: "Arena, 15,000 cap" }[opts.budget];

  const stops: Stop[] = picked.map(({ c, score }, i) => {
    const h = hash(seed.name + c.city + i);
    const opener = seed.openers[h % seed.openers.length];
    const sponsors = pick(seed.sponsors, 3, h);
    const overlap = 54 + (h % 38);
    const t1 = seed.tags[(h + 1) % seed.tags.length].toLowerCase();
    const t2 = seed.tags[(h + 2) % seed.tags.length].toLowerCase();
    return {
      id: cityId(c.city),
      city: c.city,
      country: c.country,
      lat: c.lat,
      lng: c.lng,
      region: c.region,
      venueType: venue,
      demand: score,
      opener: { name: opener, overlap },
      sponsors,
      vip: [
        { name: `${c.city} local food crawl`, kind: "Food" },
        { name: `${c.city} late-night bar set`, kind: "Nightlife" },
        { name: `${seed.tags[h % seed.tags.length]} pop-up`, kind: "Fan experience" },
      ],
      adCopy: `${c.city}, you asked for it. ${seed.name} is live for one night.`,
      why: `Fans of ${seed.name} in ${REGION_LABELS[c.region]} also lean toward ${t1} and ${t2}, and there is no stop planned in ${c.city} yet.`,
    };
  });

  const markets: Market[] = all.map(({ c, score }) => ({
    id: cityId(c.city), city: c.city, country: c.country, lat: c.lat, lng: c.lng, region: c.region, demand: score,
  }));

  return { artist: seed.name, home: seed.home, tags: seed.tags, stops, source: "sample", markets };
}
