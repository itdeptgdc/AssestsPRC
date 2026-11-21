/** @type {import('next').NextConfig} */
// All /api and /uploads requests are proxied to the Express backend,
// so the browser only ever talks to one origin (no CORS, works behind one domain).
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

module.exports = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${BACKEND_URL}/api/:path*` },
      { source: '/uploads/:path*', destination: `${BACKEND_URL}/uploads/:path*` },
    ];
  },
};
