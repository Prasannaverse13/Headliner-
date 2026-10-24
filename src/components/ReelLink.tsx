import Link from "next/link";
import { PlayIcon } from "./HeroWordmark";

export default function ReelLink() {
  return (
    <Link href="/plan?artist=Coldplay" className="reel" aria-label="Watch Headliner plan a Coldplay tour">
      <video src="/media/web/outdoor-stage.mp4" poster="/media/web/outdoor-stage.jpg" autoPlay muted loop playsInline aria-hidden="true" />
      <div className="reel-ui">
        <span className="play"><PlayIcon /></span>
        <span className="reel-title">Watch it plan a tour</span>
        <span className="muted">Coldplay, 10 stops, about 12 seconds</span>
      </div>
    </Link>
  );
}
