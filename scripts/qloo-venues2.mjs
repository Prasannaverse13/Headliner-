const base = (process.env.QLOO_BASE_URL || "").replace(/\/+$/, "");
const key = process.env.QLOO_API_KEY;
async function get(path, params) {
  const res = await fetch(`${base}${path}?${new URLSearchParams(params)}`, { headers: { "X-Api-Key": key } });
  const t = await res.text(); let j; try { j = JSON.parse(t); } catch { j = t.slice(0, 300); }
  return { status: res.status, json: j };
}
const id = "B6FA456F-B729-4700-B01F-E82AD3AC8ADA";
const found = {};
for (const q of ["stadium", "arena", "concert hall", "music venue", "performing arts", "theater", "amphitheater", "live music", "nightclub", "event venue"]) {
  const t = await get("/v2/tags", { "filter.query": q, "filter.parents.types": "urn:entity:place", take: "6" });
  const tags = (t.json?.results?.tags ?? []).map((x) => x.id ?? x.tag_id ?? x.value);
  found[q] = tags;
  console.log(`tags "${q}":`, t.status, JSON.stringify(tags));
}
console.log("\nraw tag shape:", JSON.stringify((await get("/v2/tags", { "filter.query": "stadium", "filter.parents.types": "urn:entity:place", take: "1" })).json).slice(0, 400));

// places near London for candidate venue tags
const cands = Object.values(found).flat().filter((t) => /stadium|arena|concert|music_venue|performing|theat|amphi|live_music|event/.test(t));
for (const tag of [...new Set(cands)].slice(0, 10)) {
  const r = await get("/v2/insights", { "filter.type": "urn:entity:place", "signal.interests.entities": id, "filter.tags": tag, "filter.location": "POINT(-0.13 51.51)", "filter.location.radius": 25000, take: "5" });
  console.log(`\nLondon ${tag}: HTTP ${r.status}`, (r.json?.results?.entities ?? []).map((e) => `${e.name} (aff ${e.query?.affinity?.toFixed(2)}, pop ${e.popularity?.toFixed(2)})`).join(" | "));
}
