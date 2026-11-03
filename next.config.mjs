/** @type {import('next').NextConfig} */
const isDevelopment = process.env.NODE_ENV !== 'production';

const csp = [
  "default-src 'self'",
  // Next.js hydrates pages with inline bootstrap scripts. `unsafe-inline` is
  // required unless the app is moved to a nonce-based CSP. React Fast Refresh
  // needs eval during development only.
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDevelopment ? ' ws: wss:' : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // The app uses emoji icons rather than next/image. Disabling the optimizer
  // removes an unnecessary remote attack surface on this pinned Next version.
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      // Server actions only receive small forms. Cap the body size to reduce
      // the impact of oversized-payload denial-of-service attempts.
      bodySizeLimit: '1mb',
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
