"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, type Course, type AdminStats, type Promotion, type User, type PriceAlert } from "@/lib/api";

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-3xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tab, setTab] = useState<"courses" | "promotions" | "users">("courses");
  const [pendingAlerts, setPendingAlerts] = useState(0);
  const [newPromoTitle, setNewPromoTitle] = useState("");
  const [newPromoContent, setNewPromoContent] = useState("");
  const [newPromoEnd, setNewPromoEnd] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPw, setNewUserPw] = useState("");
  const [newUserRole, setNewUserRole] = useState("agent");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    // GitHub Pages 정적 모드에서는 관리자 기능 비활성화
    if (window.location.hostname.includes("github.io") ||
        process.env.NEXT_PUBLIC_STATIC === "true") {
      router.replace("/");
      return;
    }
    const token = localStorage.getItem("tm_token");
    if (!token) { router.replace("/login"); return; }
    const u = localStorage.getItem("tm_user");
    if (u) {
      const role = JSON.parse(u).role;
      if (role !== "admin" && role !== "superadmin") { router.replace("/"); return; }
    }
    loadAll();
  }, [router]);

  const loadAll = () => {
    Promise.all([api.adminStats(), api.courses(), api.activePromotions(), api.adminUsers()])
      .then(([s, c, p, us]) => {
        setStats(s); setCourses(c); setPromos(p); setUsers(us);
        setPendingAlerts(s.pending_price_alerts ?? 0);
      })
      .finally(() => setLoading(false));
  };

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const addPromo = async () => {
    if (!newPromoTitle) return;
    await api.createPromotion({
      title: newPromoTitle,
      content: newPromoContent || undefined,
      end_at: newPromoEnd ? new Date(newPromoEnd).toISOString() : undefined,
      is_active: true,
    });
    setNewPromoTitle(""); setNewPromoContent(""); setNewPromoEnd("");
    flash("프로모션이 추가되었습니다.");
    loadAll();
  };

  const togglePromo = async (id: number) => {
    await api.togglePromotion(id);
    loadAll();
  };

  const deletePromo = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await api.deletePromotion(id);
    loadAll();
  };

  const addUser = async () => {
    if (!newUserEmail || !newUserName || !newUserPw) return;
    await api.createUser({ email: newUserEmail, name: newUserName, password: newUserPw, role: newUserRole });
    setNewUserEmail(""); setNewUserName(""); setNewUserPw(""); setNewUserRole("agent");
    flash("사용자가 추가되었습니다.");
    loadAll();
  };

  const toggleUser = async (id: number) => {
    await api.toggleUser(id);
    loadAll();
  };

  if (loading || !stats) {
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
        <Link href="/" className="text-sm flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          홈
        </Link>
        <span style={{ color: "var(--border)" }}>│</span>
        <h1 className="font-bold">관리자 대시보드</h1>
        {msg && (
          <span className="ml-auto text-sm px-3 py-1 rounded-lg"
                style={{ background: "rgba(34,197,94,0.12)", color: "var(--success)", border: "1px solid rgba(34,197,94,0.3)" }}>
            {msg}
          </span>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* 통계 카드 */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          <StatCard label="과목 수"          value={stats.total_courses}        color="var(--accent)" />
          <StatCard label="경쟁사 수"         value={stats.total_competitors}    color="#f59e0b" />
          <StatCard label="스크립트"          value={stats.total_scripts}        color="#a855f7" />
          <StatCard label="FAQ"              value={stats.total_faqs}           color="#22c55e" />
          <StatCard label="강점 포인트"       value={stats.total_strength_points} color="#6b92ff" />
          <StatCard label="활성 프로모션"     value={stats.active_promotions}    color="#ef4444" />
        </div>

        {/* 가격 관리 바로가기 */}
        <div className="rounded-xl p-5 flex items-center justify-between"
             style={{ background: "var(--surface)", border: pendingAlerts > 0 ? "1.5px solid #FBBF24" : "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">💰</span>
            <div>
              <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>가격 관리</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                경쟁사 수강료 직접 수정 · 가격 변동 알림 확인
              </p>
            </div>
            {pendingAlerts > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full animate-pulse"
                    style={{ background: "#DC2626", color: "white" }}>
                미확인 {pendingAlerts}건
              </span>
            )}
          </div>
          <Link href="/admin/prices"
                className="text-sm px-4 py-2 rounded-lg font-semibold transition"
                style={{ background: "var(--accent)", color: "white" }}>
            가격 관리 →
          </Link>
        </div>

        {/* 탭 */}
        <div style={{ borderBottom: "1px solid var(--border)" }}>
          {(["courses", "promotions", "users"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
                    className="px-5 py-3 text-sm font-medium border-b-2 transition"
                    style={{
                      borderColor: tab === t ? "var(--accent)" : "transparent",
                      color: tab === t ? "var(--accent)" : "var(--text-muted)",
                    }}>
              {t === "courses" ? "과목 관리" : t === "promotions" ? "프로모션 관리" : "사용자 관리"}
            </button>
          ))}
        </div>

        {/* 과목 관리 */}
        {tab === "courses" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map(c => (
              <Link key={c.id} href={`/admin/courses/${c.id}`}
                    className="rounded-xl p-5 flex items-center gap-4 transition hover:-translate-y-0.5"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <span className="text-2xl">{c.icon}</span>
                <div>
                  <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{c.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{c.category}</p>
                </div>
                <span className="ml-auto text-xs" style={{ color: "var(--accent)" }}>편집 →</span>
              </Link>
            ))}
          </div>
        )}

        {/* 프로모션 관리 */}
        {tab === "promotions" && (
          <div className="space-y-4">
            {/* 추가 폼 */}
            <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <h3 className="font-semibold mb-4 text-sm">새 프로모션 추가</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <input value={newPromoTitle} onChange={e => setNewPromoTitle(e.target.value)}
                       placeholder="제목 *" className="input-base" />
                <input value={newPromoContent} onChange={e => setNewPromoContent(e.target.value)}
                       placeholder="내용 (선택)" className="input-base" />
                <input type="datetime-local" value={newPromoEnd} onChange={e => setNewPromoEnd(e.target.value)}
                       className="input-base" />
              </div>
              <button onClick={addPromo} className="btn-primary">추가</button>
            </div>

            {/* 목록 */}
            <div className="space-y-2">
              {promos.map(p => (
                <div key={p.id} className="rounded-xl px-5 py-4 flex items-center gap-4"
                     style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div className="flex-1">
                    <p className="font-medium text-sm" style={{ color: "var(--text)" }}>{p.title}</p>
                    {p.content && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{p.content}</p>}
                    {p.end_at && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--warning)" }}>
                        종료: {new Date(p.end_at).toLocaleDateString("ko-KR")}
                      </p>
                    )}
                  </div>
                  <button onClick={() => togglePromo(p.id)}
                          className="text-xs px-3 py-1.5 rounded-lg transition"
                          style={{
                            background: p.is_active ? "rgba(34,197,94,0.12)" : "var(--surface2)",
                            color: p.is_active ? "var(--success)" : "var(--text-muted)",
                            border: `1px solid ${p.is_active ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
                          }}>
                    {p.is_active ? "활성" : "비활성"}
                  </button>
                  <button onClick={() => deletePromo(p.id)}
                          className="text-xs px-3 py-1.5 rounded-lg transition"
                          style={{ background: "rgba(239,68,68,0.12)", color: "var(--danger)", border: "1px solid rgba(239,68,68,0.3)" }}>
                    삭제
                  </button>
                </div>
              ))}
              {promos.length === 0 && <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>프로모션 없음</p>}
            </div>
          </div>
        )}

        {/* 사용자 관리 */}
        {tab === "users" && (
          <div className="space-y-4">
            <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <h3 className="font-semibold mb-4 text-sm">새 사용자 추가</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <input value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="이메일 *" className="input-base" />
                <input value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="이름 *" className="input-base" />
                <input type="password" value={newUserPw} onChange={e => setNewUserPw(e.target.value)} placeholder="비밀번호 *" className="input-base" />
                <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)} className="input-base">
                  <option value="agent">상담원</option>
                  <option value="admin">관리자</option>
                  <option value="superadmin">슈퍼관리자</option>
                </select>
              </div>
              <button onClick={addUser} className="btn-primary">추가</button>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--surface2)" }}>
                    {["이름", "이메일", "역할", "상태", ""].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-medium" style={{ color: "var(--text-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
                      <td className="px-4 py-3 font-medium" style={{ color: "var(--text)" }}>{u.name}</td>
                      <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>{u.email}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: "rgba(79,127,255,0.12)", color: "var(--accent)" }}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleUser(u.id)}
                                className="text-xs px-2.5 py-1 rounded-full transition"
                                style={{
                                  background: "rgba(34,197,94,0.12)",
                                  color: "var(--success)",
                                  border: "1px solid rgba(34,197,94,0.3)",
                                }}>
                          활성
                        </button>
                      </td>
                      <td className="px-4 py-3"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <style>{`
        .input-base {
          width: 100%; border-radius: 0.5rem; padding: 0.5rem 0.875rem;
          font-size: 0.875rem; outline: none; transition: all 0.15s;
          background: var(--surface2); border: 1px solid var(--border); color: var(--text);
        }
        .input-base::placeholder { color: var(--text-muted); }
        .btn-primary {
          padding: 0.5rem 1rem; border-radius: 0.5rem; font-size: 0.875rem;
          font-weight: 600; transition: all 0.15s; color: #fff;
          background: var(--accent);
        }
      `}</style>
    </div>
  );
}
