import Link from "next/link";

export function Logo() {
  return (
    <svg viewBox="0 0 28 32" aria-hidden="true">
      <path d="M0 3 14 0l14 3v20.5L14 32 0 23.5z" fill="#fff" />
      <path d="M8 9h3v5h6V9h3v14h-3v-6h-6v6H8z" fill="#050311" />
    </svg>
  );
}

export default function Nav() {
  return (
    <header className="nav">
      <Link href="/" className="nav-logo" aria-label="Headliner home">
        <Logo />
      </Link>
      <nav aria-label="Main">
        <ul className="nav-links">
          <li><Link href="/#tours">Tours</Link></li>
          <li><Link href="/#how">How it works</Link></li>
          <li><Link href="/plan?artist=Coldplay">Plan a tour</Link></li>
        </ul>
      </nav>
    </header>
  );
}
