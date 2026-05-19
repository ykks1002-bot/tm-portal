import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "에듀윌 TM 상담지원 포털",
  description: "TM 상담원을 위한 경쟁사 비교 및 자사 강점 분석 시스템",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
