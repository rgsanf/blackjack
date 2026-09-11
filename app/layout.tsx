import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Blackjack Odds Calculator",
  description:
    "Edit the dealer and player hands and see live win, push, loss and expected-value odds for a configurable shoe, with card counting.",
};

export const viewport: Viewport = {
  // The app commits to a single dark look; declaring it lets the browser render native
  // controls, scrollbars and default focus rings to match.
  colorScheme: "dark",
  themeColor: "#06241a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
