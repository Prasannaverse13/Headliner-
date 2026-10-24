import { promises as fs } from "node:fs";
import path from "node:path";
import type { PlanEvent, PlanOptions } from "./types";

/*
 * Server-side cache of finished plans, so demo artists load instantly and Qloo is not hit twice.
 * Qloo's terms allow private server caching but not publishing its data, so this lives outside the repo:
 *   - Upstash Redis (REST) when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set (survives serverless cold starts),
 *   - otherwise a local file cache (.cache/plans, or /tmp on Vercel), plus a small in-memory map.
 */

const TTL_SECONDS = 7 * 24 * 60 * 60;
const memory = new Map<string, { t: number; events: PlanEvent[] }>();

export type CachedPlan = { savedAt: string; events: PlanEvent[] };

export const planKey = (artist: string, o: PlanOptions) =>
  `headliner:plan:v2:${artist.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}:${o.stops}:${o.region}:${o.budget}`;

const redis = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
};

async function redisCmd(r: { url: string; token: string }, cmd: (string | number)[]) {
  const res = await fetch(r.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${r.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis ${res.status}`);
  return ((await res.json()) as { result?: unknown }).result;
}

const dir = () => (process.env.VERCEL ? "/tmp/headliner-plans" : path.join(process.cwd(), ".cache", "plans"));
const file = (key: string) => path.join(dir(), `${key.replace(/[^a-z0-9._-]+/gi, "_")}.json`);

export async function getPlan(key: string): Promise<CachedPlan | null> {
  try {
    const r = redis();
    if (r) {
      const raw = await redisCmd(r, ["GET", key]);
      return typeof raw === "string" ? (JSON.parse(raw) as CachedPlan) : null;
    }
    const m = memory.get(key);
    if (m && Date.now() - m.t < TTL_SECONDS * 1000) return { savedAt: new Date(m.t).toISOString(), events: m.events };
    const raw = await fs.readFile(file(key), "utf8");
    const p = JSON.parse(raw) as CachedPlan;
    if (Date.now() - new Date(p.savedAt).getTime() > TTL_SECONDS * 1000) return null;
    memory.set(key, { t: new Date(p.savedAt).getTime(), events: p.events });
    return p;
  } catch {
    return null;
  }
}

export async function savePlan(key: string, events: PlanEvent[]): Promise<void> {
  const plan: CachedPlan = { savedAt: new Date().toISOString(), events };
  try {
    const r = redis();
    if (r) {
      await redisCmd(r, ["SET", key, JSON.stringify(plan), "EX", TTL_SECONDS]);
      return;
    }
    memory.set(key, { t: Date.now(), events });
    await fs.mkdir(dir(), { recursive: true });
    await fs.writeFile(file(key), JSON.stringify(plan));
  } catch {
    /* A cache write must never break a plan. */
  }
}
