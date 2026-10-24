"use client";

import { useRef } from "react";
import VideoDialog, { type VideoDialogHandle } from "./VideoDialog";

function Letters({ text, start }: { text: string; start: number }) {
  return (
    <span className="word" aria-hidden="true">
      {text.split("").map((c, i) => (
        <span key={i} className="ch" style={{ "--i": start + i } as React.CSSProperties}>
          {c}
        </span>
      ))}
    </span>
  );
}

export function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 1.5v13L14 8z" fill="currentColor" />
    </svg>
  );
}

export default function HeroWordmark() {
  const dlg = useRef<VideoDialogHandle>(null);
  return (
    <>
      <h1 className="wordmark">
        <span className="sr-only">Headliner</span>
        <Letters text="Head" start={0} />
        <span className="emblem">
          <video
            src="/media/web/aerial-night.mp4"
            poster="/media/web/aerial-night.jpg"
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
          />
          <button type="button" className="emblem-hit" onClick={() => dlg.current?.open()} aria-label="Play the Headliner film" />
          <span className="play emblem-play" aria-hidden="true">
            <PlayIcon />
          </span>
        </span>
        <Letters text="liner" start={4} />
      </h1>
      <VideoDialog
        ref={dlg}
        src="/media/web/aerial-crowd.mp4"
        poster="/media/web/aerial-crowd.jpg"
        title="Headliner, the tour agent"
      />
    </>
  );
}
