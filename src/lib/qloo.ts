/*
 * Typed Qloo client (server only). Uses the hackathon base URL and the X-Api-Key header.
 * Responses are cached privately in memory, which the Qloo terms allow.
 */

const TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { t: number; p: Promise<unknown> }>();

import type { SubjectKind } from "./types";

export type QlooTag = { name: string; tag_id?: string; type?: string };
export type QlooEntity = {
  entity_id: string;
  name: string;
  popularity?: number;
  tags?: QlooTag[];
  query?: { affinity?: number };
  properties?: {
    short_description?: string;
    image?: { url?: string };
    external?: { lastfm?: { listeners?: number; scrobbles?: number } };
  };
};

async function fetchRetry(url: string, key: string): Promise<unknown> {
  let last: Error | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "X-Api-Key": key }, cache: "no-store" });
      if (res.ok) return await res.json();
      if (res.status !== 429 && res.status < 500) {
        throw new Error(`Qloo ${res.status}: ${(await res.text()).slice(0, 200)}`);
      }
      last = new Error(`Qloo ${res.status}`);
    } catch (e) {
      last = e as Error;
      if (/^Qloo 4/.test(last.message)) throw last;
    }
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  throw last ?? new Error("Qloo request failed");
}

export function qlooConfigured() {
  return Boolean(process.env.QLOO_BASE_URL && process.env.QLOO_API_KEY);
}

export async function qloo<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const base = (process.env.QLOO_BASE_URL ?? "").replace(/\/+$/, "");
  const key = process.env.QLOO_API_KEY;
  if (!base || !key) throw new Error("Qloo is not configured");

  const qs = new URLSearchParams();
  Object.keys(params).sort().forEach((k) => params[k] !== undefined && qs.set(k, String(params[k])));
  const url = `${base}${path}?${qs}`;

  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < TTL_MS) return hit.p as Promise<T>;
  const p = fetchRetry(url, key);
  cache.set(url, { t: Date.now(), p });
  p.catch(() => cache.delete(url));
  return p as Promise<T>;
}

// ---------- Tools used by the agent ----------

export type SubjectType = "urn:entity:artist" | "urn:entity:person" | "urn:entity:brand" | "urn:entity:podcast";

export type Subject = {
  id: string;
  name: string;
  type: SubjectType;
  kind: SubjectKind;
  popularity: number;
  tags: QlooTag[];
  description: string;
  image: string | null;
  lastfm: { listeners?: number; scrobbles?: number } | null;
};

const SEARCH_TYPES: { type: SubjectType; bias: number }[] = [
  { type: "urn:entity:artist", bias: 0.6 },
  { type: "urn:entity:person", bias: 0.6 },
  { type: "urn:entity:podcast", bias: 0.2 },
  { type: "urn:entity:brand", bias: 0 },
];

const SPORT = /soccer|football|baseball|basketball|hockey|cricket|rugby|sports? team|premier league|nfl|nba|mlb|nhl|la liga|serie a|bundesliga|club/i;

// A sports club can also be filed as an artist in Qloo, so read the description too.
const CLUB = /\b(football|soccer|baseball|basketball|hockey|cricket|rugby)\b[^.]*\b(club|team|franchise)\b|\b(club|team|franchise)\b[^.]*\b(football|soccer|baseball|basketball|hockey|cricket|rugby)\b|professional sports?/i;

function kindOf(type: SubjectType, tags: QlooTag[], description: string): SubjectKind {
  if (type === "urn:entity:podcast") return "podcast";
  if (CLUB.test(description)) return "team";
  if (type === "urn:entity:brand") return SPORT.test(`${description} ${tags.map((t) => t.name).join(" ")}`) ? "team" : "brand";
  return "act";
}

/**
 * Turn a name into a Qloo entity. Searches artists, people (comedians, actors), podcasts and brands
 * (which includes sports clubs). An exact name match wins, then popularity, with acts preferred on a tie.
 */
export async function findSubject(name: string): Promise<Subject | null> {
  const results = await Promise.all(
    SEARCH_TYPES.map(({ type }) =>
      qloo<{ results?: QlooEntity[] }>("/search", { query: name, types: type, take: 3 })
        .then((r) => (r.results ?? [])[0])
        .catch(() => undefined),
    ),
  );
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const nq = norm(name);
  let best: { e: QlooEntity; type: SubjectType; score: number } | null = null;
  results.forEach((e, i) => {
    if (!e) return;
    const n = norm(e.name);
    const score = (n === nq ? 10 : n.startsWith(nq) ? 1 : 0) + (e.popularity ?? 0) + SEARCH_TYPES[i].bias;
    if (!best || score > best.score) best = { e, type: SEARCH_TYPES[i].type, score };
  });
  if (!best) return null;
  const b = best as { e: QlooEntity; type: SubjectType; score: number };
  const tags = b.e.tags ?? [];
  const description = b.e.properties?.short_description ?? "";
  return {
    id: b.e.entity_id,
    name: b.e.name,
    type: b.type,
    kind: kindOf(b.type, tags, description),
    popularity: b.e.popularity ?? 0,
    tags,
    description,
    image: b.e.properties?.image?.url ?? null,
    lastfm: b.e.properties?.external?.lastfm ?? null,
  };
}
type InsightsResponse = { results?: { entities?: QlooEntity[]; heatmap?: HeatCell[] } };
export type HeatCell = { location: { latitude: number; longitude: number }; query?: { affinity?: number } };

