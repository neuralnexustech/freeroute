/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/v1/v1/:path*", destination: "/api/v1/:path*" },
      { source: "/v1/api/hello", destination: "/api/hello" },
      { source: "/v1/:path*", destination: "/api/v1/:path*" },
      { source: "/messages", destination: "/api/v1/messages" },
      { source: "/messages/:path*", destination: "/api/v1/messages/:path*" },
    ];
  },
};

export default nextConfig;
