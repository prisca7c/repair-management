/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Without this, Next.js's client-side router cache can serve a stale
    // copy of a dynamic page (e.g. the dashboard) for up to 30s after
    // navigating away and back — which looked like "my new repair isn't on
    // the dashboard unless I search for it" (search hits a different URL,
    // so it bypasses the stale cache and always sees fresh data).
    staleTimes: {
      dynamic: 0,
    },
  },
};

export default nextConfig;
