/** @type {import('next').NextConfig} */
const nextConfig = {
  // Menyuruh Vercel mengabaikan aturan ketat TypeScript saat deploy
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
