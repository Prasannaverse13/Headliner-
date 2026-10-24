import type { Region } from "./cities";

export type Sponsor = { name: string; why: string };
export type VipPick = { name: string; kind: string };

export type Venue = {
  name: string;
  category: string;
  /** Typical capacity range for the category. Not a measured number. */
  size: string;
  /** How well the venue matches the act's fans, 0 to 100 (Qloo). */
  fit: number;
  popularity: number;
  /** Does the venue regularly host concerts? Checked by the model, so treat "unsure" as unverified. */
  concerts?: "yes" | "unsure";
  note?: string;
};

/** What the act is known for. Written by the model from its own knowledge, so it is labelled as AI-written. */
export type KnownFor = { title: string; kind: string; year?: string; note?: string };

export type About = {
  description?: string;
  image?: string | null;
  /** Global reach figures from Last.fm via Qloo. */
  lastfm?: { listeners?: number; scrobbles?: number } | null;
  knownFor?: KnownFor[];
  /** Real Qloo taste neighbours: what the act's fans also love. */
  fansAlsoLove?: { movies: string[]; shows: string[]; podcasts: string[]; brands: string[] };
};

export type Stop = {
  id: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  region?: Region;
  venueType: string;
  demand: number; // 0-100 taste demand score
  opener: { name: string; overlap: number };
  sponsors: Sponsor[];
  vip: VipPick[];
  adCopy: string;
  why: string;
  /** Real venues near the city that suit the show size, from Qloo. */
  venues?: Venue[];
  /** Songs, shows or specials to lead with in this city, chosen from the act's known-for list. */
  focus?: string[];
  /** Real Qloo heatmap cells around the city, used for the heat layer. */
  heat?: { lat: number; lng: number; weight: number }[];
  /** True until the language model has written the copy and reasons. */
  pending?: boolean;
};

/** A scored city that is not (yet) on the tour. */
export type Market = {
  id: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  region: Region;
  demand: number;
};

export type Plan = {
  artist: string;
  home: { city: string; lat: number; lng: number };
  tags: string[];
  stops: Stop[];
  source: "sample" | "live";
};

export type PlanOptions = {
  stops: 5 | 10 | 20;
  region: "world" | Region;
  budget: "club" | "theatre" | "arena";
};

export type PlanEvent =
  | { type: "step"; label: string }
  | { type: "profile"; plan: Pick<Plan, "artist" | "home" | "tags" | "source"> & { cachedAt?: string } }
  | { type: "about"; about: About }
  | { type: "markets"; markets: Market[] }
  | { type: "stop"; stop: Stop }
  | { type: "stopUpdate"; id: string; patch: Partial<Stop> }
  | { type: "error"; message: string }
  | { type: "done" };

