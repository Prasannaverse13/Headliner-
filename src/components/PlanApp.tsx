"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import ArtistSearch from "@/components/ArtistSearch";
import { Logo } from "@/components/Nav";
import { REGION_LABELS } from "@/lib/cities";
import { download, safeName, toCsv, toIcs, toJson, type Row } from "@/lib/export";
import { streamPlan } from "@/lib/planClient";
import { fmtKm, haversine, orderRoute, schedule, totals, type RouteMode } from "@/lib/route";
import { SUPPORT_ROLE, type About, type Market, type Plan, type PlanOptions, type Stop, type SubjectKind } from "@/lib/types";

const GlobeView = dynamic(() => import("@/components/GlobeView"), { ssr: false });

const STOP_OPTS: PlanOptions["stops"][] = [5, 10, 20];
const BUDGETS: { id: PlanOptions["budget"]; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "club", label: "Club" },
  { id: "theatre", label: "Theatre" },
  { id: "arena", label: "Arena" },
];
const REGIONS: { id: PlanOptions["region"]; label: string }[] = [
  { id: "world", label: "Worldwide" },
  ...(Object.entries(REGION_LABELS) as [PlanOptions["region"], string][]).map(([id, label]) => ({ id, label })),
];
const ROUTES: { id: RouteMode; label: string }[] = [
  { id: "shortest", label: "Shortest" },
  { id: "west-east", label: "West-east" },
  { id: "demand", label: "Demand" },
];
type Tab = "overview" | "venues" | "sponsors" | "experience";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "venues", label: "Venues" },
  { id: "sponsors", label: "Sponsors" },
  { id: "experience", label: "Experience" },
];

type Profile = Pick<Plan, "artist" | "home" | "tags" | "source"> & { cachedAt?: string; kind?: SubjectKind };

const parseDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return y ? new Date(y, m - 1, d) : null;
};
const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const dayCount = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000) + 1;

