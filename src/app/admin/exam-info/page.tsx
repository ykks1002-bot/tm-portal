"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, isStatic, ssKey, type ExamSchedule, type EmploymentStat } from "@/lib/api";

const COURSES = [
  { id: 1,  name: "공인중개사",   icon: "🏠" },
  { id: 2,  name: "주택관리사",   icon: "🏢" },
  { id: 3,  name: "행정사",       icon: "📋" },
  { id: 4,  name: "사회복지사1급", icon: "❤️" },
  { id: 5,  name: "검정고시",     icon: "📚" },
  { id: 6,  name: "경비지도사",   icon: "🛡️" },
  { id: 7,  name: "전기기사",     icon: "⚡" },
  { id: 8,  name: "소방설비기사", icon: "🔥" },
  { id: 9,  name: "9급공무원",    icon: "🏛️" },
  { id: 10, name: "계리직공무원", icon: "📊" },
  { id: 11, name: "손해평가사",   icon: "📝" },
];

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 items-start gap-3">
      <label className="text-xs font-medium pt-2" style={{ color: "var(--text-muted)" }}>{label}</label>
      <div className="col-span-2">{children}</div>
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
           placeholder={placeholder}
           className="w-full rounded-lg px-3 py-1.5 text-sm outline-none"
           style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
              rows={rows} className="w-full rounded-lg px-3 py-1.5 text-xs outline-none resize-y font-mono"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
  );
}

