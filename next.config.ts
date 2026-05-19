import type { NextConfig } from "next";

const isStatic  = process.env.NEXT_PUBLIC_STATIC === "true";
const basePath  = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // GitHub Pages: 정적 내보내기 / 로컬: 일반 서버
  output:        isStatic ? "export" : undefined,
  basePath,
  trailingSlash: isStatic,          // GitHub Pages 라우팅 호환
  images:        { unoptimized: true }, // 정적 내보내기 필수

  // 로컬 개발 전용: Next.js가 /api/* 를 백엔드로 프록시
  ...(isStatic ? {} : {
    async rewrites() {
      const backend = process.env.BACKEND_INTERNAL_URL ?? "http://backend:8000";
      return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
    },
  }),
};

export default nextConfig;
