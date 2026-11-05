import type { MetadataRoute } from 'next';
import { CHANGELOG } from './changelog/entries';
import { COMPARE_SLUGS } from './compare/data';

const SITE_URL = 'https://protovid.dasgroupllc.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const changelogLastModified = CHANGELOG[0]?.isoDate ? new Date(CHANGELOG[0].isoDate) : lastModified;
  return [
    ...['client-delivery', 'saas-walkthrough', 'portfolio-case-study'].map(slug => ({ url: `${SITE_URL}/guides/examples/${slug}`, lastModified, changeFrequency: 'monthly' as const, priority: 0.8 })),
    { url: `${SITE_URL}/guides/first-export`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/pricing`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/changelog`,
      lastModified: changelogLastModified,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    ...COMPARE_SLUGS.map(slug => ({
      url: `${SITE_URL}/compare/${slug}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
