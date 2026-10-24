import { WORLD_CITIES, cityId, type WorldCity } from "./cities";
import { llmJson } from "./llm";
import { TAGS, cityFit, findSubject, heatCells, placesByTag, related, venuesNear, type QlooEntity, type Subject } from "./qloo";
import { SUPPORT_ROLE, type About, type KnownFor, type Market, type PlanEvent, type PlanOptions, type Stop, type SubjectKind } from "./types";

const pct = (n: number | undefined) => Math.round((n ?? 0) * 100);
const VENUES = { club: "Club, 800 cap", theatre: "Theatre, 3,000 cap", arena: "Arena, 15,000 cap" } as const;

async function pool<T, R>(items: T[], size: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

type Enrichment = {
  opener?: string;
  sponsors?: { name: string; why: string }[];
  adCopy?: string;
  why?: string;
  focus?: string[];
  venues?: { name: string; concerts?: string; note?: string }[];
};

const SYSTEM = `You help tour promoters. You get real taste data from Qloo for one act and one city.
Choose: one support slot from "openers" (the act's opener, or for a sports team a friendly opponent, for a podcast a guest show,
for a brand a co-headline partner; see "supportRole"). Keep "defaultOpener" unless another is clearly a better fit for the city,
three sponsors from "brands" with a short reason each (max 12 words) tied to that city, one short ad line
(max 25 words, mention the city and the act, no hashtags) and a one or two sentence "why" that uses the supplied
local places and taste tags. Also choose "focus": two or three titles from "knownFor" (copy them exactly) that fit
what fans here lean toward. For each venue in "venues" say whether it regularly hosts concerts: "yes", "no" (for
example a sports training ground) or "unsure"; add a note of at most 8 words only if you are sure. Only use names that
appear in the input. Never invent statistics.
Return JSON: {"opener","sponsors":[{"name","why"}],"adCopy","why","focus":["title"],"venues":[{"name","concerts","note"}]}.`;

type Ctx = {
  subject: Subject;
  tags: string[];
  openers: QlooEntity[];
  brands: QlooEntity[];
  venue: string;
  budget: Size;
  /** Filled in once the model has listed what the act is known for. */
  knownFor: KnownFor[];
};

type Size = "club" | "theatre" | "arena";

/** Pick a show size when the user left it on Auto. */
function resolveBudget(b: PlanOptions["budget"], subject: Subject): Size {
  if (b !== "auto") return b;
  if (subject.kind === "podcast") return "theatre";
  if (subject.kind === "team") return "arena";
  if (subject.type === "urn:entity:person") return "theatre";
  return subject.popularity > 0.9 ? "arena" : "theatre";
}

async function loadCtx(subject: Subject, requested: PlanOptions["budget"]): Promise<Ctx> {
  const budget = resolveBudget(requested, subject);
  const notSelf = (list: QlooEntity[]) => list.filter((e) => e.entity_id !== subject.id);
  const [openers, brands] = await Promise.all([
    related(subject.id, subject.type, 11).then(notSelf),
    related(subject.id, "urn:entity:brand", 11).then(notSelf),
  ]);
  const tags = [...subject.tags]
    .sort((a, b) => Number(/genre/.test(b.type ?? "")) - Number(/genre/.test(a.type ?? "")))
    .map((t) => t.name)
    .slice(0, 6);
  return { subject, tags, openers, brands, venue: VENUES[budget], budget, knownFor: [] };
}


const KNOWN_SYSTEM = `You are an entertainment and sports researcher. Given an act, team, podcast or brand, list up to 6 things that made it famous:
songs or albums for musicians; specials, shows or films for comedians and actors; championships, iconic seasons or stadium moments for sports teams;
famous episodes or guests for podcasts. Only include things you are sure exist and that belong to it. If unsure, return fewer. "kind" is one of: song, album, show, special, film, title, season, episode, other.
"note" is at most 8 words on why it mattered. "year" is the release year as text. Return JSON: {"items":[{"title","kind","year","note"}]}.`;

const knownCache = new Map<string, Promise<KnownFor[]>>();

/** What the act is known for, from the model's knowledge (not from Qloo). Never throws. */
function loadKnownFor(subject: Subject, tags: string[]): Promise<KnownFor[]> {
  const hit = knownCache.get(subject.id);
  if (hit) return hit;
  const p = llmJson<{ items?: KnownFor[] }>(KNOWN_SYSTEM, { act: subject.name, about: subject.description, tags }, 30000)
    .then((r) =>
      (r.items ?? [])
        .filter((k) => k && typeof k.title === "string" && k.title.trim())
        .slice(0, 6)
        .map((k) => ({ title: k.title.trim(), kind: String(k.kind || "other").toLowerCase(), year: k.year ? String(k.year) : undefined, note: k.note })),
    )
    .catch(() => [] as KnownFor[]);
  knownCache.set(subject.id, p);
  return p;
}

/** The Qloo side of the artist profile: description, photo, Last.fm reach and what fans also love. */
async function loadAbout(ctx: Ctx): Promise<About> {
  const { subject } = ctx;
  const names = (p: Promise<QlooEntity[]>) => p.then((r) => r.map((e) => e.name)).catch(() => [] as string[]);
  const [movies, shows, podcasts] = await Promise.all([
    names(related(subject.id, "urn:entity:movie", 4)),
    names(related(subject.id, "urn:entity:tv_show", 4)),
    names(related(subject.id, "urn:entity:podcast", 3)),
  ]);
  return {
    description: subject.description,
    image: subject.image,
    lastfm: subject.lastfm,
    fansAlsoLove: { movies, shows, podcasts, brands: ctx.brands.slice(0, 5).map((b) => b.name) },
  };
}
/** Venues for the chosen show size. If the city has none, fall back to the nearest other sizes. */
async function venuesInSize(subjectId: string, c: WorldCity, budget: Size) {
  const order: Size[] = { club: ["club", "theatre", "arena"], theatre: ["theatre", "club", "arena"], arena: ["arena", "theatre", "club"] }[budget] as Size[];
  for (const b of order) {
    const v = await venuesNear(subjectId, c.lat, c.lng, b).catch(() => []);
    if (v.length) return v;
  }
  return [];
}

/** Qloo-only stop, ready to draw. The model fills in copy afterwards. */
async function buildStop(ctx: Ctx, c: WorldCity, demand: number, places: string[], i: number): Promise<Stop> {
  const { subject, openers, brands } = ctx;
  const [food, bars, clubs, heat, venues] = await Promise.all([
    placesByTag(subject.id, c.lat, c.lng, TAGS.restaurant).catch(() => []),
    placesByTag(subject.id, c.lat, c.lng, TAGS.bar).catch(() => []),
    placesByTag(subject.id, c.lat, c.lng, TAGS.nightclub, 1).catch(() => []),
    heatCells(subject.id, c.lat, c.lng, 8).catch(() => []),
    venuesInSize(subject.id, c, ctx.budget),
  ]);
  const opener = openers[i % Math.max(openers.length, 1)];
  return {
    id: cityId(c.city),
    city: c.city,
    country: c.country,
    lat: c.lat,
    lng: c.lng,
    region: c.region,
    venueType: ctx.venue,
    demand,
    opener: { name: opener?.name ?? "Local support act", overlap: pct(opener?.query?.affinity) },
    sponsors: brands.slice(0, 3).map((b) => ({ name: b.name, why: `${pct(b.query?.affinity)}% fan affinity` })),
    // The same place can be tagged as a restaurant and a bar, so keep the first mention only.
    vip: [
      ...food.map((n) => ({ name: n, kind: "Food" })),
      ...bars.map((n) => ({ name: n, kind: "Bar" })),
      ...clubs.map((n) => ({ name: n, kind: "Nightlife" })),
    ]
      .filter((v, i, all) => all.findIndex((x) => x.name === v.name) === i)
      .slice(0, 5),
    venues,
    adCopy: "",
    why: `Places in ${c.city} that fans of ${subject.name} rank highly include ${places.join(", ") || "local favourites"}.`,
    heat,
    pending: true,
  };
}

/** One small model call for one city, grounded in the Qloo data. Never throws. */
async function enrichStop(ctx: Ctx, stop: Stop, places: string[]): Promise<{ id: string; patch: Partial<Stop> }> {
  const { subject, openers, brands } = ctx;
  const fallback = { pending: false, adCopy: `${stop.city}, ${subject.name} is coming. Be there.` };
  try {
    const e = await llmJson<Enrichment>(SYSTEM, {
      act: subject.name,
      tasteTags: ctx.tags,
      openers: openers.slice(0, 6).map((o) => ({ name: o.name, affinity: pct(o.query?.affinity) })),
      supportRole: SUPPORT_ROLE[subject.kind],
      defaultOpener: stop.opener.name,
      brands: brands.map((b) => ({ name: b.name, affinity: pct(b.query?.affinity) })),
      city: stop.city,
      country: stop.country,
      demand: stop.demand,
      localPlaces: places,
      vipPicks: stop.vip.map((v) => `${v.kind}: ${v.name}`),
      knownFor: ctx.knownFor.map((k) => k.title),
      venues: (stop.venues ?? []).map((v) => v.name),
    });
    const patch: Partial<Stop> = { pending: false };
    const o = e.opener ? openers.find((x) => x.name.toLowerCase() === e.opener!.toLowerCase()) : undefined;
    if (o) patch.opener = { name: o.name, overlap: pct(o.query?.affinity) };
    const sp = (e.sponsors ?? [])
      .map((s) => ({ s, b: brands.find((x) => x.name.toLowerCase() === s.name?.toLowerCase()) }))
      .filter((x) => x.b)
      .slice(0, 3)
      .map((x) => ({ name: x.b!.name, why: x.s.why }));
    if (sp.length) patch.sponsors = sp;
    patch.adCopy = e.adCopy || fallback.adCopy;
    if (e.why) patch.why = e.why;
    const titles = new Set(ctx.knownFor.map((k) => k.title.toLowerCase()));
    const focus = (e.focus ?? []).filter((t) => titles.has(String(t).toLowerCase())).slice(0, 3);
    if (focus.length) patch.focus = focus;
    if (stop.venues?.length && e.venues?.length) {
      const verdict = new Map(e.venues.map((v) => [String(v.name).toLowerCase(), v]));
      const checked = stop.venues
        .map((v) => {
          const j = verdict.get(v.name.toLowerCase());
          const concerts: "yes" | "no" | "unsure" = j?.concerts === "yes" ? "yes" : j?.concerts === "no" ? "no" : "unsure";
          return { ...v, concerts, note: concerts !== "no" && j?.note ? String(j.note) : undefined };
        })
        .filter((v): v is typeof v & { concerts: "yes" | "unsure" } => v.concerts !== "no")
        .sort((a, b) => Number(b.concerts === "yes") - Number(a.concerts === "yes") || b.fit - a.fit);
      // When at least two venues are confirmed concert venues, drop the unverified ones (often pubs or restaurants).
      const confirmed = checked.filter((v) => v.concerts === "yes");
      if (confirmed.length >= 2) checked.splice(0, checked.length, ...confirmed);
      // If the model rejected every venue, keep Qloo's list rather than showing none.
      if (checked.length) patch.venues = checked;
    }
    return { id: stop.id, patch };
  } catch {
    return { id: stop.id, patch: fallback };
  }
}

/**
 * Pick the best cities. On a worldwide tour every region with data gets a share first
 * (the best city of each region, then a second round when the tour is long enough),
 * and the rest are filled by score with a cap per region, so the route spans the globe.
 */
function pickBalanced<T extends { c: WorldCity; mean: number }>(sorted: T[], n: number, world: boolean): T[] {
  if (!world) return sorted.slice(0, n);
  const byRegion = new Map<string, T[]>();
  for (const x of sorted) byRegion.set(x.c.region, [...(byRegion.get(x.c.region) ?? []), x]);
  const regions = [...byRegion.values()].sort((a, b) => b[0].mean - a[0].mean);

  const picked: T[] = [];
  const rounds = Math.max(1, Math.floor(n / regions.length));
  for (let r = 0; r < rounds; r++) {
    for (const list of regions) {
      if (picked.length >= n) break;
      if (list[r]) picked.push(list[r]);
    }
  }
  const cap = Math.max(rounds + 1, Math.ceil(n * 0.3));
  const count = new Map<string, number>();
  picked.forEach((x) => count.set(x.c.region, (count.get(x.c.region) ?? 0) + 1));
  for (const x of sorted) {
    if (picked.length >= n) break;
    if (picked.includes(x) || (count.get(x.c.region) ?? 0) >= cap) continue;
    count.set(x.c.region, (count.get(x.c.region) ?? 0) + 1);
    picked.push(x);
  }
  for (const x of sorted) {
    if (picked.length >= n) break;
    if (!picked.includes(x)) picked.push(x);
  }
  return picked.sort((a, b) => b.mean - a.mean);
}

export async function* runPlan(artist: string, opts: PlanOptions): AsyncGenerator<PlanEvent> {
  yield { type: "step", label: `Finding ${artist} in the taste graph` };

  // Home market: ask the model for the nearest city while Qloo resolves the name. A miss falls back to a default.
  const homePromise = llmJson<{ city: string; lat: number; lng: number }>(
    "Return JSON {city, lat, lng} for the home city or main base of the given act, team, podcast or brand. Use real coordinates.",
    { act: artist },
    15000,
  ).catch(() => null);

  const subject = await findSubject(artist);
  if (!subject) throw new Error(`No Qloo match for "${artist}"`);

  yield { type: "step", label: "Reading fan taste across music, film, food and fashion" };
  const [ctx, home] = await Promise.all([loadCtx(subject, opts.budget), homePromise]);
  // These run while the city scan below is in flight, so they cost no extra waiting.
  const aboutPromise = loadAbout(ctx);
  const knownPromise = loadKnownFor(subject, ctx.tags);

  yield {
    type: "profile",
    plan: {
      artist: subject.name,
      tags: ctx.tags,
      kind: subject.kind,
      source: "live",
      home: home && Number.isFinite(home.lat) && Number.isFinite(home.lng) ? home : { city: "Los Angeles", lat: 34.05, lng: -118.24 },
    },
  };

  // Score every candidate city by how well its places match the fans.
  const candidates = WORLD_CITIES.filter((c) => opts.region === "world" || c.region === opts.region);
  const regionCount = new Set(candidates.map((c) => c.region)).size;
  yield { type: "step", label: `Scanning ${candidates.length} cities across ${regionCount} ${regionCount === 1 ? "region" : "regions"}` };
  const fits = await pool(candidates, 24, async (c) => ({ c, fit: await cityFit(subject.id, c.lat, c.lng).catch(() => null) }));
  const scored = fits
    .filter((x) => x.fit && x.fit.mean > 0)
    .map((x) => ({ c: x.c, mean: x.fit!.mean, places: x.fit!.places }))
    .sort((a, b) => b.mean - a.mean);
  if (!scored.length) throw new Error("Qloo returned no city data for this act");

  const lo = scored[scored.length - 1].mean;
  const hi = scored[0].mean;
  const demandOf = (m: number) => Math.round(50 + (49 * (m - lo)) / (hi - lo || 1));

  const markets: Market[] = scored.map((x) => ({
    id: cityId(x.c.city),
    city: x.c.city,
    country: x.c.country,
    lat: x.c.lat,
    lng: x.c.lng,
    region: x.c.region,
    demand: demandOf(x.mean),
  }));
  yield { type: "markets", markets };
  yield { type: "about", about: await aboutPromise };

  const chosen = pickBalanced(scored, opts.stops, opts.region === "world");
  yield { type: "step", label: `Picked ${chosen.length} stops. Matching openers by audience overlap` };

  // Build each stop from Qloo data first so the globe can draw right away.
  const stops = await pool(chosen, 20, (x, i) => buildStop(ctx, x.c, demandOf(x.mean), x.places, i));
  for (const stop of stops) {
    yield { type: "step", label: `Added ${stop.city}, demand ${stop.demand}` };
    yield { type: "stop", stop };
  }

  // One small model call per city, run in parallel. Each stop updates as soon as its call finishes.
  ctx.knownFor = await knownPromise;
  if (ctx.knownFor.length) yield { type: "about", about: { knownFor: ctx.knownFor } };
  yield { type: "step", label: "Matching sponsors and writing city copy" };
  const queue = stops.map((s, i) => ({ s, i }));
  const inflight = new Map<number, Promise<{ k: number; r: { id: string; patch: Partial<Stop> } }>>();
  const launch = () => {
    while (inflight.size < 12 && queue.length) {
      const { s, i } = queue.shift()!;
      inflight.set(i, enrichStop(ctx, s, chosen[i].places).then((r) => ({ k: i, r })));
    }
  };
  launch();
  while (inflight.size) {
    const { k, r } = await Promise.race(inflight.values());
    inflight.delete(k);
    yield { type: "stopUpdate", id: r.id, patch: r.patch };
    launch();
  }
  yield { type: "done" };
}

/** Build one extra stop on request, for the "add to tour" button. */
export async function addStop(artist: string, city: string, demand: number, budget: PlanOptions["budget"]): Promise<Stop> {
  const c = WORLD_CITIES.find((x) => cityId(x.city) === cityId(city));
  if (!c) throw new Error(`Unknown city "${city}"`);
  const subject = await findSubject(artist);
  if (!subject) throw new Error(`No Qloo match for "${artist}"`);
  const [ctx, fit] = await Promise.all([loadCtx(subject, budget), cityFit(subject.id, c.lat, c.lng)]);
  ctx.knownFor = await loadKnownFor(subject, ctx.tags);
  const stop = await buildStop(ctx, c, demand, fit.places, cityId(c.city).length);
  const { patch } = await enrichStop(ctx, stop, fit.places);
  return { ...stop, ...patch };
}




