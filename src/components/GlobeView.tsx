"use client";

import { useEffect, useMemo, useRef } from "react";
import { setupEarth } from "@/lib/earth";
import type { Market, Stop } from "@/lib/types";

type Props = {
  home: { city: string; lat: number; lng: number } | null;
  stops: Stop[];
  /** Scored cities that are not on the tour, drawn as dim dots so the whole world's demand shows. */
  markets: Market[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMarket: (id: string) => void;
  showMarkets: boolean;
  showHeat: boolean;
  autoRotate: boolean;
  resetKey: number;
};

// globe.gl ships its own loose typings; the instance is driven through a small surface here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GlobeInstance = any;
type Pt = { kind: "stop" | "market"; id: string; city: string; lat: number; lng: number; demand: number };

export default function GlobeView({ home, stops, markets, selectedId, onSelect, onMarket, showMarkets, showHeat, autoRotate, resetKey }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const globe = useRef<GlobeInstance>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onMarketRef = useRef(onMarket);
  onMarketRef.current = onMarket;

  const points = useMemo<Pt[]>(
    () => [
      ...(showMarkets ? markets.map((m): Pt => ({ kind: "market", id: m.id, city: m.city, lat: m.lat, lng: m.lng, demand: m.demand })) : []),
      ...stops.map((s): Pt => ({ kind: "stop", id: s.id, city: s.city, lat: s.lat, lng: s.lng, demand: s.demand })),
    ],
    [markets, stops, showMarkets],
  );

  const arcs = useMemo(() => {
    const route = home ? [{ lat: home.lat, lng: home.lng }, ...stops] : stops;
    return route.slice(1).map((to, i) => ({
      startLat: route[i].lat,
      startLng: route[i].lng,
      endLat: to.lat,
      endLng: to.lng,
    }));
  }, [home, stops]);

  const heat = useMemo(
    () =>
      stops.flatMap((s) =>
        s.heat?.length
          ? // Real Qloo heatmap cells, spread a little so a small city shows on the globe.
            s.heat.map((h, i) => ({
              lat: s.lat + (h.lat - s.lat) * 14 + Math.sin(i * 2.4) * 0.4,
              lng: s.lng + (h.lng - s.lng) * 14 + Math.cos(i * 2.4) * 0.4,
              weight: (s.demand / s.heat!.length) * Math.max(0.4, h.weight),
            }))
          : Array.from({ length: 9 }, (_, i) => ({
              lat: s.lat + Math.sin(i * 2.4) * 2.2,
              lng: s.lng + Math.cos(i * 2.4) * 2.2,
              weight: s.demand / 9,
            })),
      ),
    [stops],
  );

  // Create the globe once.
  useEffect(() => {
    let disposed = false;
    let ro: ResizeObserver | undefined;
    let disposeEarth: (() => void) | undefined;

    import("globe.gl").then(({ default: Globe }) => {
      const el = host.current;
      if (disposed || !el) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g: GlobeInstance = new (Globe as any)(el)
        .backgroundColor("#050311")
        .backgroundImageUrl("/globe/night-sky.png")
        .atmosphereColor("#4d9bff")
        .atmosphereAltitude(0.2)
        .pointLat("lat")
        .pointLng("lng")
        .pointColor((d: Pt) => (d.kind === "market" ? "rgba(255,255,255,0.45)" : "#ffffff"))
        .pointRadius((d: Pt) => (d.kind === "market" ? 0.22 + (d.demand / 100) * 0.12 : 0.38))
        .pointAltitude((d: Pt) => (d.kind === "market" ? 0.003 : 0.004 + (d.demand / 100) * 0.03))
        .pointLabel((d: Pt) => `${d.city}, demand ${d.demand}${d.kind === "market" ? " (not on the tour yet)" : ""}`)
        .onPointClick((d: Pt) => (d.kind === "market" ? onMarketRef.current(d.id) : onSelectRef.current(d.id)))
        .ringLat("lat")
        .ringLng("lng")
        .ringColor(() => (t: number) => `rgba(255,255,255,${1 - t})`)
        .ringMaxRadius(3.5)
        .ringPropagationSpeed(2)
        .ringRepeatPeriod(2000)
        .arcColor(() => ["rgba(255,255,255,0.95)", "rgba(255,255,255,0.2)"])
        .arcStroke(0.5)
        .arcDashLength(0.45)
        .arcDashGap(0.2)
        .arcDashAnimateTime(2800)
        .arcAltitudeAutoScale(0.45)
        .labelLat("lat")
        .labelLng("lng")
        .labelText("city")
        .labelSize(0.55)
        .labelDotRadius(0)
        .labelColor(() => "rgba(255,255,255,0.9)")
        .labelAltitude(0.04)
        .labelResolution(2)
        .onLabelClick((d: Stop) => onSelectRef.current(d.id))
        .hexBinPointLat("lat")
        .hexBinPointLng("lng")
        .hexBinPointWeight("weight")
        .hexBinResolution(3)
        .hexMargin(0.25)
        .hexTopColor((d: { sumWeight: number }) => `rgba(255,255,255,${Math.min(0.85, d.sumWeight / 70)})`)
        .hexSideColor(() => "rgba(255,255,255,0.12)")
        .hexAltitude((d: { sumWeight: number }) => d.sumWeight * 0.00015);

      const ctl = g.controls();
      ctl.autoRotate = false;
      ctl.autoRotateSpeed = 0.5;
      ctl.enableDamping = true;
      g.pointOfView({ lat: 20, lng: -40, altitude: 2.6 }, 0);

      const fit = () => g.width(el.clientWidth).height(el.clientHeight);
      fit();
      ro = new ResizeObserver(fit);
      ro.observe(el);

      globe.current = g;
      setupEarth(g, () => !disposed)
        .then((dispose) => {
          if (disposed) dispose();
          else disposeEarth = dispose;
        })
        .catch(() => {
          /* textures failed to load; the globe stays on its default material */
        });
    });

    return () => {
      disposed = true;
      disposeEarth?.();
      ro?.disconnect();
      const g = globe.current;
      globe.current = null;
      g?._destructor?.();
    };
  }, []);

  // Push data. Retry briefly in case the globe is still loading.
  useEffect(() => {
    const push = () => {
      const g = globe.current;
      if (!g) return false;
      g.pointsData(points).ringsData(stops).labelsData(stops).arcsData(arcs).hexBinPointsData(showHeat ? heat : []);
      return true;
    };
    if (push()) return;
    const id = setInterval(() => push() && clearInterval(id), 150);
    return () => clearInterval(id);
  }, [points, stops, arcs, heat, showHeat]);

  // Fly to the home city when the plan starts, and again on "Reset view".
  useEffect(() => {
    if (!home) return;
    const fly = () => {
      const g = globe.current;
      if (!g) return false;
      g.pointOfView({ lat: home.lat, lng: home.lng, altitude: 1.9 }, resetKey ? 1200 : 2000);
      return true;
    };
    if (fly()) return;
    const id = setInterval(() => fly() && clearInterval(id), 150);
    return () => clearInterval(id);
  }, [home, resetKey]);

  // Fly to the selected stop.
  const stopsRef = useRef(stops);
  stopsRef.current = stops;
  useEffect(() => {
    const g = globe.current;
    const stop = stopsRef.current.find((s) => s.id === selectedId);
    if (!g || !stop) return;
    g.pointOfView({ lat: stop.lat, lng: stop.lng, altitude: 1.5 }, 1200);
  }, [selectedId]);

  // Auto-rotate is a user toggle.
  useEffect(() => {
    const apply = () => {
      const g = globe.current;
      if (!g) return false;
      g.controls().autoRotate = autoRotate;
      return true;
    };
    if (apply()) return;
    const id = setInterval(() => apply() && clearInterval(id), 150);
    return () => clearInterval(id);
  }, [autoRotate]);

  return <div ref={host} className="plan-globe" role="img" aria-label="3D globe showing the planned tour route" />;
}
