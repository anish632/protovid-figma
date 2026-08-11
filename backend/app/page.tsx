import type { Metadata } from 'next';
import MarketingLanding from './MarketingLanding';

export const metadata: Metadata = {
  title: 'Figma Prototype Review Walkthroughs — ProtoVid',
  description: 'Turn a connected Figma prototype flow into an MP4 walkthrough, share one browser review link, and collect timestamped feedback and approval.',
  alternates: {
    canonical: 'https://protovid.dasgroupllc.com/',
  },
  openGraph: {
    title: 'Review Figma Prototype Flows Without Screen Recording — ProtoVid',
    description: 'Export a connected flow, send one browser link, and collect timestamped feedback and approval.',
    url: 'https://protovid.dasgroupllc.com/',
    type: 'website',
    images: [{
      url: 'https://protovid.dasgroupllc.com/logo128x128.png',
      alt: 'ProtoVid logo',
    }],
  },
  twitter: {
    card: 'summary',
    title: 'Figma Prototype Review Walkthroughs — ProtoVid',
    description: 'Export a connected flow, send one browser link, and collect timestamped feedback and approval.',
  },
};

export default function Home() {
  return <MarketingLanding />;
}
