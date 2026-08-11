import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@ffmpeg-installer/ffmpeg'],
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, x-user-email, x-anonymous-id, x-filename, x-resolution, x-frame-count, x-start-frame-name, x-end-frame-name, x-estimated-duration-seconds, x-share-experiment-variant' },
        ],
      },
    ];
  },
};

export default nextConfig;
