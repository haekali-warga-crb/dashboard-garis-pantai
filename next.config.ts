/** @type {import('next').NextConfig} */
const nextConfig = {
  // Menyuruh Vercel mengabaikan aturan ketat TypeScript saat deploy
  typescript: {
    ignoreBuildErrors: true,
  },
  // Menyuruh Vercel mengabaikan aturan linter saat deploy
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
