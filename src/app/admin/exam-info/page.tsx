"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, type ExamSchedule, type EmploymentStat } from "@/lib/api";

const isStatic = () =>
  typeof window !== "undefined" &&
  (window.location.hostname.includes("github.io") ||
    process.env.NEXT_PUBLIC_STATIC === "true");

const COURSES = [
  { id: 1, name: "공인중개사", icon: "🏠" },
  { id: 2, name: "주택관리사", icon: "🏢" },
  { id: 3, name: "행정사",    icon: "📋" },
  { id: 4, name: "사회복지사1급", icon: "❤️" },
  { id: 5, name: "검정고시",  icon: "📚" },
  { id: 6, name: "경비지도사", icon: "🛡️" },
  { id: 7, name: "전기기사",  icon: "⚡" },
  { id: 8, name: "소방설비기사", icon: "🔥" },
  { id: 9, name: "9급공무원", icon: "🏛️" },
  { id: 10, name: "계리직공무원", icon: "📊" },
  { id: 11, name: "손해평가사", icon: "📝" },
];

type EditTarget = { type: "exam"; courseId: number; data: ExamSchedule } | { type: "employment"; courseId: number; data: EmploymentStat };

export default function AdminExamInfoPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"exam" | "employment">("exam");
  const [examData, setExamData] = useState<Record<number, ExamSchedule[]>>({});
  const [empData, setEmpData]   = useState<Record<number, EmploymentStat | null>>({});
  const [loading, setLoading]   = useState(true);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editJson, setEditJson] = useState("");
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState("");

  useEffect(() => {
    const token = localStorage.getItem("tm_token");
    if (!token) { router.replace("/login"); return; }
    const u = localStorage.getItem("tm_user");
    if (u) {
      const role = JSON.parse(u).role;
      if (role !== "admin" && role !== "superadmin") { router.replace("/"); return; }
    }
    loadAll();
  }, [router]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const examMap: Record<number, ExamSchedule[]> = {};
    const empMap:  Record<number, EmploymentStat | null> = {};
    await Promise.all(COURSES.map(async c => {
      examMap[c.id] = await api.examSchedules(c.id).catch(() => []);
      empMap[c.id]  = await api.employmentStat(c.id).catch(() => null);
    }));
    setExamData(examMap);
    setEmpData(empMap);
    setLoading(false);
  }, []);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const openEdit = (target: EditTarget) => {
    setEditTarget(target);
    setEditJson(JSON.stringify(target.data, null, 2));
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const parsed = JSON.parse(editJson);
      if (isStatic()) {
        // 정적 모드: JSON 다운로드
        const fileName = editTarget.type === "exam"
          ? `course-${editTarget.courseId}-exam.json`
          : `course-${editTarget.courseId}-employment.json`;
        const content = editTarget.type === "exam" ? JSON.stringify([parsed], null, 2) : JSON.stringify(parsed, null, 2);
        const blob = new Blob([content], { type: "application/json" });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a"); a.href = url; a.download = fileName; a.click();
        flash(`${fileName} 다운로드 완료 — public/data/ 에 넣고 배포하세요`);
      } else {
        if (editTarget.type === "exam") {
          await api.updateExamSchedule(parsed.id, parsed);
        } else {
          await api.updateEmploymentStat(parsed.id, parsed);
        }
        flash("저장 완료");
        loadAll();
      }
      setEditTarget(null);
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : "오류 발생");
    } finally {
      setSaving(false);
    }
  };

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
          </svg>관리자
        </Link>
        <span style={{ color: "var(--border)" }}>│</span>
        <h1 className="font-bold">시험 정보 / 취업 전망 관리</h1>
        {isStatic() && (
          <span className="ml-2 text-xs px-2 py-0.5 rounded-full"
                style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A" }}>
            정적 모드 — 수정 후 JSON 다운로드
          </span>
        )}
        {msg && (
          <span className="ml-auto text-sm px-3 py-1 rounded-lg"
                style={{ background: "rgba(34,197,94,0.12)", color: "var(--success)", border: "1px solid rgba(34,197,94,0.3)" }}>
            {msg}
          </span>
        )}
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-6">
        {/* 탭 */}
        <div className="flex gap-1 mb-6" style={{ borderBottom: "1px solid var(--border)" }}>
          {([["exam", "📅 시험 일정"], ["employment", "📈 취업 전망"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)}
                    className="px-5 py-3 text-sm font-medium border-b-2 transition"
                    style={{ borderColor: activeTab === id ? "var(--accent)" : "transparent",
                             color: activeTab === id ? "var(--accent)" : "var(--text-muted)" }}>
              {label}
            </button>
          ))}
        </div>

        {/* 시험 일정 목록 */}
        {activeTab === "exam" && (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: "var(--surface2)" }}>
                  {["과목", "회차", "접수 기간", "시험일", "합격발표", "주관", ""].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COURSES.map(c => {
                  const scheds = examData[c.id] ?? [];
                  if (!scheds.length) return (
                    <tr key={c.id} style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
                      <td className="px-3 py-2.5 text-sm">{c.icon} {c.name}</td>
                      <td colSpan={5} className="px-3 py-2.5 text-xs" style={{ color: "var(--text-muted)" }}>데이터 없음</td>
                      <td className="px-3 py-2.5"></td>
                    </tr>
                  );
                  return scheds.map((s, i) => (
                    <tr key={`${c.id}-${i}`} style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
                      {i === 0 && <td className="px-3 py-2.5 text-sm font-medium" rowSpan={scheds.length} style={{ color: "var(--text)" }}>{c.icon} {c.name}</td>}
                      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{s.round_label}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--text-muted)" }}>
                        {s.written_reg_start && `${s.written_reg_start}~${s.written_reg_end}`}
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--text)" }}>{s.written_exam_date}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--text-muted)" }}>{s.written_result_date}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--text-muted)" }}>{s.organizer}</td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => openEdit({ type: "exam", courseId: c.id, data: s })}
                                className="text-xs px-2.5 py-1 rounded-lg"
                                style={{ background: "rgba(79,127,255,0.1)", color: "var(--accent)", border: "1px solid rgba(79,127,255,0.25)" }}>
                          편집
                        </button>
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 취업 전망 목록 */}
        {activeTab === "employment" && (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: "var(--surface2)" }}>
                  {["과목", "종사자 수", "평균 임금", "고용 전망", "기준연도", ""].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COURSES.map(c => {
                  const emp = empData[c.id];
                  const outlookColor = { 증가: "#16A34A", 다소증가: "#1D4ED8", 유지: "#92400E", 다소감소: "#C2410C", 감소: "#DC2626" };
                  return (
                    <tr key={c.id} style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
                      <td className="px-3 py-2.5 text-sm font-medium" style={{ color: "var(--text)" }}>{c.icon} {c.name}</td>
                      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{emp?.worker_count ?? "—"}</td>
                      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{emp?.avg_wage ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        {emp?.employment_outlook ? (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                style={{ color: outlookColor[emp.employment_outlook as keyof typeof outlookColor] ?? "var(--text)",
                                         background: "rgba(0,0,0,0.05)" }}>
                            {emp.employment_outlook}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--text-muted)" }}>{emp?.stat_year ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        {emp && (
                          <button onClick={() => openEdit({ type: "employment", courseId: c.id, data: emp })}
                                  className="text-xs px-2.5 py-1 rounded-lg"
                                  style={{ background: "rgba(79,127,255,0.1)", color: "var(--accent)", border: "1px solid rgba(79,127,255,0.25)" }}>
                            편집
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* 편집 모달 */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden"
               style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="px-5 py-4 flex items-center justify-between"
                 style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="font-bold text-sm" style={{ color: "var(--text)" }}>
                {editTarget.type === "exam" ? "시험 일정 편집" : "취업 전망 편집"}
                {isStatic() && <span className="ml-2 text-xs font-normal" style={{ color: "var(--text-muted)" }}>— 저장 시 JSON 파일 다운로드됩니다</span>}
              </h2>
              <button onClick={() => setEditTarget(null)} style={{ color: "var(--text-muted)" }}>✕</button>
            </div>
            <div className="p-5">
              <textarea
                value={editJson}
                onChange={e => setEditJson(e.target.value)}
                rows={20}
                className="w-full text-xs px-3 py-2.5 rounded-xl outline-none resize-y font-mono"
                style={{ background: "var(--surface2)", border: "1.5px solid var(--accent)", color: "var(--text)" }}
              />
            </div>
            <div className="px-5 pb-5 flex gap-3 justify-end">
              <button onClick={() => setEditTarget(null)}
                      className="text-sm px-4 py-2 rounded-lg"
                      style={{ background: "var(--surface2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                취소
              </button>
              <button onClick={saveEdit} disabled={saving}
                      className="text-sm px-5 py-2 rounded-lg font-bold disabled:opacity-50"
                      style={{ background: "var(--accent)", color: "white" }}>
                {saving ? "처리 중..." : isStatic() ? "JSON 다운로드" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
