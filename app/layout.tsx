import { headers } from "next/headers";
import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  // Marketing pages use system fonts; load monospace only when a page uses it.
  preload: false,
});

export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://time24.pro'),
  title: {
    template: '%s | time24',
    default: 'time24',
  },
  description:
    'A minimalist productivity workspace. Clear your mind, capture everything, and act with confidence.',
  verification: {
    google: '-ykNtkGbgrLvXlLyhT5I2IF-s511J4Ju1L9LMxDpHZ4',
  },
  openGraph: {
    type: 'website',
    siteName: 'time24',
    url: 'https://time24.pro',
    title: 'time24 — Your mind is for having ideas, not holding them.',
    description:
      'A minimalist productivity workspace. Clear your mind, capture everything, and act with confidence.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'time24' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'time24 — Your mind is for having ideas, not holding them.',
    description:
      'A minimalist productivity workspace. Clear your mind, capture everything, and act with confidence.',
    images: ['/og.png'],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistMono.variable} antialiased`}>
        <ThemeProvider nonce={nonce} attribute="class" defaultTheme="dark" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
