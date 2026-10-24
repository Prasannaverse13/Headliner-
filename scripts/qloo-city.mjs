const base = (process.env.QLOO_BASE_URL || "").replace(/\/+$/, "");
const key = process.env.QLOO_API_KEY;
async function get(path, params) {
  const res = await fetch(`${base}${path}?${new URLSearchParams(params)}`, { headers: { "X-Api-Key": key } });
  const t = await res.text(); let j; try { j = JSON.parse(t); } catch { j = t.slice(0, 300); }
  return { status: res.status, json: j };
}
const id = "B6FA456F-B729-4700-B01F-E82AD3AC8ADA"; // Coldplay
const sig = { "signal.interests.entities": id };

// 1. heatmap by city name
let r = await get("/v2/insights", { ...sig, "filter.type": "urn:heatmap", "filter.location.query": "Chicago", take: "5" });
console.log("heatmap Chicago:", r.status, JSON.stringify(r.json).slice(0, 700));

// 2. city fit via places near point, mean affinity
for (const [name, lat, lng] of [["Chicago",41.88,-87.63],["Lagos",6.52,3.38],["Tokyo",35.68,139.65],["Mumbai",19.08,72.88]]) {
  const p = await get("/v2/insights", { ...sig, "filter.type": "urn:entity:place", "filter.location": `POINT(${lng} ${lat})`, "filter.location.radius": "15000", take: "10" });
  const e = p.json?.results?.entities ?? [];
  const mean = e.length ? e.reduce((a, x) => a + (x.query?.affinity ?? 0), 0) / e.length : null;
  console.log(`places ${name}: HTTP ${p.status}, n=${e.length}, meanAffinity=${mean?.toFixed(3)}`);
}

// 3. tags for restaurants / bars
for (const q of ["restaurant", "bar", "nightclub", "cocktail"]) {
  const t = await get("/v2/tags", { "filter.query": q, "filter.parents.types": "urn:entity:place", take: "4" });
  console.log(`tags "${q}":`, t.status, JSON.stringify((t.json?.results?.tags ?? []).map((x) => x.tag_id ?? x.id)).slice(0, 300));
}

// 4. audiences list
const a = await get("/v2/audiences", { take: "5" });
console.log("audiences:", a.status, JSON.stringify(a.json).slice(0, 400));
