import type { NextConfig } from "next";

const isStatic  = process.env.NEXT_PUBLIC_STATIC === "true";
// GitHub Pages 빌드 시에만 output:export 적용 (로컬 dev에서는 일반 서버 모드)
const isExport  = isStatic && process.env.NEXT_PUBLIC_BASE_PATH !== undefined
                           && process.env.NEXT_PUBLIC_BASE_PATH !== "";
const basePath  = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output:        isExport ? "export" : undefined,
  basePath,
  trailingSlash: isExport,
  images:        { unoptimized: true },

  // 도커 모드: /api/* 를 백엔드로 프록시 (정적 모드에서는 불필요)
  ...(isStatic ? {} : {
    async rewrites() {
      const backend = process.env.BACKEND_INTERNAL_URL ?? "http://backend:8000";
      return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
    },
  }),
};

export default nextConfig;
