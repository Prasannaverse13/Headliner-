import { runPlan } from "@/lib/agent";
import { getPlan, planKey, savePlan } from "@/lib/planCache";
import { qlooConfigured } from "@/lib/qloo";
import type { PlanEvent, PlanOptions } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STOPS = [5, 10, 20];
const REGIONS = ["world", "north-america", "latin-america", "europe", "africa", "middle-east", "asia", "oceania"];
const BUDGETS = ["club", "theatre", "arena"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const artist = (q.get("artist") ?? "").trim().slice(0, 80);
  const stops = Number(q.get("stops"));
  const region = q.get("region") ?? "world";
  const budget = q.get("budget") ?? "arena";
  const fresh = q.get("fresh") === "1";

  if (!artist) return Response.json({ error: "Missing artist" }, { status: 400 });

  const opts: PlanOptions = {
    stops: (STOPS.includes(stops) ? stops : 10) as PlanOptions["stops"],
    region: (REGIONS.includes(region) ? region : "world") as PlanOptions["region"],
    budget: (BUDGETS.includes(budget) ? budget : "arena") as PlanOptions["budget"],
  };
  const key = planKey(artist, opts);
  const cached = fresh ? null : await getPlan(key);
  if (!cached && !qlooConfigured()) return Response.json({ error: "Qloo is not configured" }, { status: 503 });

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (e: PlanEvent) => {
        if (!closed) controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      };
      req.signal.addEventListener("abort", () => (closed = true));

      try {
        if (cached) {
          // Replay a saved plan with short pauses so the globe still animates.
          for (const e of cached.events) {
            if (closed) break;
            send(e.type === "profile" ? { ...e, plan: { ...e.plan, cachedAt: cached.savedAt } } : e);
            await sleep(e.type === "stop" ? 160 : e.type === "step" ? 40 : 10);
          }
          return;
        }
        const recorded: PlanEvent[] = [];
        let stopsSeen = 0;
        for await (const e of runPlan(artist, opts)) {
          recorded.push(e);
          if (e.type === "stop") stopsSeen++;
          send(e);
        }
        if (stopsSeen > 0) await savePlan(key, recorded);
      } catch (err) {
        send({ type: "error", message: (err as Error).message });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          /* the client already left */
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", Connection: "keep-alive" },
  });
}
