import { qloo, qlooConfigured, type QlooEntity } from "@/lib/qloo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Hit = { name: string; type: "artist" | "person" | "podcast" | "brand"; description: string; image: string | null; popularity: number };

/** Type-ahead over Qloo's catalogue: artists, bands, comedians and other public figures worldwide. */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return Response.json({ results: [] });
  if (!qlooConfigured()) return Response.json({ error: "Qloo is not configured" }, { status: 503 });

  const types = [
    ["urn:entity:artist", "artist"],
    ["urn:entity:person", "person"],
    ["urn:entity:podcast", "podcast"],
    ["urn:entity:brand", "brand"],
  ] as const;
  const lists = await Promise.all(
    types.map(([urn, kind]) =>
      qloo<{ results?: QlooEntity[] }>("/search", { query: q, types: urn, take: 5 })
        .then((r) => (r.results ?? []).map((e): Hit => ({
          name: e.name,
          type: kind,
          description: e.properties?.short_description ?? "",
          image: e.properties?.image?.url ?? null,
          popularity: e.popularity ?? 0,
        })))
        .catch(() => [] as Hit[]),
    ),
  );

  // Rank by how well the name matches what was typed, then by popularity. Drop names that do not
  // contain the query at all, unless that would leave nothing (typos).
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "");
  const nq = norm(q);
  const match = (h: Hit) => (norm(h.name) === nq ? 3 : norm(h.name).startsWith(nq) ? 2 : norm(h.name).includes(nq) ? 1 : 0);
  const seen = new Set<string>();
  const unique = lists.flat().filter((h) => {
    const k = h.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  // Brands (sports clubs, companies) are noisy, so only keep those whose name starts with what was typed.
  const matched = unique.filter((h) => (h.type === "brand" ? match(h) >= 2 : match(h) > 0));
  const results = (matched.length ? matched : unique)
    .sort((a, b) => match(b) - match(a) || b.popularity - a.popularity)
    .slice(0, 7);

  return Response.json({ results });
}

