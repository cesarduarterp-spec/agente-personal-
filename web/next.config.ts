import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone', // imagen Docker mínima
  poweredByHeader: false,
  async headers() {
    return [
      {
        // El service worker debe poder controlar todo el sitio y no quedar cacheado
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
