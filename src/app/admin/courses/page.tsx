"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, type Course } from "@/lib/api";

export default function AdminCoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("tm_token");
    if (!token) { router.replace("/login"); return; }
    const u = localStorage.getItem("tm_user");
    if (u) {
      const role = JSON.parse(u).role;
      if (role !== "admin" && role !== "superadmin") { router.replace("/"); return; }
    }
    api.courses().then(cs => setCourses(cs)).finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <header className="flex items-center gap-4 px-6 py-4"
              style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <Link href="/admin" className="text-sm flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          관리자
        </Link>
        <span style={{ color: "var(--border)" }}>│</span>
        <h1 className="font-bold">과목 관리</h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-6">
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          편집할 과목을 선택하세요. 비교표·강점·스크립트·FAQ를 수정할 수 있습니다.
        </p>
        <div className="space-y-2">
          {courses.map(c => (
            <Link key={c.id} href={`/admin/courses/${c.id}`}
                  className="flex items-center gap-4 px-5 py-4 rounded-xl transition hover:opacity-80"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <span className="text-2xl">{c.icon}</span>
              <div className="flex-1">
                <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{c.name}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{c.category}</p>
              </div>
              <span className="text-sm" style={{ color: "var(--accent)" }}>편집 →</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
