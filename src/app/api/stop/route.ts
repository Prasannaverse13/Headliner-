import { addStop } from "@/lib/agent";
import { qlooConfigured } from "@/lib/qloo";
import type { PlanOptions } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUDGETS = ["auto", "club", "theatre", "arena"];

/** Build one more stop for an existing plan ("Add to tour"). */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const artist = (q.get("artist") ?? "").trim().slice(0, 80);
  const city = (q.get("city") ?? "").trim().slice(0, 60);
  const demand = Math.min(99, Math.max(0, Number(q.get("demand")) || 70));
  const budget = (BUDGETS.includes(q.get("budget") ?? "") ? q.get("budget") : "auto") as PlanOptions["budget"];

  if (!artist || !city) return Response.json({ error: "Missing artist or city" }, { status: 400 });
  if (!qlooConfigured()) return Response.json({ error: "Qloo is not configured" }, { status: 503 });

  try {
    return Response.json(await addStop(artist, city, demand, budget));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
