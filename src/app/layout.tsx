import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "CaptionCraft — AI Captions for Every Platform",
  description:
    "Upload a screenshot and get 5 platform-optimized captions instantly. Instagram, LinkedIn, TikTok, Twitter/X, and Facebook — one click, five captions.",
  metadataBase: new URL("https://captioncraft.co"),
  openGraph: {
    title: "CaptionCraft — AI Captions for Every Platform",
    description:
      "Upload a screenshot and get 5 platform-optimized captions instantly. Built for creators.",
    type: "website",
    siteName: "CaptionCraft",
  },
  twitter: {
    card: "summary_large_image",
    title: "CaptionCraft — AI Captions for Every Platform",
    description:
      "One screenshot. Five platforms. Instant captions.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          {children}
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
