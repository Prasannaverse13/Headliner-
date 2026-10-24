const base = (process.env.QLOO_BASE_URL || "").replace(/\/+$/, "");
const key = process.env.QLOO_API_KEY;
async function s(query, type) {
  const r = await fetch(`${base}/search?${new URLSearchParams({ query, types: type, take: "3" })}`, { headers: { "X-Api-Key": key } });
  const j = await r.json().catch(() => ({}));
  return (j.results ?? []).map((e) => `${e.name} (pop ${e.popularity?.toFixed(2)})`).join(" | ") || "-";
}
const tests = [
  ["Anirudh Ravichander", ["artist", "person"]],
  ["Anirudh", ["artist", "person"]],
  ["A. R. Rahman", ["artist", "person"]],
  ["AR Rahman", ["artist", "person"]],
  ["Cedric the Entertainer", ["person", "artist"]],
  ["Chelsea FC", ["brand", "place"]],
  ["Los Angeles Dodgers", ["brand", "place"]],
  ["This Week in Startups", ["podcast"]],
  ["Live Nation", ["brand"]],
];
for (const [q, types] of tests) for (const t of types) console.log(`${q} [${t}]:`, await s(q, `urn:entity:${t}`));