export async function related(subjectId: string, type: string, take = 10): Promise<QlooEntity[]> {
  const r = await qloo<InsightsResponse>("/v2/insights", {
    "filter.type": type,
    "signal.interests.entities": subjectId,
    take,
  });
  return r.results?.entities ?? [];
}

const point = (lat: number, lng: number) => `POINT(${lng} ${lat})`;

/** How well a city's places match the subject's fans: mean affinity of the top places nearby. */
export async function cityFit(subjectId: string, lat: number, lng: number) {
  const r = await qloo<InsightsResponse>("/v2/insights", {
    "filter.type": "urn:entity:place",
    "signal.interests.entities": subjectId,
    "filter.location": point(lat, lng),
    "filter.location.radius": 15000,
    take: 10,
  });
  const e = r.results?.entities ?? [];
  const mean = e.length ? e.reduce((a, x) => a + (x.query?.affinity ?? 0), 0) / e.length : 0;
  return { mean, places: e.slice(0, 3).map((x) => x.name) };
}

export const TAGS = {
  restaurant: "urn:tag:genre:place:restaurant",
  bar: "urn:tag:category:place:bar",
  nightclub: "urn:tag:category:place:night_club",
} as const;

export async function placesByTag(subjectId: string, lat: number, lng: number, tag: string, take = 2) {
  const r = await qloo<InsightsResponse>("/v2/insights", {
    "filter.type": "urn:entity:place",
    "signal.interests.entities": subjectId,
    "filter.tags": tag,
    "filter.location": point(lat, lng),
    "filter.location.radius": 15000,
    take,
  });
  return (r.results?.entities ?? []).map((x) => x.name);
}

/** Venue categories by show size. Tag IDs are Qloo place categories. */
export const VENUE_TAGS = {
  arena: [
    { tag: "urn:tag:category:place:stadium", category: "Stadium", size: "20,000+" },
    { tag: "urn:tag:category:place:arena", category: "Arena", size: "8,000 to 20,000" },
  ],
  theatre: [
    { tag: "urn:tag:category:place:concert_hall", category: "Concert hall", size: "1,500 to 4,000" },
    { tag: "urn:tag:category:place:performing_arts_theater", category: "Theatre", size: "800 to 3,000" },
  ],
  club: [
    { tag: "urn:tag:category:place:live_music_venue", category: "Live music venue", size: "200 to 1,500" },
    { tag: "urn:tag:category:place:night_club", category: "Club", size: "300 to 2,000" },
  ],
} as const;

export type VenueHit = { name: string; category: string; size: string; fit: number; popularity: number };

/**
 * Real venues near a city that suit the show size, ranked by how well they match the act's fans.
 * Qloo gives no capacities, so "size" is the typical range for the venue category, not a measured number.
 */
export async function venuesNear(subjectId: string, lat: number, lng: number, budget: keyof typeof VENUE_TAGS, take = 4): Promise<VenueHit[]> {
  const lists = await Promise.all(
    VENUE_TAGS[budget].map(async (v) => {
      const r = await qloo<InsightsResponse>("/v2/insights", {
        "filter.type": "urn:entity:place",
        "signal.interests.entities": subjectId,
        "filter.tags": v.tag,
        "filter.location": point(lat, lng),
        "filter.location.radius": 25000,
        take,
      }).catch(() => ({ results: { entities: [] } }) as InsightsResponse);
      return (r.results?.entities ?? []).map((e): VenueHit => ({
        name: e.name,
        category: v.category,
        size: v.size,
        fit: Math.round((e.query?.affinity ?? 0) * 100),
        popularity: Math.round((e.popularity ?? 0) * 100),
      }));
    }),
  );
  const seen = new Set<string>();
  return lists
    .flat()
    .sort((a, b) => b.fit - a.fit)
    .filter((v) => {
      const k = v.name.toLowerCase().replace(/^the\s+/, "");
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 6);
}

export async function heatCells(subjectId: string, lat: number, lng: number, take = 12) {
  const r = await qloo<InsightsResponse>("/v2/insights", {
    "filter.type": "urn:heatmap",
    "signal.interests.entities": subjectId,
    "filter.location": point(lat, lng),
    "filter.location.radius": 15000,
    take,
  });
  return (r.results?.heatmap ?? []).map((c) => ({
    lat: c.location.latitude,
    lng: c.location.longitude,
    weight: c.query?.affinity ?? 0.5,
  }));
}


