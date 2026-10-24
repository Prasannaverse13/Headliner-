const base = (process.env.QLOO_BASE_URL || "").replace(/\/+$/, "");
const key = process.env.QLOO_API_KEY;
async function get(path, params) {
  const res = await fetch(`${base}${path}?${new URLSearchParams(params)}`, { headers: { "X-Api-Key": key } });
  const t = await res.text(); let j; try { j = JSON.parse(t); } catch { j = t.slice(0, 300); }
  return { status: res.status, json: j };
}
const id = "B6FA456F-B729-4700-B01F-E82AD3AC8ADA"; // Coldplay

// 1. venue tags
for (const q of ["stadium", "arena", "concert hall", "music venue", "theater", "amphitheater", "live music"]) {
  const t = await get("/v2/tags", { "filter.query": q, "filter.parents.types": "urn:entity:place", take: "5" });
  console.log(`tags "${q}":`, t.status, JSON.stringify((t.json?.results?.tags ?? []).map((x) => x.tag_id)));
}

// 2. entity detail (what properties exist for an artist)
const e = await get("/entities", { entity_ids: id });
console.log("\nentities:", e.status, JSON.stringify(e.json).slice(0, 1800));

// 3. heatmap fields
const h = await get("/v2/insights", { "filter.type": "urn:heatmap", "signal.interests.entities": id, "filter.location": "POINT(-0.13 51.51)", "filter.location.radius": 15000, take: "3" });
console.log("\nheatmap sample:", JSON.stringify(h.json?.results?.heatmap?.[0]));
