/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    agentUpgrade: 'security',
  },
  async rewrites() {
    return [
      { source: '/flexprint', destination: '/flexprint/index.html' },
      { source: '/admin', destination: '/edit-page-content.html' },
    ]
  },
  async redirects() {
    return [
      { source: '/about/plan', destination: '/about/Flex-Vision_Business_Plan_2026-2030.pdf', permanent: false },
    ]
  },
}

export default nextConfig
