"use client";

import Link from "next/link";
import { useRef, useState } from "react";

type Props = {
  artist: string;
  detail: string;
  video: string;
  poster: string;
  badge?: string;
};

export default function WorkCard({ artist, detail, video, poster, badge }: Props) {
  const vid = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);

  const start = () => {
    setOn(true);
    vid.current?.play().catch(() => {});
  };
  const stop = () => {
    setOn(false);
    vid.current?.pause();
  };

  return (
    <Link
      href={`/plan?artist=${encodeURIComponent(artist)}`}
      className="card"
      onMouseEnter={start}
      onMouseLeave={stop}
      onFocus={start}
      onBlur={stop}
    >
      <div className="card-media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={poster} alt="" loading="lazy" />
        <video ref={vid} className={on ? "on" : ""} src={video} muted loop playsInline preload="none" aria-hidden="true" />
        {badge && <span className="pill pill-solid card-badge">{badge}</span>}
      </div>
      <p className="card-cap">
        {artist}
        <span className="muted">{detail}</span>
      </p>
    </Link>
  );
}
