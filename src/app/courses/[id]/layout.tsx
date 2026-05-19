// generateStaticParams는 서버 컴포넌트에서만 사용 가능
// layout.tsx에서 내보내면 같은 경로의 모든 페이지에 적용됨
export function generateStaticParams() {
  return Array.from({ length: 20 }, (_, i) => ({ id: String(i + 1) }));
}

export default function CourseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