export default function PlanApp() {
  const router = useRouter();
  const params = useSearchParams();
  const artist = params.get("artist")?.trim() || "Coldplay";

  const [opts, setOpts] = useState<PlanOptions>({ stops: 10, region: "world", budget: "auto" });
  const [routeMode, setRouteMode] = useState<RouteMode>("shortest");
  const [startIso, setStartIso] = useState("");
  const [query, setQuery] = useState(artist);
  const [steps, setSteps] = useState<string[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [planned, setPlanned] = useState<Stop[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [about, setAbout] = useState<About | null>(null);
  const [extra, setExtra] = useState<Stop[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const [addError, setAddError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [marketId, setMarketId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [copied, setCopied] = useState(false);
  const [rotate, setRotate] = useState(false);
  const [showMarkets, setShowMarkets] = useState(true);
  const [showHeat, setShowHeat] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const traceList = useRef<HTMLUListElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => setQuery(artist), [artist]);
  useEffect(() => {
    // Default first show date: 6 weeks out. Set after mount so server and browser markup match.
    const d = new Date();
    d.setDate(d.getDate() + 42);
    setStartIso(toIso(d));
  }, []);
  useEffect(() => {
    const el = traceList.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [steps]);

  useEffect(() => {
    setSteps([]);
    setProfile(null);
    setPlanned([]);
    setMarkets([]);
    setAbout(null);
    setExtra([]);
    setExcluded(new Set());
    setDone(false);
    setSelectedId(null);
    setMarketId(null);
    setAddError(null);
    return streamPlan(artist, opts, (e) => {
      if (e.type === "step") setSteps((s) => [...s, e.label]);
      else if (e.type === "profile") setProfile(e.plan);
      else if (e.type === "markets") setMarkets(e.markets);
      else if (e.type === "about") setAbout((a) => ({ ...a, ...e.about }));
      else if (e.type === "stop") setPlanned((s) => [...s, e.stop]);
      else if (e.type === "stopUpdate") setPlanned((s) => s.map((x) => (x.id === e.id ? { ...x, ...e.patch } : x)));
      else if (e.type === "done") setDone(true);
    });
  }, [artist, opts]);

  // The tour: planned stops plus any added by hand, minus removed ones.
  const tour = useMemo(() => [...planned, ...extra].filter((s) => !excluded.has(s.id)), [planned, extra, excluded]);
  const ordered = useMemo(() => (done ? orderRoute(tour, profile?.home ?? null, routeMode) : tour), [tour, done, profile, routeMode]);
  const start = useMemo(() => (startIso ? parseDay(startIso) : null), [startIso]);
  const rows = useMemo<Row[]>(() => (start ? schedule(ordered, start) : []), [ordered, start]);
  const tourIds = useMemo(() => new Set(tour.map((s) => s.id)), [tour]);
  const otherMarkets = useMemo(() => markets.filter((m) => !tourIds.has(m.id)).sort((a, b) => b.demand - a.demand), [markets, tourIds]);
  // Suggestions: the best few from each region, so the list is not one continent.
  const suggestions = useMemo(() => {
    const per = new Map<string, number>();
    return otherMarkets.filter((m) => {
      const n = per.get(m.region) ?? 0;
      per.set(m.region, n + 1);
      return n < 2;
    }).slice(0, 8);
  }, [otherMarkets]);

  // Average taste demand per region across every scanned city: where the act is strongest.
  const byRegion = useMemo(() => {
    const m = new Map<string, { sum: number; n: number }>();
    markets.forEach((x) => {
      const r = m.get(x.region) ?? { sum: 0, n: 0 };
      m.set(x.region, { sum: r.sum + x.demand, n: r.n + 1 });
    });
    return [...m.entries()].map(([region, v]) => ({ region: region as keyof typeof REGION_LABELS, avg: Math.round(v.sum / v.n), n: v.n })).sort((a, b) => b.avg - a.avg);
  }, [markets]);

  const selectedIndex = ordered.findIndex((s) => s.id === selectedId);
  const selectedRow = selectedIndex >= 0 ? rows[selectedIndex] ?? null : null;
  const selectedStop = selectedIndex >= 0 ? ordered[selectedIndex] : null;
  const selectedMarket = marketId ? markets.find((m) => m.id === marketId) ?? null : null;

  const kpis = useMemo(() => {
    if (!tour.length) return null;
    const top = tour.reduce((a, b) => (b.demand > a.demand ? b : a));
    const last = rows[rows.length - 1];
    return {
      count: tour.length,
      avg: Math.round(tour.reduce((n, s) => n + s.demand, 0) / tour.length),
      top: top.city,
      countries: new Set(tour.map((s) => s.country)).size,
      km: totals(ordered, profile?.home ?? null).km,
      days: start && last ? dayCount(start, last.date) : null,
    };
  }, [tour, ordered, rows, profile, start]);

  const progress = done ? 100 : Math.min(96, Math.round((steps.length / (opts.stops + 6)) * 100));
  const set = <K extends keyof PlanOptions>(k: K, v: PlanOptions[K]) => setOpts((o) => ({ ...o, [k]: v }));

  const selectStop = (id: string | null) => {
    setSelectedId(id);
    setMarketId(null);
    setTab("overview");
  };
  const selectMarket = (id: string) => {
    setMarketId(id);
    setSelectedId(null);
    setAddError(null);
  };
  const step = (dir: 1 | -1) => {
    if (selectedIndex < 0) return;
    selectStop(ordered[(selectedIndex + dir + ordered.length) % ordered.length].id);
  };

  const remove = (id: string) => {
    setExcluded((x) => new Set(x).add(id));
    setExtra((e) => e.filter((s) => s.id !== id));
    selectStop(null);
  };

  const addMarket = async (m: Market) => {
    setAddError(null);
    setAdding((a) => new Set(a).add(m.id));
    try {
      const qs = new URLSearchParams({ artist: profile?.artist ?? artist, city: m.city, demand: String(m.demand), budget: opts.budget });
      const res = await fetch(`/api/stop?${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const stop = (await res.json()) as Stop;
      setExcluded((x) => {
        const n = new Set(x);
        n.delete(m.id);
        return n;
      });
      // A stop that was planned and then removed is simply brought back.
      if (planned.some((p) => p.id === stop.id)) setPlanned((p) => p.map((x) => (x.id === stop.id ? { ...x, ...stop } : x)));
      else setExtra((e) => [...e.filter((x) => x.id !== stop.id), stop]);
      selectStop(stop.id);
    } catch {
      setAddError(`Could not add ${m.city}. Try again in a moment.`);
    } finally {
      setAdding((a) => {
        const n = new Set(a);
        n.delete(m.id);
        return n;
      });
    }
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked; nothing to do */
    }
  };

  const name = profile?.artist ?? artist;
  const exportAs = (kind: "csv" | "ics" | "json" | "pdf") => {
    if (menu.current) menu.current.open = false;
    if (kind === "pdf") return window.print();
    const base = `${safeName(name)}-tour`;
    if (kind === "csv") download(`${base}.csv`, "text/csv", toCsv(rows));
    if (kind === "ics") download(`${base}.ics`, "text/calendar", toIcs(name, rows));
    if (kind === "json") download(`${base}.json`, "application/json", toJson(name, rows));
  };
  const canExport = done && rows.length > 0;

  return (
    <>
      <div className="app">
        <header className="appbar">
          <Link href="/" className="nav-logo" aria-label="Headliner home"><Logo /></Link>
          <nav className="crumbs" aria-label="Breadcrumb">
            <span className="muted">Tour planner</span>
            <span className="sep" aria-hidden="true">/</span>
            <span>{name}</span>
          </nav>
          <span className={`status ${done ? "" : "live"}`} role="status">
            <i className="tick" />
            {done ? "Plan ready" : "Planning"}
          </span>
          {profile?.source === "sample" && (
            <span className="status quiet" title="Qloo was unreachable, so this plan uses sample data">Sample data</span>
          )}
          {profile?.source === "live" && !profile.cachedAt && <span className="status quiet" title="Taste data from the Qloo API">Live Qloo data</span>}
          {profile?.cachedAt && (
            <span className="status quiet" title={`Qloo data saved on ${new Date(profile.cachedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}. Plans refresh weekly.`}>
              Saved Qloo plan
            </span>
          )}
          <span className="spacer" />
          <button className="btn btn-sm" onClick={share} disabled={!done}>{copied ? "Link copied" : "Share link"}</button>
          <details className="menu" ref={menu}>
            <summary className={`btn btn-sm btn-fill ${canExport ? "" : "is-disabled"}`} aria-disabled={!canExport} onClick={(e) => !canExport && e.preventDefault()}>
              Export
            </summary>
            <ul>
              <li><button onClick={() => exportAs("pdf")}>PDF brief</button></li>
              <li><button onClick={() => exportAs("csv")}>Spreadsheet (.csv)</button></li>
              <li><button onClick={() => exportAs("ics")}>Calendar (.ics)</button></li>
              <li><button onClick={() => exportAs("json")}>Data (.json)</button></li>
            </ul>
          </details>
        </header>

        <aside className="rail rail-left" aria-label="Plan inputs">
          <section className="block">
            <label className="field-label" htmlFor="plan-search">Artist, comedian, team or podcast</label>
            <ArtistSearch
              value={query}
              onChange={setQuery}
              onSubmit={(a) => router.push(`/plan?artist=${encodeURIComponent(a)}`)}
              buttonLabel="Plan"
              inputClassName="input-sm"
            />
          </section>

          <section className="block" aria-label="Parameters">
            <div className="block-head"><span>Parameters</span></div>
            <div className="param">
              <span id="p-stops">Stops</span>
              <div className="seg" role="group" aria-labelledby="p-stops">
                {STOP_OPTS.map((n) => (
                  <button key={n} aria-pressed={opts.stops === n} onClick={() => set("stops", n)}>{n}</button>
                ))}
              </div>
            </div>
            <div className="param">
              <span id="p-venue">Venue size</span>
              <div className="seg" role="group" aria-labelledby="p-venue">
                {BUDGETS.map((b) => (
                  <button key={b.id} aria-pressed={opts.budget === b.id} onClick={() => set("budget", b.id)}>{b.label}</button>
                ))}
              </div>
            </div>
            <div className="param">
              <label htmlFor="p-region">Region</label>
              <select id="p-region" className="select" value={opts.region} onChange={(e) => set("region", e.target.value as PlanOptions["region"])}>
                {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <div className="param stack-p">
              <span id="p-route">Route order</span>
              <div className="seg" role="group" aria-labelledby="p-route">
                {ROUTES.map((r) => (
                  <button key={r.id} aria-pressed={routeMode === r.id} onClick={() => setRouteMode(r.id)}>{r.label}</button>
                ))}
              </div>
            </div>
            <div className="param">
              <label htmlFor="p-start">First show</label>
              <input id="p-start" type="date" className="select date" value={startIso} onChange={(e) => setStartIso(e.target.value)} />
            </div>
          </section>

          <section className="block" aria-label="Summary">
            <div className="block-head"><span>Summary</span></div>
            <div className="kpis">
              <Kpi label="Stops" value={kpis ? String(kpis.count) : null} />
              <Kpi label="Average demand" value={kpis ? String(kpis.avg) : null} />
              <Kpi label="Distance" value={kpis ? fmtKm(kpis.km) : null} small />
              <Kpi label="Tour length" value={kpis ? (kpis.days ? `${kpis.days} days` : "") : null} small />
              <Kpi label="Strongest market" value={kpis ? kpis.top : null} small />
              <Kpi label="Countries" value={kpis ? String(kpis.countries) : null} />
            </div>
          </section>

          <section className="block" aria-label="Popularity by region">
            <div className="block-head"><span>Popularity by region</span><span>{markets.length ? `${markets.length} cities` : ""}</span></div>
            {byRegion.length === 0 ? (
              <span className="skeleton" style={{ width: "90%", height: 54 }} />
            ) : (
              <ul className="regions">
                {byRegion.map((r) => (
                  <li key={r.region}>
                    <span>{REGION_LABELS[r.region]}<small>{r.n} {r.n === 1 ? "city" : "cities"}</small></span>
                    <span className="bar"><i style={{ width: `${r.avg}%` }} /></span>
                    <span className="num">{r.avg}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="foot">Average taste demand across the cities scanned in each region.</p>
          </section>

          <section className="block" aria-label={`About ${name}`}>
            <div className="block-head"><span>About {name}</span></div>
            <AboutPanel about={about} />
          </section>

          <section className="block" aria-label="Fan taste">
            <div className="block-head"><span>Fan taste</span></div>
            <div className="tags">
              {profile
                ? profile.tags.map((t) => <span key={t} className="pill pill-quiet">{t}</span>)
                : <span className="skeleton" style={{ width: "70%" }} />}
            </div>
          </section>

          <section className="block" aria-label="Agent trace" aria-live="polite">
            <div className="block-head">
              <span>Agent trace</span>
              <span>{progress}%</span>
            </div>
            <div className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${progress}%` }} /></div>
            <ul className="tl" ref={traceList}>
              {steps.map((s, i) => {
                const current = !done && i === steps.length - 1;
                return (
                  <li key={i} aria-current={current ? "step" : undefined}>
                    <i className={`tick ${current ? "live" : "done"}`} />
                    <span>{s}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>

        <main className="stage">
          <GlobeView
            home={profile?.home ?? null}
            stops={ordered}
            markets={otherMarkets}
            selectedId={selectedId}
            onSelect={selectStop}
            onMarket={selectMarket}
            showMarkets={showMarkets}
            showHeat={showHeat}
            autoRotate={rotate}
            resetKey={resetKey}
          />
          <div className="hud hud-bl" aria-hidden="true">
            <span className="muted">Taste demand</span>
            <span className="legend"><i style={{ opacity: 0.25 }} /><i style={{ opacity: 0.55 }} /><i /></span>
            <span className="muted">Low to high</span>
          </div>
          <div className="hud hud-bc">
            <button className="btn btn-sm btn-solid-dark" onClick={() => setResetKey((k) => k + 1)}>Reset view</button>
            <button className="btn btn-sm btn-solid-dark" aria-pressed={rotate} onClick={() => setRotate((r) => !r)}>Rotate</button>
            <button className="btn btn-sm btn-solid-dark" aria-pressed={showMarkets} onClick={() => setShowMarkets((v) => !v)}>All markets</button>
            <button className="btn btn-sm btn-solid-dark" aria-pressed={showHeat} onClick={() => setShowHeat((v) => !v)}>Heat</button>
          </div>
        </main>

        <aside className="rail rail-right" aria-label="Tour route">
          {selectedStop && selectedRow ? (
            <Detail
              stop={selectedStop}
              row={selectedRow}
              index={selectedIndex}
              total={ordered.length}
              tab={tab}
              setTab={setTab}
              onBack={() => selectStop(null)}
              onStep={step}
              onRemove={() => remove(selectedStop.id)}
              about={about}
              kind={profile?.kind ?? "act"}
              rank={[...markets].sort((a, b) => b.demand - a.demand).findIndex((m) => m.id === selectedStop.id) + 1}
              scanned={markets.length}
            />
          ) : selectedMarket ? (
            <MarketCard
              market={selectedMarket}
              rank={markets.findIndex((m) => m.id === selectedMarket.id) + 1}
              total={markets.length}
              tour={ordered}
              inTour={tourIds.has(selectedMarket.id)}
              busy={adding.has(selectedMarket.id)}
              error={addError}
              onAdd={() => addMarket(selectedMarket)}
              onBack={() => setMarketId(null)}
            />
          ) : (
            <>
              <div className="block-head head-pad">
                <span>Route</span>
                <span>{ordered.length ? `${ordered.length} stops` : ""}</span>
              </div>
              <div className="thead"><span>#</span><span>City</span><span className="r">Demand</span></div>
              {ordered.length === 0 ? (
                <ul aria-hidden="true">
                  {Array.from({ length: 7 }, (_, i) => (
                    <li key={i} className="tr tr-skel"><span className="skeleton" style={{ width: 14 }} /><span className="skeleton" style={{ width: `${55 + ((i * 17) % 30)}%` }} /><span className="skeleton" style={{ width: 56, justifySelf: "end" }} /></li>
                  ))}
                </ul>
              ) : (
                <ul>
                  {ordered.map((s, i) => {
                    const r = rows[i];
                    return (
                      <li key={s.id}>
                        <button className="tr" onClick={() => selectStop(s.id)}>
                          <span className="muted">{i + 1}</span>
                          <span className="city">
                            {s.city}
                            <small>
                              {r ? `${fmtDate(r.date)}` : s.country}
                              {r?.leg ? `, ${fmtKm(r.leg.km)} from ${r.legFrom}` : ""}
                            </small>
                          </span>
                          <span className="dm"><span className="bar"><i style={{ width: `${s.demand}%` }} /></span>{s.demand}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {done && otherMarkets.length > 0 && (
                <section className="more" aria-label="Next best markets">
                  <div className="block-head head-pad">
                    <span>Next best markets</span>
                    <span>{markets.length} scanned</span>
                  </div>
                  <ul>
                    {suggestions.map((m) => (
                      <li key={m.id} className="mk">
                        <button className="mk-name" onClick={() => selectMarket(m.id)}>
                          {m.city}
                          <small>{REGION_LABELS[m.region]}</small>
                        </button>
                        <span className="mk-d">{m.demand}</span>
                        <button className="btn btn-sm" disabled={adding.has(m.id)} onClick={() => addMarket(m)} aria-label={`Add ${m.city} to the tour`}>
                          {adding.has(m.id) ? "Adding" : "Add"}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {addError && <p className="hint err" role="alert">{addError}</p>}
                </section>
              )}
              {done && <p className="hint">Select a stop for openers, sponsors and VIP picks. Click any dot on the globe to see that city.</p>}
            </>
          )}
        </aside>
      </div>

      <PrintBrief artist={name} rows={rows} km={kpis?.km ?? 0} />
    </>
  );
}

function Kpi({ label, value, small }: { label: string; value: string | null; small?: boolean }) {
  return (
    <div className="kpi">
      <span className="kpi-l">{label}</span>
      {value === null ? <span className="skeleton" style={{ width: "60%", height: 22, marginTop: 8 }} /> : <span className={`kpi-v ${small ? "sm" : ""}`}>{value}</span>}
    </div>
  );
}

function Detail({
  stop, row, index, total, tab, setTab, onBack, onStep, onRemove, about, kind, rank, scanned,
}: {
  stop: Stop; row: Row; index: number; total: number; tab: Tab; setTab: (t: Tab) => void; onBack: () => void; onStep: (d: 1 | -1) => void; onRemove: () => void;
  about: About | null; kind: SubjectKind; rank: number; scanned: number;
}) {
  const strength = fanStrength(rank, scanned);
  const focus = (stop.focus ?? []).map((t) => about?.knownFor?.find((k) => k.title.toLowerCase() === t.toLowerCase()) ?? { title: t, kind: "other" });
  return (
    <article>
      <div className="detail-head">
        <div className="detail-nav">
          <button className="back" onClick={onBack}>&#8592; Route</button>
          <span className="stepper">
            <button onClick={() => onStep(-1)} aria-label="Previous stop">&#8249;</button>
            <span>{index + 1} of {total}</span>
            <button onClick={() => onStep(1)} aria-label="Next stop">&#8250;</button>
          </span>
        </div>
        <div className="stop-head">
          <div>
            <h2 className="stop-city">{stop.city}</h2>
            <p className="stop-sub">{stop.country}, {stop.venueType}</p>
          </div>
          <div className="demand">{stop.demand}<small>Demand score</small></div>
        </div>
        <p className="leg">
          <span>{fmtDate(row.date)}</span>
          <span className="muted">
            {row.leg
              ? `${fmtKm(row.leg.km)} from ${row.legFrom} by ${row.leg.mode}${row.leg.travelDays ? `, ${row.leg.travelDays} travel ${row.leg.travelDays === 1 ? "day" : "days"}` : ""}`
              : "Opening night"}
          </span>
        </p>
      </div>

      <div className="tabs" role="tablist" aria-label="Stop details">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      <div className="tabpanel" role="tabpanel">
        {tab === "overview" && (
          <>
            <div className="sec first">
              <h3>Popularity in {stop.city}</h3>
              <ul><li><span>{strength}</span><span>{rank > 0 ? `Ranks ${rank} of ${scanned} cities` : `Demand ${stop.demand}`}</span></li></ul>
              <div className="bar"><i style={{ width: `${stop.demand}%` }} /></div>
            </div>
            {focus.length > 0 && (
              <div className="sec">
                <h3>Lead with</h3>
                <ul className="stack">
                  {focus.map((k) => (
                    <li key={k.title}><span>{k.title}</span><span>{[k.kind, k.year].filter(Boolean).join(", ")}</span></li>
                  ))}
                </ul>
                <p className="foot">Picked from the known-for list for this city's taste. A suggestion, not a fact.</p>
              </div>
            )}
            <div className="sec">
              <h3>{SUPPORT_ROLE[kind]}</h3>
              <ul><li><span>{stop.opener.name}</span><span>{stop.opener.overlap}% overlap</span></li></ul>
              <div className="bar"><i style={{ width: `${stop.opener.overlap}%` }} /></div>
            </div>
            <div className="sec">
              <h3>Why this city</h3>
              <p className="muted">{stop.why}</p>
            </div>
          </>
        )}
        {tab === "venues" && (
          <div className="sec first">
            <h3>Venues that can host the show</h3>
            {!stop.venues?.length ? (
              <p className="muted">No venue data for this city.</p>
            ) : (
              <ul className="venues">
                {stop.venues.map((v) => (
                  <li key={v.name}>
                    <div className="v-top">
                      <span className="v-name">{v.name}</span>
                      <span className="v-fit">{v.fit}%</span>
                    </div>
                    <div className="v-meta">
                      <span>{v.category}, typically {v.size}</span>
                      {v.concerts === "yes" ? <span className="tag-ok">Hosts concerts</span> : <span className="muted">Check availability</span>}
                    </div>
                    <div className="bar"><i style={{ width: `${v.fit}%` }} /></div>
                    {v.note && <p className="v-note">{v.note}</p>}
                  </li>
                ))}
              </ul>
            )}
            <p className="foot">Venues come from Qloo, ranked by how well they match this act's fans. Capacity is the typical range for the category. Confirm real capacity and dates with each venue.</p>
          </div>
        )}
        {tab === "sponsors" && (
          <div className="sec first">
            <h3>Sponsor matches</h3>
            <ul className="stack">
              {stop.sponsors.map((s) => (
                <li key={s.name}><span>{s.name}</span><span>{s.why}</span></li>
              ))}
            </ul>
          </div>
        )}
        {tab === "experience" && (
          <>
            <div className="sec first">
              <h3>VIP and fan picks</h3>
              <ul className="stack">
                {stop.vip.map((v, i) => (
                  <li key={`${i}-${v.name}`}><span>{v.name}</span><span>{v.kind}</span></li>
                ))}
              </ul>
            </div>
            <div className="sec">
              <h3>City ad copy</h3>
              {stop.pending && !stop.adCopy ? <span className="skeleton" style={{ width: "80%", height: 16 }} /> : <p>{stop.adCopy}</p>}
            </div>
          </>
        )}
        <button className="btn btn-sm danger" onClick={onRemove}>Remove from tour</button>
      </div>
    </article>
  );
}

function MarketCard({
  market, rank, total, tour, inTour, busy, error, onAdd, onBack,
}: {
  market: Market; rank: number; total: number; tour: Stop[]; inTour: boolean; busy: boolean; error: string | null; onAdd: () => void; onBack: () => void;
}) {
  const nearest = useMemo(() => {
    if (!tour.length) return null;
    return tour
      .map((s) => ({ s, km: haversine(s, market) }))
      .sort((a, b) => a.km - b.km)[0];
  }, [tour, market]);
  return (
    <article>
      <div className="detail-head">
        <div className="detail-nav">
          <button className="back" onClick={onBack}>&#8592; Route</button>
          <span>Not on the tour</span>
        </div>
        <div className="stop-head">
          <div>
            <h2 className="stop-city">{market.city}</h2>
            <p className="stop-sub">{market.country}, {REGION_LABELS[market.region]}</p>
          </div>
          <div className="demand">{market.demand}<small>Demand score</small></div>
        </div>
      </div>
      <div className="tabpanel">
        <div className="sec first">
          <h3>Fan fit</h3>
          <p>Ranks {rank} of {total} scanned cities for taste match.</p>
          <div className="bar"><i style={{ width: `${market.demand}%` }} /></div>
        </div>
        {nearest && (
          <div className="sec">
            <h3>Route fit</h3>
            <p className="muted">Nearest stop on your tour is {nearest.s.city}, {fmtKm(nearest.km)} away.</p>
          </div>
        )}
        <button className="btn btn-fill" onClick={onAdd} disabled={busy || inTour}>
          {busy ? "Adding" : inTour ? "On the tour" : "Add to tour"}
        </button>
        {error && <p className="hint err" role="alert" style={{ border: 0, padding: 0 }}>{error}</p>}
      </div>
    </article>
  );
}

function PrintBrief({ artist, rows, km }: { artist: string; rows: Row[]; km: number }) {
  return (
    <div className="brief">
      <h1>{artist} tour brief</h1>
      <p>Made with Headliner and Qloo Taste AI. {rows.length} stops, {fmtKm(km)}.</p>
      {rows.map((s, i) => (
        <section key={s.id}>
          <h2>{i + 1}. {s.city}, {s.country} ({fmtDate(s.date)})</h2>
          <p>{s.venueType}. Demand score {s.demand}.{s.leg ? ` ${fmtKm(s.leg.km)} from ${s.legFrom}.` : ""}</p>
          <p>Opener: {s.opener.name} ({s.opener.overlap}% overlap)</p>
          {s.venues && s.venues.length > 0 && <p>Venue ideas: {s.venues.slice(0, 4).map((v) => `${v.name} (${v.category})`).join(", ")}</p>}
          {s.focus && s.focus.length > 0 && <p>Lead with: {s.focus.join(", ")}</p>}
          <p>Sponsors: {s.sponsors.map((x) => x.name).join(", ")}</p>
          <ul>{s.vip.map((v, j) => <li key={`${j}-${v.name}`}>{v.kind}: {v.name}</li>)}</ul>
          <p>{s.adCopy}</p>
          <p>{s.why}</p>
        </section>
      ))}
    </div>
  );
}



const fmtCompact = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

/** Fan strength tier from where the city ranks among all scanned cities. */
function fanStrength(rank: number, total: number): string {
  if (!rank || !total) return "Fan strength";
  const p = rank / total;
  return p <= 0.2 ? "Core market" : p <= 0.5 ? "Strong market" : p <= 0.8 ? "Growing market" : "Emerging market";
}

function AboutPanel({ about }: { about: About | null }) {
  if (!about) return <span className="skeleton" style={{ width: "90%", height: 70 }} />;
  const fal = about.fansAlsoLove;
  const groups = fal
    ? ([["Movies", fal.movies], ["Shows", fal.shows], ["Podcasts", fal.podcasts], ["Brands", fal.brands]] as [string, string[]][]).filter(([, v]) => v.length)
    : [];
  return (
    <div className="about">
      <div className="about-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {about.image && <img src={about.image} alt="" width={64} height={64} />}
        <div>
          {about.description && <p>{about.description}</p>}
          {about.lastfm?.listeners ? (
            <p className="muted">{fmtCompact(about.lastfm.listeners)} listeners{about.lastfm.scrobbles ? `, ${fmtCompact(about.lastfm.scrobbles)} plays` : ""} on Last.fm</p>
          ) : null}
        </div>
      </div>

      <div className="sub">
        <h3>Known for</h3>
        {about.knownFor?.length ? (
          <ul className="stack">
            {about.knownFor.map((k) => (
              <li key={k.title}>
                <span>{k.title}{k.note && <small>{k.note}</small>}</span>
                <span>{[k.kind, k.year].filter(Boolean).join(", ")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="skeleton" style={{ width: "80%", height: 14 }} />
        )}
        {about.knownFor?.length ? <p className="foot">Written by the AI model from its own knowledge. Check before you publish.</p> : null}
      </div>

      {groups.length > 0 && (
        <div className="sub">
          <h3>Fans also love</h3>
          {groups.map(([label, items]) => (
            <p key={label} className="loves"><span className="muted">{label}</span> {items.join(", ")}</p>
          ))}
          <p className="foot">From Qloo taste data.</p>
        </div>
      )}
    </div>
  );
}

