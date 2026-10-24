import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

// Stand-in for FKGroteskNeue. One weight only, as in the design system.
const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Headliner",
  description:
    "Type an artist and watch a 3D Earth light up with the best tour, built from real taste data.",
};

export const viewport: Viewport = {
  themeColor: "#050311",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={grotesk.variable}>
      <body>{children}</body>
    </html>
  );
}
