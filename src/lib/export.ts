import { haversine } from "./route";
import type { Stop } from "./types";
import type { Scheduled } from "./route";

export type Row = Scheduled<Stop>;

const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
const ymd = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function toCsv(rows: Row[]): string {
  const head = ["Order", "Date", "City", "Country", "Venue", "Demand", "Opener", "Opener overlap %", "Sponsors", "VIP picks", "Km from previous", "Top venues", "Lead with", "Ad copy"];
  const lines = rows.map((r, i) =>
    [
      i + 1,
      iso(r.date),
      r.city,
      r.country,
      r.venueType,
      r.demand,
      r.opener.name,
      r.opener.overlap,
      r.sponsors.map((s) => s.name).join("; "),
      r.vip.map((v) => `${v.kind}: ${v.name}`).join("; "),
      r.leg ? Math.round(r.leg.km) : 0,
      (r.venues ?? []).slice(0, 3).map((v) => `${v.name} (${v.category})`).join("; "),
      (r.focus ?? []).join("; "),
      r.adCopy,
    ].map(q).join(","),
  );
  return [head.map(q).join(","), ...lines].join("\r\n");
}

export function toIcs(artist: string, rows: Row[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ev = rows.map((r, i) => {
    const next = new Date(r.date);
    next.setDate(next.getDate() + 1);
    return [
      "BEGIN:VEVENT",
      `UID:headliner-${i}-${r.id}-${ymd(r.date)}@headliner`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(r.date)}`,
      `DTEND;VALUE=DATE:${ymd(next)}`,
      `SUMMARY:${artist} live in ${r.city}`,
      `LOCATION:${r.city}\\, ${r.country}`,
      `DESCRIPTION:${r.venueType}. Opener: ${r.opener.name}. Demand score ${r.demand}.${r.venues?.length ? ` Venue ideas: ${r.venues.slice(0, 3).map((v) => v.name).join(", ")}.` : ""}`,
      "END:VEVENT",
    ].join("\r\n");
  });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Headliner//Tour plan//EN", ...ev, "END:VCALENDAR"].join("\r\n");
}

export function toJson(artist: string, rows: Row[]): string {
  return JSON.stringify(
    {
      artist,
      generatedBy: "Headliner",
      stops: rows.map((r, i) => ({
        order: i + 1,
        date: iso(r.date),
        city: r.city,
        country: r.country,
        lat: r.lat,
        lng: r.lng,
        venue: r.venueType,
        demand: r.demand,
        opener: r.opener,
        sponsors: r.sponsors,
        vip: r.vip,
        adCopy: r.adCopy,
        why: r.why,
        kmFromPrevious: r.leg ? Math.round(r.leg.km) : 0,
        venues: r.venues ?? [],
        leadWith: r.focus ?? [],
      })),
    },
    null,
    2,
  );
}

export function download(filename: string, mime: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const safeName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tour";
export { haversine };
