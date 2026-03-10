import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/privacy', '/terms'],
      disallow: ['/inbox', '/next-actions', '/waiting-for', '/calendar', '/someday', '/notes', '/trash', '/projects', '/weekly-review', '/analytics', '/settings', '/api/', '/auth/'],
    },
  }
}
