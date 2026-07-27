/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only enable standalone mode if explicitly requested (e.g., Docker container build)
  ...(process.env.BUILD_STANDALONE === 'true' ? { output: 'standalone' } : {}),
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    // In production (Vercel), route all backend calls to the EC2 HTTPS endpoint.
    // In local dev, fall back to localhost ports.
    const ms1Url =
      process.env.MS1_URL ||
      process.env.NEXT_PUBLIC_MS1_URL ||
      (process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : 'https://englishx-app.duckdns.org');

    const ms2Url =
      process.env.MS2_URL ||
      process.env.NEXT_PUBLIC_MS2_URL ||
      (process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : 'https://englishx-app.duckdns.org');

    return [
      {
        // All /api/* calls → ms1-core-api via NGINX
        source: '/api/:path*',
        destination: `${ms1Url}/api/:path*`,
      },
      {
        // All /speech/* calls → ms2-speech-agent via NGINX
        source: '/speech/:path*',
        destination: `${ms2Url}/speech/:path*`,
      },
    ];
  },
};

export default nextConfig;
