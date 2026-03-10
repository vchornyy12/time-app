import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Script from "next/script";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          id="gtm-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-NTSJ3HQS');`,
          }}
        />
      </head>
      <body className={`${geistMono.variable} antialiased`}>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-NTSJ3HQS"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
