import type { MetadataRoute } from 'next';

const SITE_URL = 'https://protovid.dasgroupllc.com';

// AI answer/generative engines are explicitly allowed so ProtoVid can be
// cited by them (GEO/AEO). Private and machine-only paths stay disallowed.
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Bytespider',
  'Amazonbot',
  'cohere-ai',
];

export default function robots(): MetadataRoute.Robots {
  const disallow = ['/api/', '/account/', '/success/', '/r/', '/share/'];
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: '/', disallow })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
