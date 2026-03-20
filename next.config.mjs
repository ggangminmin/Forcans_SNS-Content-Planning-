/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // 로컬 개발 환경에서만 Express 서버(3001)로 프록시
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:3001/api/:path*',
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
