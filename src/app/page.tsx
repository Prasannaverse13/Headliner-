import Link from "next/link";
import Nav from "@/components/Nav";
import HeroWordmark from "@/components/HeroWordmark";
import SearchBar from "@/components/SearchBar";
import WorkCard from "@/components/WorkCard";
import ReelLink from "@/components/ReelLink";

const TOURS = [
  { artist: "Kendrick Lamar", detail: "Hip-hop arena run, 10 stops", v: "live-stage", badge: "Sample" },
  { artist: "Dave Chappelle", detail: "Comedy theatre run, 12 cities", v: "crowd-people", badge: "Sample" },
  { artist: "Coldplay", detail: "Stadium run, 20 stops", v: "aerial-crowd", badge: "Sample" },
  { artist: "Your artist", detail: "Type any name to start", v: "crowd-lights" },
];

const STEPS: [string, string][] = [
  ["Fan taste profile", "What else fans love: music, film, food, fashion, brands and podcasts."],
  ["Untapped cities", "Places with high taste demand and no show planned yet."],
  ["Best opener", "Picked by how much the two audiences overlap, not by genre label."],
  ["Sponsor matches", "Local and global brands whose fans look like yours."],
  ["VIP and fan plan", "Food, bars and venues near each show that fit the crowd."],
  ["City ad copy", "Written from what people in that city actually love."],
  ["Why this city", "Every pick shows its score and the reason behind it."],
];

const CATEGORIES = ["Music", "Film", "Food", "Fashion", "Brands", "Podcasts", "Nightlife", "Travel", "Sport", "Books"];

export default function Home() {
  return (
    <main>
      <section className="hero">
        <video className="hero-bg" src="/media/web/crowd-lights.mp4" poster="/media/web/crowd-lights.jpg" autoPlay muted loop playsInline aria-hidden="true" />
        <Nav />
        <HeroWordmark />
        <div className="hero-intro" id="start">
          <p className="lead">
            Promoters guess where to tour. Headliner shows where fans really are, who should open,
            and who should sponsor.
          </p>
          <SearchBar />
        </div>
        <div className="hero-foot">
          <span>An AI tour planner powered by Qloo Taste AI</span>
          <span>Scroll to see sample tours</span>
        </div>
      </section>

      <section id="tours" aria-label="Sample tours">
        <div className="grid">
          {TOURS.map((t) => (
            <WorkCard
              key={t.artist}
              artist={t.artist}
              detail={t.detail}
              video={`/media/web/${t.v}.mp4`}
              poster={`/media/web/${t.v}.jpg`}
              badge={t.badge}
            />
          ))}
        </div>
        <p className="grid-note">Sample plans. Footage is stock and does not show these artists.</p>
      </section>

      <section className="rows" id="how">
        <h2 className="rows-head">One name in. A full tour plan out.</h2>
        <ul>
          {STEPS.map(([title, body]) => (
            <li key={title} className="row">
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <ReelLink />

      <section className="light">
        <p className="light-head">Built on what people love, not what they bought last year.</p>
        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            {[...CATEGORIES, ...CATEGORIES].map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </div>
        </div>
        <div className="light-cols">
          <p className="muted">
            For promoters
            <br />
            Agents and venues
          </p>
          <div>
            <p>
              Past ticket sales only show where an act already plays. Headliner uses Qloo&apos;s
              taste graph to find the cities that want a show and have not had one. Sponsors,
              openers and local marketing come from the same data, in one view.
            </p>
            <Link className="btn btn-dark" href="/plan?artist=Kendrick%20Lamar">
              Plan a tour &#8599;
            </Link>
          </div>
        </div>
        <span className="foot-word" aria-hidden="true">Headliner</span>
        <div className="foot-bar">
          <span>
            Built for the Qloo Agentic Hackathon. Earth textures by Solar System Scope, CC BY 4.0, from NASA imagery.
          </span>
          <a href="#start">&#8593; Back to top</a>
        </div>
      </section>
    </main>
  );
}
