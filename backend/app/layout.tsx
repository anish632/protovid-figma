import './landing.css';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

export const metadata = {
  title: 'ProtoVid — Figma Frames to Client Walkthrough Videos',
  description: 'Connect unlinked Figma frames in one click and export a client-ready walkthrough video. Start free.',
  metadataBase: new URL('https://protovid.dasgroupllc.com'),
  openGraph: {
    title: 'ProtoVid — Turn Figma Frames into Client Walkthroughs',
    description: 'Connect unlinked Figma frames in one click and export a client-ready walkthrough without screen recording.',
    url: 'https://protovid.dasgroupllc.com',
    siteName: 'ProtoVid',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}<Analytics /><SpeedInsights /></body></html>;
}