// ── 시험 일정 편집 폼 ─────────────────────────────────────────────────────────
function ExamScheduleFormModal({ courseId, data, onSave, onClose }: {
  courseId: number; data: ExamSchedule; onSave: (d: ExamSchedule) => void; onClose: () => void;
}) {
  const [form, setForm] = useState<ExamSchedule>({ ...data });
  const set = (k: keyof ExamSchedule) => (v: string) => setForm(prev => ({ ...prev, [k]: v || undefined }));

  return (
    <div className="p-5 space-y-3 overflow-y-auto" style={{ maxHeight: "70vh" }}>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="연도">
          <Input value={String(form.year ?? "")} onChange={v => setForm(p => ({ ...p, year: v ? Number(v) : undefined }))} placeholder="2026" type="number" />
        </FieldRow>
        <FieldRow label="회차">
          <Input value={form.round_label ?? ""} onChange={set("round_label")} placeholder="제37회" />
        </FieldRow>
      </div>

      <FieldRow label="주관 기관">
        <Input value={form.organizer ?? ""} onChange={set("organizer")} placeholder="한국산업인력공단" />
      </FieldRow>
      <FieldRow label="응시료">
        <Input value={form.exam_fee ?? ""} onChange={set("exam_fee")} placeholder="1차 13,700원 / 2차 14,300원" />
      </FieldRow>

      <div className="pt-1" style={{ borderTop: "1px solid var(--border)" }}>
        <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>필기 일정</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="접수 시작">
              <Input value={form.written_reg_start ?? ""} onChange={set("written_reg_start")} placeholder="2026.08.03" />
            </FieldRow>
            <FieldRow label="접수 마감">
              <Input value={form.written_reg_end ?? ""} onChange={set("written_reg_end")} placeholder="2026.08.07" />
            </FieldRow>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="시험일">
              <Input value={form.written_exam_date ?? ""} onChange={set("written_exam_date")} placeholder="2026.10.31" />
            </FieldRow>
            <FieldRow label="합격 발표">
              <Input value={form.written_result_date ?? ""} onChange={set("written_result_date")} placeholder="2026.12.02" />
            </FieldRow>
          </div>
        </div>
      </div>

      <div className="pt-1" style={{ borderTop: "1px solid var(--border)" }}>
        <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>실기 일정 (선택)</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="접수 시작">
              <Input value={form.practical_reg_start ?? ""} onChange={set("practical_reg_start")} placeholder="미정" />
            </FieldRow>
            <FieldRow label="접수 마감">
              <Input value={form.practical_reg_end ?? ""} onChange={set("practical_reg_end")} placeholder="미정" />
            </FieldRow>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="시험일">
              <Input value={form.practical_exam_date ?? ""} onChange={set("practical_exam_date")} placeholder="미정" />
            </FieldRow>
            <FieldRow label="합격 발표">
              <Input value={form.practical_result_date ?? ""} onChange={set("practical_result_date")} placeholder="미정" />
            </FieldRow>
          </div>
        </div>
      </div>

      <div className="pt-1" style={{ borderTop: "1px solid var(--border)" }}>
        <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>유의사항 / 기타</p>
        <div className="space-y-3">
          <FieldRow label="유의사항">
            <Textarea value={form.notes ?? ""} onChange={set("notes")} placeholder="• 신분증 필참" rows={3} />
          </FieldRow>
          <FieldRow label="출처 URL">
            <Input value={form.source_url ?? ""} onChange={set("source_url")} placeholder="https://www.q-net.or.kr" />
          </FieldRow>
        </div>
      </div>

      <div className="pt-1" style={{ borderTop: "1px solid var(--border)" }}>
        <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>
          시험과목 JSON <span className="font-normal" style={{ color: "var(--text-muted)" }}>(고급 편집)</span>
        </p>
        <Textarea value={form.subjects_json ?? ""} onChange={set("subjects_json")} rows={4} placeholder='[{"round":"1차","name":"민법","count":"40문항","time":"100분"}]' />
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg"
                style={{ background: "var(--surface2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
          취소
        </button>
        <button onClick={() => onSave(form)} className="text-sm px-5 py-2 rounded-lg font-bold"
                style={{ background: "var(--accent)", color: "white" }}>
          {isStatic() ? "JSON 저장 & 다운로드" : "저장"}
        </button>
      </div>
    </div>
  );
}

// ── 취업 전망 편집 폼 ─────────────────────────────────────────────────────────
function EmploymentStatFormModal({ data, onSave, onClose }: {
  data: EmploymentStat; onSave: (d: EmploymentStat) => void; onClose: () => void;
}) {
  const [form, setForm] = useState<EmploymentStat>({ ...data });
  const set = (k: keyof EmploymentStat) => (v: string) => setForm(prev => ({ ...prev, [k]: v || undefined }));
  const OUTLOOKS = ["증가", "다소증가", "유지", "다소감소", "감소"];

  return (
    <div className="p-5 space-y-3 overflow-y-auto" style={{ maxHeight: "70vh" }}>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="종사자 수">
          <Input value={form.worker_count ?? ""} onChange={set("worker_count")} placeholder="약 12만 명" />
        </FieldRow>
        <FieldRow label="평균 임금">
          <Input value={form.avg_wage ?? ""} onChange={set("avg_wage")} placeholder="월 350만 원" />
        </FieldRow>
      </div>
      <FieldRow label="고용 전망">
        <select value={form.employment_outlook ?? ""} onChange={e => set("employment_outlook")(e.target.value)}
                className="w-full rounded-lg px-3 py-1.5 text-sm outline-none"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
          <option value="">선택</option>
          {OUTLOOKS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </FieldRow>
      <FieldRow label="전망 상세">
        <Textarea value={form.outlook_detail ?? ""} onChange={set("outlook_detail")} rows={3} placeholder="고용 전망 상세 설명" />
      </FieldRow>
      <FieldRow label="기준 연도">
        <Input value={form.stat_year ?? ""} onChange={set("stat_year")} placeholder="2024" />
      </FieldRow>
      <FieldRow label="데이터 출처">
        <Input value={form.data_source ?? ""} onChange={set("data_source")} placeholder="고용노동부 고용형태별근로실태조사" />
      </FieldRow>
      <FieldRow label="출처 URL">
        <Input value={form.source_url ?? ""} onChange={set("source_url")} placeholder="https://..." />
      </FieldRow>
      <div className="pt-1" style={{ borderTop: "1px solid var(--border)" }}>
        <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>상담 포인트 JSON <span className="font-normal">(고급)</span></p>
        <Textarea value={form.talking_points_json ?? ""} onChange={set("talking_points_json")} rows={4}
                  placeholder='[{"icon":"📈","title":"성장 중","body":"..."}]' />
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg"
                style={{ background: "var(--surface2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
          취소
        </button>
        <button onClick={() => onSave(form)} className="text-sm px-5 py-2 rounded-lg font-bold"
                style={{ background: "var(--accent)", color: "white" }}>
          {isStatic() ? "JSON 저장 & 다운로드" : "저장"}
        </button>
      </div>
    </div>
  );
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
type EditTarget = { type: "exam"; courseId: number; data: ExamSchedule }
               | { type: "employment"; courseId: number; data: EmploymentStat };

export default function AdminExamInfoPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"exam" | "employment">("exam");
  const [examData, setExamData] = useState<Record<number, ExamSchedule[]>>({});
  const [empData,  setEmpData]  = useState<Record<number, EmploymentStat | null>>({});
  const [loading,  setLoading]  = useState(true);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

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

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 4000); };

  const handleSaveExam = async (updated: ExamSchedule) => {
    setSaving(true);
    try {
      if (isStatic()) {
        const file = `course-${editTarget!.courseId}-exam.json`;
        const cur: ExamSchedule[] = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data/${file}`
        ).then(r => r.json()).catch(() => []);
        const saved = localStorage.getItem(ssKey(file));
        const base: ExamSchedule[] = saved ? JSON.parse(saved) : cur;
        const next = base.map(s => s.id === updated.id ? updated : s);
        if (!next.find(s => s.id === updated.id)) next.push(updated);
        localStorage.setItem(ssKey(file), JSON.stringify(next));
        // also download
        const blob = new Blob([JSON.stringify(next, null, 2)], { type: "application/json" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file; a.click();
        flash(`저장 완료 — ${file} 다운로드됨. public/data/에 업로드 후 배포하세요.`);
        loadAll();
      } else {
        await api.updateExamSchedule(updated.id, updated);
        flash("저장 완료");
        loadAll();
      }
      setEditTarget(null);
    } catch (e) {
      flash((e as Error).message || "오류 발생");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEmp = async (updated: EmploymentStat) => {
    setSaving(true);
    try {
      if (isStatic()) {
        const file = `course-${editTarget!.courseId}-employment.json`;
        localStorage.setItem(ssKey(file), JSON.stringify(updated));
        const blob = new Blob([JSON.stringify(updated, null, 2)], { type: "application/json" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file; a.click();
        flash(`저장 완료 — ${file} 다운로드됨. public/data/에 업로드 후 배포하세요.`);
        loadAll();
      } else {
        await api.updateEmploymentStat(updated.id, updated);
        flash("저장 완료");
        loadAll();
      }
      setEditTarget(null);
    } catch (e) {
      flash((e as Error).message || "오류 발생");
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
            정적 모드 — 저장 시 JSON 다운로드
          </span>
        )}
        {msg && (
          <span className="ml-auto text-xs px-3 py-1.5 rounded-lg"
                style={{ background: "rgba(34,197,94,0.12)", color: "var(--success)", border: "1px solid rgba(34,197,94,0.3)" }}>
            {msg}
          </span>
        )}
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-6">
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
                      <td />
                    </tr>
                  );
                  return scheds.map((s, i) => (
                    <tr key={`${c.id}-${i}`} style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
                      {i === 0 && <td className="px-3 py-2.5 text-sm font-medium" rowSpan={scheds.length} style={{ color: "var(--text)" }}>{c.icon} {c.name}</td>}
                      <td className="px-3 py-2.5 text-sm">{s.round_label}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--text-muted)" }}>
                        {s.written_reg_start && `${s.written_reg_start}~${s.written_reg_end}`}
                      </td>
                      <td className="px-3 py-2.5 text-xs">{s.written_exam_date}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--text-muted)" }}>{s.written_result_date}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--text-muted)" }}>{s.organizer}</td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => setEditTarget({ type: "exam", courseId: c.id, data: s })}
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
                  const outlookColor: Record<string, string> = { 증가: "#16A34A", 다소증가: "#1D4ED8", 유지: "#92400E", 다소감소: "#C2410C", 감소: "#DC2626" };
                  return (
                    <tr key={c.id} style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
                      <td className="px-3 py-2.5 text-sm font-medium">{c.icon} {c.name}</td>
                      <td className="px-3 py-2.5 text-sm">{emp?.worker_count ?? "—"}</td>
                      <td className="px-3 py-2.5 text-sm">{emp?.avg_wage ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        {emp?.employment_outlook ? (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                style={{ color: outlookColor[emp.employment_outlook] ?? "var(--text)", background: "rgba(0,0,0,0.05)" }}>
                            {emp.employment_outlook}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--text-muted)" }}>{emp?.stat_year ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        {emp && (
                          <button onClick={() => setEditTarget({ type: "employment", courseId: c.id, data: emp })}
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
             style={{ background: "rgba(0,0,0,0.55)" }}>
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden"
               style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="px-5 py-4 flex items-center justify-between"
                 style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <h2 className="font-bold text-sm" style={{ color: "var(--text)" }}>
                  {editTarget.type === "exam" ? "시험 일정 편집" : "취업 전망 편집"}
                </h2>
                {isStatic() && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    저장 시 JSON 파일이 자동 다운로드됩니다
                  </p>
                )}
              </div>
              <button onClick={() => setEditTarget(null)} style={{ color: "var(--text-muted)" }}>✕</button>
            </div>
            {saving ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : editTarget.type === "exam" ? (
              <ExamScheduleFormModal
                courseId={editTarget.courseId}
                data={editTarget.data}
                onSave={handleSaveExam}
                onClose={() => setEditTarget(null)}
              />
            ) : (
              <EmploymentStatFormModal
                data={editTarget.data}
                onSave={handleSaveEmp}
                onClose={() => setEditTarget(null)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
