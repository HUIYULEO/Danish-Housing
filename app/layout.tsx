import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const sans = Archivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

// All numbers are monospaced, so they do not jitter sideways when the timeline is dragged
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Danish Housing — see what is happening in Danish real estate",
  description:
    "Quarterly prices, selling times, transaction volume and supply for all 98 Danish kommuner and 605 postal districts since 1992, from Finans Danmark and Danmarks Statistik.",
  openGraph: {
    title: "Danish Housing",
    description: "See what is happening in Danish real estate.",
    type: "website",
    siteName: "Danish Housing",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable}`}
      // The inline script below adds data-theme to <html> before React takes
      // over. The server-rendered HTML lacks that attribute, so React would
      // report a hydration mismatch. That is exactly the price of "set the
      // theme before painting" and is expected, so this one warning is
      // suppressed.
      suppressHydrationWarning
    >
      <head>
        {/* Must run before first paint, or anyone who chose dark gets a white
            flash on every load. If localStorage cannot be read (private
            mode), do nothing and fall back to following the system. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var c=localStorage.getItem('dkh-theme');if(c==='light'||c==='dark')document.documentElement.setAttribute('data-theme',c);}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
