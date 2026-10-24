// Run: node --env-file=.env.local scripts/qloo-insights.mjs "Coldplay"
const base = (process.env.QLOO_BASE_URL || "").replace(/\/+$/, "");
const key = process.env.QLOO_API_KEY;
const artist = process.argv[2] || "Coldplay";

async function get(path, params) {
  const url = `${base}${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: { "X-Api-Key": key } });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text.slice(0, 300); }
  return { status: res.status, json };
}
const show = (label, r, pick) => {
  const ents = r.json?.results?.entities ?? [];
  console.log(`\n== ${label} -> HTTP ${r.status}, ${ents.length} entities`);
  if (!ents.length) console.log(JSON.stringify(r.json).slice(0, 400));
  ents.slice(0, 6).forEach((e) => console.log(" -", pick(e)));
  return ents;
};
const nm = (e) => `${e.name} | affinity=${e.query?.affinity ?? "-"} | pop=${e.popularity ?? "-"}`;

const s = await get("/search", { query: artist, types: "urn:entity:artist", take: "1" });
const id = s.json?.results?.[0]?.entity_id;
console.log("artist:", s.json?.results?.[0]?.name, id);
console.log("tags:", (s.json?.results?.[0]?.tags ?? []).map((t) => t.name).slice(0, 8).join(", "));

const base_ = { "signal.interests.entities": id };

const openers = show("related artists (openers)", await get("/v2/insights", { ...base_, "filter.type": "urn:entity:artist", take: "6" }), nm);
show("brands (sponsors)", await get("/v2/insights", { ...base_, "filter.type": "urn:entity:brand", take: "6" }), nm);
show("podcasts", await get("/v2/insights", { ...base_, "filter.type": "urn:entity:podcast", take: "4" }), nm);
show("movies", await get("/v2/insights", { ...base_, "filter.type": "urn:entity:movie", take: "4" }), nm);
const dest = show("destinations (demand cities)", await get("/v2/insights", { ...base_, "filter.type": "urn:entity:destination", take: "10" }),
  (e) => `${nm(e)} | ${JSON.stringify(e.properties?.geocode ?? e.location ?? "").slice(0, 120)}`);
if (dest[0]) console.log("destination sample keys:", Object.keys(dest[0]).join(","), "| props:", Object.keys(dest[0].properties ?? {}).join(","));
show("places in London (VIP)", await get("/v2/insights", { ...base_, "filter.type": "urn:entity:place", "filter.geocode.name": "London", take: "6" }), nm);
show("places near Chicago via filter.location", await get("/v2/insights", { ...base_, "filter.type": "urn:entity:place", "filter.location": "POINT(-87.63 41.88)", "filter.location.radius": "10000", take: "6" }), nm);
