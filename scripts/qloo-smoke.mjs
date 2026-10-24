// Run: node --env-file=.env.local scripts/qloo-smoke.mjs
const base = (process.env.QLOO_BASE_URL || "").replace(/\/+$/, "");
const key = process.env.QLOO_API_KEY;
console.log("base:", base);

async function get(path, params) {
  const url = `${base}${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: { "X-Api-Key": key } });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text.slice(0, 300); }
  return { status: res.status, json };
}

const s = await get("/search", { query: "Coldplay", types: "urn:entity:artist", take: "3" });
console.log("search status:", s.status);
console.log(JSON.stringify(s.json, null, 1).slice(0, 1500));
