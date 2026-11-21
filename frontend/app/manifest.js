// Web App Manifest — makes Asset PRC installable as an app (Android / desktop Chrome & Edge / iOS home screen)
export default function manifest() {
  return {
    name: 'Asset PRC — Poipet Resort & Casino',
    short_name: 'Asset PRC',
    description: 'Asset registry, QR labels, inspections and repair tracking',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f1424',
    theme_color: '#4f46e5',
    lang: 'th',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Scan QR', short_name: 'Scan', url: '/scan', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Asset Register', short_name: 'Assets', url: '/assets', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Repair Jobs', short_name: 'Repairs', url: '/repairs', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
