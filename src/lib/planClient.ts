import { buildSamplePlan } from "./demo";
import type { PlanEvent, PlanOptions } from "./types";

/** Replays sample data on a timer. Used only when the live API is unreachable. */
function streamSample(artist: string, opts: PlanOptions, onEvent: (e: PlanEvent) => void): () => void {
  const plan = buildSamplePlan(artist, opts);
  const timers: ReturnType<typeof setTimeout>[] = [];
  let t = 0;
  const at = (ms: number, fn: () => void) => {
    t += ms;
    timers.push(setTimeout(fn, t));
  };

  at(150, () => onEvent({ type: "step", label: `Finding ${plan.artist} in the taste graph` }));
  at(700, () => onEvent({ type: "profile", plan: { artist: plan.artist, home: plan.home, tags: plan.tags, source: plan.source } }));
  at(900, () => onEvent({ type: "step", label: "Reading fan taste across music, film, food and fashion" }));
  at(1100, () => onEvent({ type: "step", label: `Scanning ${plan.markets.length} cities for demand with no show yet` }));
  at(300, () => onEvent({ type: "markets", markets: plan.markets }));
  at(1200, () => onEvent({ type: "step", label: "Matching openers by audience overlap" }));
  plan.stops.forEach((stop, i) => {
    at(i === 0 ? 900 : 520, () => {
      onEvent({ type: "step", label: `Added ${stop.city}, demand ${stop.demand}` });
      onEvent({ type: "stop", stop });
    });
  });
  at(600, () => onEvent({ type: "step", label: "Matching sponsors and writing city copy" }));
  at(500, () => onEvent({ type: "done" }));

  return () => timers.forEach(clearTimeout);
}

/**
 * Streams a tour plan to the UI. Reads the live /api/plan event stream (Qloo + the model).
 * If the stream fails before any stop arrives, it falls back to sample data.
 */
export function streamPlan(artist: string, opts: PlanOptions, onEvent: (e: PlanEvent) => void): () => void {
  const ctrl = new AbortController();
  let cancelled = false;
  let gotStop = false;
  let stopSample: (() => void) | undefined;

  const fallback = (why: string) => {
    if (cancelled) return;
    onEvent({ type: "step", label: `${why}. Showing sample data instead` });
    stopSample = streamSample(artist, opts, onEvent);
  };

  (async () => {
    try {
      const qs = new URLSearchParams({ artist, stops: String(opts.stops), region: opts.region, budget: opts.budget });
      const res = await fetch(`/api/plan?${qs}`, { signal: ctrl.signal });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let finished = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, i);
          buf = buf.slice(i + 2);
          if (!chunk.startsWith("data: ")) continue;
          const e = JSON.parse(chunk.slice(6)) as PlanEvent;
          if (e.type === "error") throw new Error(e.message);
          if (e.type === "stop") gotStop = true;
          if (e.type === "done") finished = true;
          if (!cancelled) onEvent(e);
        }
      }
      if (!finished && !cancelled) throw new Error("Stream ended early");
    } catch (err) {
      if (cancelled || (err as Error).name === "AbortError") return;
      if (gotStop) {
        onEvent({ type: "step", label: "Connection lost, showing the stops found so far" });
        onEvent({ type: "done" });
      } else {
        fallback(`Live data unavailable (${(err as Error).message})`);
      }
    }
  })();

  return () => {
    cancelled = true;
    ctrl.abort();
    stopSample?.();
  };
}
