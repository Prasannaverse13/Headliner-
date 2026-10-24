// Pre-warm the demo artists so judges get an instant plan.
// Usage: node scripts/warm.mjs [baseUrl] [--fresh]
//   node scripts/warm.mjs                          warm http://localhost:3000
//   node scripts/warm.mjs https://your-app.vercel.app
// Cached plans are stored server-side (Upstash Redis if configured, else .cache/plans). Never commit them.
const base = (process.argv.find((a) => a.startsWith("http")) || "http://localhost:3000").replace(/\/+$/, "");
const fresh = process.argv.includes("--fresh");
const ARTISTS = ["Coldplay", "Kendrick Lamar", "Bad Bunny", "A. R. Rahman", "Anirudh Ravichander", "Arijit Singh", "Dave Chappelle", "Cedric the Entertainer", "Chelsea F.C.", "Los Angeles Dodgers", "This Week in Startups"];
const VARIANTS = [{ stops: 10, region: "world", budget: "auto" }];

for (const artist of ARTISTS) {
  for (const v of VARIANTS) {
    const t0 = Date.now();
    const qs = new URLSearchParams({ artist, stops: String(v.stops), region: v.region, budget: v.budget, ...(fresh ? { fresh: "1" } : {}) });
    try {
      const res = await fetch(`${base}/api/plan?${qs}`);
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader(), dec = new TextDecoder();
      let buf = "", stops = 0, err = null, done = false, cached = false;
      for (;;) {
        const { value, done: end } = await reader.read();
        if (end) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
          const e = JSON.parse(chunk.slice(6));
          if (e.type === "stop") stops++;
          if (e.type === "error") err = e.message;
          if (e.type === "done") done = true;
          if (e.type === "profile" && e.plan.cachedAt) cached = true;
        }
      }
      console.log(`${err ? "FAIL" : done ? "ok  " : "??  "} ${artist.padEnd(16)} ${stops} stops  ${((Date.now() - t0) / 1000).toFixed(1)}s ${cached ? "(from cache)" : "(fresh run, now saved)"}${err ? "  " + err : ""}`);
    } catch (e) {
      console.log(`FAIL ${artist}: ${e.message}`);
    }
  }
}
