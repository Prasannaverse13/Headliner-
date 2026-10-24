/* Route maths shared by the browser and the server. Pure functions, no I/O. */

export type Pt = { lat: number; lng: number };
export type RouteMode = "shortest" | "west-east" | "demand";

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversine(a: Pt, b: Pt): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

const pathLength = (pts: Pt[]) => pts.slice(1).reduce((n, p, i) => n + haversine(pts[i], p), 0);

/** Open-path shortest route: nearest neighbour from the start, then 2-opt until no swap helps. */
function shortest<T extends Pt>(items: T[], start: Pt): T[] {
  if (items.length < 3) return [...items].sort((a, b) => haversine(start, a) - haversine(start, b));
  const left = [...items];
  const order: T[] = [];
  let cur: Pt = start;
  while (left.length) {
    let bi = 0;
    for (let i = 1; i < left.length; i++) if (haversine(cur, left[i]) < haversine(cur, left[bi])) bi = i;
    const [next] = left.splice(bi, 1);
    order.push(next);
    cur = next;
  }
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 50) {
    improved = false;
    for (let i = 0; i < order.length - 1; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const cand = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
        if (pathLength([start, ...cand]) + 1e-6 < pathLength([start, ...order])) {
          order.splice(0, order.length, ...cand);
          improved = true;
        }
      }
    }
  }
  return order;
}

export function orderRoute<T extends Pt & { demand: number }>(items: T[], start: Pt | null, mode: RouteMode): T[] {
  if (mode === "demand") return [...items].sort((a, b) => b.demand - a.demand);
  if (mode === "west-east") return [...items].sort((a, b) => a.lng - b.lng);
  return shortest(items, start ?? items[0] ?? { lat: 0, lng: 0 });
}

export type Leg = { km: number; travelDays: number; mode: "drive" | "flight" };

/** Days of travel between shows: none for short drives, a rest day for long ones, more for long-haul flights. */
export function legInfo(km: number): Leg {
  if (km < 450) return { km, travelDays: 0, mode: "drive" };
  if (km < 2500) return { km, travelDays: 1, mode: "flight" };
  if (km < 8000) return { km, travelDays: 2, mode: "flight" };
  return { km, travelDays: 3, mode: "flight" };
}

export type Scheduled<T> = T & { date: Date; legFrom: string | null; leg: Leg | null };

/** Dates for each show: one show per stop, with travel days between them. The first show is on `start`. */
export function schedule<T extends Pt & { city: string }>(order: T[], start: Date): Scheduled<T>[] {
  const out: Scheduled<T>[] = [];
  let day = new Date(start);
  order.forEach((s, i) => {
    let leg: Leg | null = null;
    if (i > 0) {
      leg = legInfo(haversine(order[i - 1], s));
      day = new Date(day);
      day.setDate(day.getDate() + 1 + leg.travelDays);
    }
    out.push({ ...s, date: new Date(day), legFrom: i > 0 ? order[i - 1].city : null, leg });
  });
  return out;
}

export function totals<T extends Pt>(order: T[], home: Pt | null) {
  const pts = home ? [home, ...order] : order;
  const km = Math.round(pathLength(pts));
  return { km };
}

export const fmtKm = (km: number) => `${Math.round(km).toLocaleString("en-US")} km`;
