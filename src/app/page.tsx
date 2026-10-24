import Link from "next/link";
import Nav from "@/components/Nav";
import HeroWordmark from "@/components/HeroWordmark";
import SearchBar from "@/components/SearchBar";
import WorkCard from "@/components/WorkCard";
import ReelLink from "@/components/ReelLink";

const TOURS = [
  { artist: "Kendrick Lamar", detail: "Hip-hop world arena run", v: "live-stage", badge: "Music" },
  { artist: "Dave Chappelle", detail: "Comedy theatre run", v: "crowd-people", badge: "Comedy" },
  { artist: "Chelsea F.C.", detail: "Preseason world tour with friendly opponents", v: "aerial-crowd", badge: "Sports" },
  { artist: "A. R. Rahman", detail: "Worldwide concert tour", v: "outdoor-stage", badge: "Music" },
];

const STEPS: [string, string][] = [
  ["Fan taste profile", "What else fans love: music, film, food, fashion, brands and podcasts."],
  ["Untapped cities", "Places with high taste demand and no show planned yet."],
  ["Best support slot", "An opener for an act, a friendly opponent for a team. Picked by audience overlap, not by genre label."],
  ["Venues and route", "Real venues that suit the show size, and the shortest route with dates between them."],
  ["Sponsor matches", "Local and global brands whose fans look like yours."],
  ["VIP and fan plan", "Food, bars and venues near each show that fit the crowd."],
  ["Why this city", "Every pick shows its score and the reason behind it."],
];

const MADE_FOR: [string, string][] = [
  ["Live events and venues", "Find the cities and venues that fit an act, and route the whole tour."],
  ["Sports clubs and leagues", "Plan a preseason world tour with stadiums, friendly opponents and sponsors."],
  ["Comedy and entertainment", "Take a comedian, an actor or a show on the road, with theatres that suit it."],
  ["Podcasts and creators", "Find where listeners are, and the venues for live recordings."],
  ["Brands and sponsors", "See which brands match the fans in each city before you pitch."],
];

const UNDER_THE_HOOD: [string, string][] = [
  ["Search", "Qloo /search finds any act, team or podcast in its catalogue."],
  ["Openers and opponents", "Qloo /v2/insights, same entity type: related entities ranked by affinity."],
  ["City demand", "Qloo /v2/insights on places near each of 99 cities: mean fan affinity."],
  ["Venues", "Qloo /v2/insights on places filtered by venue tags such as arena and concert hall."],
  ["Heat layer", "Qloo heatmap results around each stop."],
  ["Sponsors and fans also love", "Qloo /v2/insights for brands, movies, shows and podcasts."],
  ["The AI model", "Writes copy and checks venues using only the Qloo data it is given. Anything from its own knowledge is labelled."],
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

      <section className="rows" id="for">
        <h2 className="rows-head">Made for anyone who puts a show on the road.</h2>
        <ul>
          {MADE_FOR.map(([title, body]) => (
            <li key={title} className="row">
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rows" id="hood">
        <h2 className="rows-head">Powered by Qloo. Labelled where the AI adds its own knowledge.</h2>
        <ul>
          {UNDER_THE_HOOD.map(([title, body]) => (
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
