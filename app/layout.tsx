import type { Metadata, Viewport } from "next";
import { Momo_Trust_Display, Momo_Trust_Sans } from "next/font/google";
import "./globals.css";

const display = Momo_Trust_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-momo-display",
  display: "swap",
});

const sans = Momo_Trust_Sans({
  subsets: ["latin"],
  variable: "--font-momo-sans",
  display: "swap"
});


export const metadata: Metadata = {
  title: "COALA Mahjong Leaderboard",
  description: "Do you have the luck in COALA's mahjong tables? Record your wins and stream through your peers here!",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e3d30"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en" className={`${display.variable} ${sans.variable}`}
    >
      <body className="min-h-screen font-sans text-stone-100 antialiased">{children}</body>
    </html>
  );
}
