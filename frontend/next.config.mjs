/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only enable standalone mode if explicitly requested (e.g., Docker container build)
  ...(process.env.BUILD_STANDALONE === 'true' ? { output: 'standalone' } : {}),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    const ms1Url = process.env.MS1_URL || process.env.NEXT_PUBLIC_MS1_URL || 'http://localhost:3001';
    const ms2Url = process.env.MS2_URL || process.env.NEXT_PUBLIC_MS2_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${ms1Url}/api/:path*`,
      },
      {
        source: '/speech/:path*',
        destination: `${ms2Url}/speech/:path*`,
      },
    ];
  },
};

export default nextConfig;

