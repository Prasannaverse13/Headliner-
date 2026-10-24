"use client";

import { useEffect, useId, useRef, useState } from "react";

type Hit = { name: string; type: "artist" | "person" | "podcast" | "brand"; description: string; image: string | null };

const KIND_LABEL: Record<Hit["type"], string> = {
  artist: "Artist or band",
  person: "Comedian, actor or public figure",
  podcast: "Podcast",
  brand: "Team or brand",
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (artist: string) => void;
  placeholder?: string;
  buttonLabel?: string;
  inputClassName?: string;
};

/** Search box with type-ahead over Qloo's catalogue, so any artist, band or comedian worldwide can be picked. */
export default function ArtistSearch({ value, onChange, onSubmit, placeholder = "Who is going on tour?", buttonLabel = "Plan tour", inputClassName = "" }: Props) {
  const id = useId();
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const typed = useRef(false); // only suggest after the user types, not when the page sets the value

  useEffect(() => {
    if (!typed.current) return;
    const q = value.trim();
    if (q.length < 2) {
      setHits([]);
      setOpen(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const j = (await r.json()) as { results?: Hit[] };
        setHits(j.results ?? []);
        setOpen(true);
        setActive(-1);
      } catch {
        /* aborted or offline: keep the typed text, the plan still runs on Enter */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value]);

  useEffect(() => {
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const pick = (name: string) => {
    typed.current = false;
    onChange(name);
    setOpen(false);
    onSubmit(name);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open || !hits.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? hits.length - 1 : a - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(hits[active].name);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="combo" ref={box}>
      <form
        className="search-row"
        onSubmit={(e) => {
          e.preventDefault();
          setOpen(false);
          if (value.trim()) onSubmit(value.trim());
        }}
      >
        <label className="sr-only" htmlFor={`${id}-in`}>Artist, comedian, team or podcast</label>
        <input
          id={`${id}-in`}
          className={`input ${inputClassName}`}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            typed.current = true;
            onChange(e.target.value);
          }}
          onKeyDown={onKey}
          onFocus={() => hits.length && setOpen(true)}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${id}-o${active}` : undefined}
        />
        <button className="btn" type="submit">{buttonLabel}</button>
      </form>

      {open && (
        <ul className="combo-list" id={`${id}-list`} role="listbox">
          {hits.length === 0 && !loading && <li className="combo-empty">No match. Press Enter to try the name anyway.</li>}
          {hits.map((h, i) => (
            <li key={h.name} id={`${id}-o${i}`} role="option" aria-selected={i === active}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(h.name)} className={i === active ? "on" : ""}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {h.image ? <img src={h.image} alt="" width={36} height={36} loading="lazy" /> : <span className="combo-ph" />}
                <span className="combo-t">
                  {h.name}
                  <small>{h.description || KIND_LABEL[h.type]}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

