import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "COALA Mahjong Leaderboard",
  description: "Do you have the luck in COALA's mahjong tables? Record your wins and stream through your peers here!",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b3d2e"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
    >
      <body className="min-h-screen text-stone-100 antialiased">{children}</body>
    </html>
  );
}
