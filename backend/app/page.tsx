import type { Metadata } from 'next';
import MarketingLanding from './MarketingLanding';

export const metadata: Metadata = {
  metadataBase: new URL('https://protovid.dasgroupllc.com'),
  title: 'Turn Figma Frames into Client Walkthrough Videos — ProtoVid',
  description: 'Connect unlinked Figma frames in one click and export a client-ready walkthrough video. Free to start; self-serve plans from $4.',
  keywords: [
    'Figma prototype to video',
    'export Figma prototype to MP4',
    'Figma prototype to product demo video',
    'Figma prototype to GIF',
    'Figma prototype to WebM',
    'Figma demo video plugin',
    'prototype walkthrough video',
    'Figma prototype review tool',
    'export Figma prototype',
    'product demo video maker',
  ],
  applicationName: 'ProtoVid',
  authors: [{ name: 'Das Group', url: 'https://dasgroupllc.com' }],
  creator: 'Das Group',
  publisher: 'Das Group',
  category: 'DesignApplication',
  alternates: {
    canonical: 'https://protovid.dasgroupllc.com/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    title: 'Turn Figma Frames into Client Walkthrough Videos — ProtoVid',
    description: 'Connect unlinked Figma frames in one click, then export a client-ready MP4, WebM, or GIF walkthrough without screen recording.',
    url: 'https://protovid.dasgroupllc.com/',
    siteName: 'ProtoVid',
    type: 'website',
    locale: 'en_US',
    images: [{
      url: 'https://protovid.dasgroupllc.com/logo128x128.png',
      width: 128,
      height: 128,
      alt: 'ProtoVid logo',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Turn Figma Frames into Client Walkthrough Videos — ProtoVid',
    description: 'Connect unlinked Figma frames in one click, then export a client-ready video without screen recording.',
    images: ['https://protovid.dasgroupllc.com/logo128x128.png'],
  },
};

export default function Home() {
  return <MarketingLanding />;
}
