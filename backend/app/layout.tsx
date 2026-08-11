import './landing.css';

export const metadata = {
  title: 'ProtoVid — Figma Prototype Review Walkthroughs',
  description: 'Turn connected Figma prototype flows into MP4 walkthroughs with browser-based timestamped feedback and approval. Start free.',
  metadataBase: new URL('https://protovid.dasgroupllc.com'),
  openGraph: {
    title: 'ProtoVid — Review Figma prototype flows without screen recording',
    description: 'Export a connected Figma flow, send one browser link, and collect timestamped feedback and approval.',
    url: 'https://protovid.dasgroupllc.com',
    siteName: 'ProtoVid',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
