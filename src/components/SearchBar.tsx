"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SUGGESTION_GROUPS } from "@/lib/demo";
import ArtistSearch from "./ArtistSearch";

export default function SearchBar() {
  const router = useRouter();
  const [value, setValue] = useState("");

  const go = (artist: string) => {
    const q = artist.trim();
    if (q) router.push(`/plan?artist=${encodeURIComponent(q)}`);
  };

  return (
    <div className="search">
      <ArtistSearch value={value} onChange={setValue} onSubmit={go} placeholder="Who or what is going on tour?" />
      <div className="chip-groups">
        {SUGGESTION_GROUPS.map((g) => (
          <div key={g.label} className="chips">
            <span className="chip-label">{g.label}</span>
            {g.items.map((s) => (
              <button key={s} type="button" className="pill" onClick={() => go(s)}>
                {s}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
