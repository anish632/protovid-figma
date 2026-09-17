import type { Metadata } from 'next';
import MarketingLanding from './MarketingLanding';

export const metadata: Metadata = {
  metadataBase: new URL('https://protovid.dasgroupllc.com'),
  title: 'Figma Prototype to Product Demo Video — ProtoVid',
  description: 'Turn a connected Figma prototype into a polished demo, invite unlimited reviewers, and capture approval. Free to start; self-serve Studio from $5/month.',
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
    title: 'Figma Prototype to Product Demo Video — ProtoVid',
    description: 'Export a clean product demo from a connected Figma prototype flow without screen recording or video editing. MP4, WebM, and GIF output with optional review rooms.',
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
    card: 'summary',
    title: 'Figma Prototype to Product Demo Video — ProtoVid',
    description: 'Export a clean product demo from a connected Figma prototype flow without screen recording or video editing.',
    images: ['https://protovid.dasgroupllc.com/logo128x128.png'],
  },
};

export default function Home() {
  return <MarketingLanding />;
}
