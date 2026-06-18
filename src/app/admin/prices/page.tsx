"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ssKey, type PriceRow, type PriceAlert } from "@/lib/api";
import { getGithubConfig, githubCommitFile, githubCommitFiles } from "@/lib/github";

function fmt(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}
function staleDays(iso: string | null): number {
  if (!iso) return 999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

// ── 정적 모드 데이터 타입 ─────────────────────────────────────────────────────
interface StaticPriceRow {
  courseId: number; courseName: string; courseIcon: string;
  itemId: number; itemName: string;
  competitorId: number | null; competitorName: string;
  description: string; valueText: string;
}

const BP = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

async function loadStaticPrices(): Promise<StaticPriceRow[]> {
  const [courses, compsAll] = await Promise.all([
    fetch(`${BP}/data/courses.json`).then(r => r.json()),
    fetch(`${BP}/data/competitors.json`).then(r => r.json()),
  ]);
  const compsMap: Record<number, string> = {};
  for (const c of compsAll) compsMap[c.id] = c.name;

  const rows: StaticPriceRow[] = [];
  for (const course of courses as { id: number; name: string; icon: string }[]) {
    const file = `course-${course.id}-comparison.json`;
    let compData;
    try {
      const saved = localStorage.getItem(ssKey(file));
      compData = saved ? JSON.parse(saved)
        : await fetch(`${BP}/data/${file}`).then(r => r.json());
    } catch { continue; }

    for (const item of compData.items ?? []) {
      rows.push({
        courseId: course.id, courseName: course.name, courseIcon: course.icon,
        itemId: item.id, itemName: item.name,
        competitorId: null, competitorName: "에듀윌",
        description: item.description ?? "", valueText: item.eduwill_value ?? "",
      });
      for (const comp of compData.competitors ?? []) {
        rows.push({
          courseId: course.id, courseName: course.name, courseIcon: course.icon,
          itemId: item.id, itemName: item.name,
          competitorId: comp.id, competitorName: comp.name,
          description: "", valueText: item.competitor_values?.[String(comp.id)] ?? "",
        });
      }
    }
  }
  return rows;
}

async function saveStaticPrice(courseId: number, itemId: number, competitorId: number | null, valueText: string, description?: string) {
  const file = `course-${courseId}-comparison.json`;
  const saved = localStorage.getItem(ssKey(file));
  const compData = saved ? JSON.parse(saved)
    : await fetch(`${BP}/data/${file}`).then(r => r.json());

  compData.items = compData.items.map((item: Record<string, unknown>) => {
    if (item.id !== itemId) return item;
    if (competitorId === null) return { ...item, eduwill_value: valueText, description: description ?? item.description };
    return { ...item, competitor_values: { ...(item.competitor_values as Record<string, string>), [String(competitorId)]: valueText } };
  });
  localStorage.setItem(ssKey(file), JSON.stringify(compData));
}

// ── 정적 모드 가격 행 ─────────────────────────────────────────────────────────
function StaticPriceRowItem({ row, onSaved }: { row: StaticPriceRow; onSaved: (msg: string) => void }) {
  const isEduwill = row.competitorId === null;
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(row.valueText);
  const [desc, setDesc] = useState(row.description);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const cancel = () => { setVal(row.valueText); setDesc(row.description); setEditing(false); setErr(""); };

  const save = async () => {
    setSaving(true); setErr("");
    try {
      await saveStaticPrice(row.courseId, row.itemId, row.competitorId, val, isEduwill ? desc : undefined);
      setEditing(false);
      const file = `course-${row.courseId}-comparison.json`;
      const data = localStorage.getItem(ssKey(file));
      const cfg = getGithubConfig();
      if (cfg && data) {
        try {
          await githubCommitFile(cfg, `public/data/${file}`,
            JSON.stringify(JSON.parse(data), null, 2),
            `가격 업데이트: ${row.courseName} - ${row.itemName}`);
          onSaved("GitHub에 자동 저장됨 ✓");
        } catch (ge) {
          onSaved(`⚠ GitHub 오류: ${(ge as Error).message}`);
        }
      } else {
        onSaved("저장 완료 (브라우저에 저장됨)");
      }
    } catch (e) {
      setErr((e as Error).message || "저장 실패");
    } finally { setSaving(false); }
  };

  return (
    <tr style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
      <td className="px-3 py-2.5 text-sm font-medium" style={{ color: "var(--text)" }}>
        {row.courseIcon} {row.courseName}
      </td>
      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text-muted)" }}>{row.competitorName}</td>
      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{row.itemName}</td>
      <td className="px-3 py-2.5" style={{ minWidth: 300 }}>
        {editing ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2">
              <div className="flex-1 flex flex-col gap-1.5">
                {isEduwill && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs shrink-0" style={{ color: "var(--text-muted)", width: 28 }}>가격</span>
                    <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="예: 529,000원"
                           className="flex-1 text-xs px-2 py-1.5 rounded-lg outline-none"
                           style={{ border: "1.5px solid var(--accent)", background: "var(--surface2)", color: "var(--text)" }} />
                  </div>
                )}
                <textarea value={val} onChange={e => setVal(e.target.value)}
                          rows={Math.max(3, val.split("\n").length + 1)}
                          className="w-full text-xs px-2 py-1.5 rounded-lg outline-none resize-y"
                          style={{ border: "1.5px solid var(--accent)", background: "var(--surface2)", color: "var(--text)", fontFamily: "monospace" }} />
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button onClick={save} disabled={saving}
                        className="text-xs px-3 py-1.5 rounded-lg font-bold disabled:opacity-50"
                        style={{ background: "var(--accent)", color: "white" }}>
                  {saving ? "…" : "저장"}
                </button>
                <button onClick={cancel} className="text-xs px-3 py-1.5 rounded-lg"
                        style={{ background: "var(--surface2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                  취소
                </button>
              </div>
            </div>
            {err && <div className="text-xs px-2 py-1.5 rounded-lg" style={{ background: "#FEF2F2", color: "#B91C1C" }}>⚠️ {err}</div>}
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              {isEduwill && desc && <div className="text-xs font-semibold mb-1" style={{ color: "var(--accent)" }}>{desc}</div>}
              <pre className="text-xs whitespace-pre-wrap leading-relaxed font-sans"
                   style={{ color: "var(--text)", maxHeight: 72, overflow: "hidden" }}>
                {val || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>비어 있음</span>}
              </pre>
            </div>
            <button onClick={() => setEditing(true)}
                    className="shrink-0 text-xs px-2.5 py-1 rounded-lg"
                    style={{ background: "rgba(79,127,255,0.1)", color: "var(--accent)", border: "1px solid rgba(79,127,255,0.25)" }}>
              편집
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── 라이브 모드 가격 행 ───────────────────────────────────────────────────────
function PriceRowItem({ row, onSaved }: { row: PriceRow; onSaved: () => void }) {
  const isEduwill = row.competitor_id === null;
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(row.value_text);
  const [priceVal, setPriceVal] = useState(row.item_description);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const days = staleDays(row.updated_at);

  const cancel = () => { setVal(row.value_text); setPriceVal(row.item_description); setEditing(false); setSaveErr(""); };

  const save = async () => {
    setSaving(true); setSaveErr("");
    try {
      if (isEduwill) {
        await Promise.all([
          api.updateComparisonItem(row.item_id, { description: priceVal }),
          api.upsertComparisonValue({ comparison_item_id: row.item_id, competitor_id: null, value_text: val }),
        ]);
      } else {
        await api.upsertComparisonValue({ comparison_item_id: row.item_id, competitor_id: row.competitor_id, value_text: val });
      }
      setEditing(false); setSaveErr(""); onSaved();
    } catch (e) { setSaveErr((e as Error).message || "저장 실패"); }
    finally { setSaving(false); }
  };

  const freshnessColor = days > 30 ? "#DC2626" : days > 14 ? "#D97706" : "#16A34A";

  return (
    <tr style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
      <td className="px-3 py-2.5 text-sm font-medium" style={{ color: "var(--text)" }}>{row.course_icon} {row.course_name}</td>
      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text-muted)" }}>{row.competitor_name}</td>
      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{row.item_name}</td>
      <td className="px-3 py-2.5 text-xs" style={{ color: freshnessColor, whiteSpace: "nowrap" }}>
        {fmt(row.updated_at)}{days > 14 && <span className="ml-1">({days}일 전)</span>}
      </td>
      <td className="px-3 py-2.5" style={{ minWidth: 280 }}>
        {editing ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2">
              <div className="flex-1 flex flex-col gap-1.5">
                {isEduwill && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs shrink-0" style={{ color: "var(--text-muted)", width: 28 }}>가격</span>
                    <input value={priceVal} onChange={e => setPriceVal(e.target.value)} placeholder="예: 529,000원"
                           className="flex-1 text-xs px-2 py-1.5 rounded-lg outline-none"
                           style={{ border: "1.5px solid var(--accent)", background: "var(--surface2)", color: "var(--text)" }} />
                  </div>
                )}
                <textarea value={val} onChange={e => setVal(e.target.value)}
                          rows={Math.max(3, val.split("\n").length + 1)}
                          className="flex-1 w-full text-xs px-2 py-1.5 rounded-lg outline-none resize-y"
                          style={{ border: "1.5px solid var(--accent)", background: "var(--surface2)", color: "var(--text)", fontFamily: "monospace" }} />
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button onClick={save} disabled={saving}
                        className="text-xs px-3 py-1.5 rounded-lg font-bold disabled:opacity-50"
                        style={{ background: "var(--accent)", color: "white" }}>{saving ? "…" : "저장"}</button>
                <button onClick={cancel} className="text-xs px-3 py-1.5 rounded-lg"
                        style={{ background: "var(--surface2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>취소</button>
              </div>
            </div>
            {saveErr && <div className="text-xs px-2 py-1.5 rounded-lg" style={{ background: "#FEF2F2", color: "#B91C1C" }}>⚠️ {saveErr}</div>}
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              {isEduwill && priceVal && <div className="text-xs font-semibold mb-1" style={{ color: "var(--accent)" }}>{priceVal}</div>}
              <pre className="text-xs whitespace-pre-wrap leading-relaxed font-sans"
                   style={{ color: "var(--text)", maxHeight: 72, overflow: "hidden" }}>
                {val || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>비어 있음</span>}
              </pre>
            </div>
            <button onClick={() => setEditing(true)}
                    className="shrink-0 text-xs px-2.5 py-1 rounded-lg"
                    style={{ background: "rgba(79,127,255,0.1)", color: "var(--accent)", border: "1px solid rgba(79,127,255,0.25)" }}>편집</button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
export default function AdminPricesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [staticRows, setStaticRows] = useState<StaticPriceRow[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [tab, setTab] = useState<"prices" | "alerts">("prices");
  const [filterCourse, setFilterCourse] = useState("");
  const [filterCompetitor, setFilterCompetitor] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [isStaticMode, setIsStaticMode] = useState(true);

  useEffect(() => {
    const customUrl = localStorage.getItem("tm_custom_api_url");
    const onGitHub = process.env.NEXT_PUBLIC_STATIC === "true" || window.location.hostname.includes("github.io");
    const staticMode = onGitHub && !customUrl;
    setIsStaticMode(staticMode);

    const token = localStorage.getItem("tm_token");
    if (!token) { router.replace("/login"); return; }
    const u = localStorage.getItem("tm_user");
    if (u) {
      const role = JSON.parse(u).role;
      if (role !== "admin" && role !== "superadmin") { router.replace("/"); return; }
    }

    if (staticMode) {
      loadStaticPrices().then(setStaticRows).finally(() => setLoading(false));
    } else {
      loadAll();
    }
  }, [router]);  // eslint-disable-line react-hooks/exhaustive-deps

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([api.priceManagement(), api.priceAlerts()])
      .then(([r, a]) => { setRows(r); setAlerts(a); })
      .finally(() => setLoading(false));
  }, []);

  const reloadStatic = () => {
    setLoading(true);
    loadStaticPrices().then(setStaticRows).finally(() => setLoading(false));
  };

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const handleExportAll = async () => {
    const courses = [...new Set(staticRows.map(r => r.courseId))];
    const modified = courses.filter(id => localStorage.getItem(ssKey(`course-${id}-comparison.json`)));
    if (modified.length === 0) { flash("변경된 데이터가 없습니다."); return; }

    const cfg = getGithubConfig();
    if (cfg) {
      const files = modified
        .map(id => {
          const file = `course-${id}-comparison.json`;
          const data = localStorage.getItem(ssKey(file));
          return data ? { path: `public/data/${file}`, content: JSON.stringify(JSON.parse(data), null, 2) } : null;
        })
        .filter((f): f is { path: string; content: string } => f !== null);
      try {
        await githubCommitFiles(cfg, files, `가격 일괄 업데이트: ${modified.length}개 과목`);
        flash(`GitHub에 ${modified.length}개 파일 자동 저장됨 ✓`);
      } catch (e) {
        flash(`⚠ GitHub 오류: ${(e as Error).message}`);
      }
    } else {
      modified.forEach(id => {
        const file = `course-${id}-comparison.json`;
        const data = localStorage.getItem(ssKey(file));
        if (!data) return;
        const blob = new Blob([JSON.stringify(JSON.parse(data), null, 2)], { type: "application/json" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file; a.click();
      });
      flash(`${modified.length}개 파일 다운로드됨. GitHub public/data/에 업로드하세요.`);
    }
  };

  const markSeen = async (id: number) => { await api.markAlertSeen(id); setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: "seen" } : a)); };
  const markAllSeen = async () => { await api.markAllAlertsSeen(); setAlerts(prev => prev.map(a => ({ ...a, status: "seen" }))); flash("전체 확인 처리 완료"); };
  const deleteAlert = async (id: number) => { await api.deleteAlert(id); setAlerts(prev => prev.filter(a => a.id !== id)); };

  const liveFiltered = rows.filter(r => (!filterCourse || r.course_name === filterCourse) && (!filterCompetitor || r.competitor_name === filterCompetitor));
  const staticFiltered = staticRows.filter(r => (!filterCourse || r.courseName === filterCourse) && (!filterCompetitor || r.competitorName === filterCompetitor));
  const liveCourses = [...new Set(rows.map(r => r.course_name))];
  const liveCompetitors = [...new Set(rows.map(r => r.competitor_name))];
  const staticCourses = [...new Set(staticRows.map(r => r.courseName))];
  const staticCompetitors = [...new Set(staticRows.map(r => r.competitorName))];
  const pendingAlerts = alerts.filter(a => a.status === "pending");

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
        <h1 className="font-bold">가격 관리</h1>
        {isStaticMode && (
          <span className="ml-2 text-xs px-2 py-0.5 rounded-full"
                style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A" }}>
            정적 모드
          </span>
        )}
        {isStaticMode && (
          <button onClick={handleExportAll}
                  className="ml-auto text-xs px-3 py-1.5 rounded-lg font-medium"
                  style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }}>
            {typeof window !== "undefined" && localStorage.getItem("tm_github_config")
              ? "GitHub에 일괄 저장"
              : "JSON 내보내기"}
          </button>
        )}
        {msg && (
          <span className={`${isStaticMode ? "" : "ml-auto"} text-xs px-3 py-1 rounded-lg`}
                style={{ background: "rgba(34,197,94,0.12)", color: "var(--success)", border: "1px solid rgba(34,197,94,0.3)" }}>
            {msg}
          </span>
        )}
      </header>

      {isStaticMode && (
        <div className="px-6 py-2 text-xs" style={{ background: "rgba(79,127,255,0.08)", color: "var(--accent)", borderBottom: "1px solid var(--border)" }}>
          {typeof window !== "undefined" && localStorage.getItem("tm_github_config")
            ? "ℹ GitHub 연결됨 — 저장 버튼 클릭 시 즉시 GitHub에 반영됩니다."
            : "ℹ 변경사항은 브라우저에 저장됩니다. 관리자 페이지에서 GitHub 연동을 설정하면 자동 반영됩니다."}
        </div>
      )}

      <main className="max-w-screen-xl mx-auto px-6 py-6">
        {/* 탭 (라이브 모드 전용) */}
        {!isStaticMode && (
          <div className="flex gap-1 mb-5" style={{ borderBottom: "1px solid var(--border)" }}>
            <button onClick={() => setTab("prices")}
                    className="px-5 py-3 text-sm font-medium border-b-2 transition"
                    style={{ borderColor: tab === "prices" ? "var(--accent)" : "transparent", color: tab === "prices" ? "var(--accent)" : "var(--text-muted)" }}>
              가격 직접 수정
              <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(79,127,255,0.1)", color: "var(--accent)" }}>{rows.length}</span>
            </button>
            <button onClick={() => setTab("alerts")}
                    className="px-5 py-3 text-sm font-medium border-b-2 transition flex items-center gap-2"
                    style={{ borderColor: tab === "alerts" ? "var(--accent)" : "transparent", color: tab === "alerts" ? "var(--accent)" : "var(--text-muted)" }}>
              가격 변동 알림
              {pendingAlerts.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: "#DC2626", color: "white" }}>{pendingAlerts.length}</span>
              )}
            </button>
          </div>
        )}

        {/* ── 정적 모드 가격 테이블 ── */}
        {isStaticMode && (
          <>
            <div className="flex gap-3 mb-4 flex-wrap">
              <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)}
                      className="text-sm px-3 py-2 rounded-lg outline-none"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
                <option value="">전체 과목</option>
                {staticCourses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterCompetitor} onChange={e => setFilterCompetitor(e.target.value)}
                      className="text-sm px-3 py-2 rounded-lg outline-none"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
                <option value="">전체 경쟁사</option>
                {staticCompetitors.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="text-xs self-center" style={{ color: "var(--text-muted)" }}>{staticFiltered.length}개 항목</span>
              <button onClick={reloadStatic} className="ml-auto text-xs px-3 py-1.5 rounded-lg"
                      style={{ background: "var(--surface2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                새로고침
              </button>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <table className="w-full">
                <thead>
                  <tr style={{ background: "var(--surface2)" }}>
                    {["과목", "경쟁사", "상품명", "내용 (직접 편집 가능)"].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staticFiltered.map(row => (
                    <StaticPriceRowItem
                      key={`${row.courseId}-${row.itemId}-${row.competitorId ?? "e"}`}
                      row={row}
                      onSaved={(m) => { flash(m); reloadStatic(); }}
                    />
                  ))}
                </tbody>
              </table>
              {staticFiltered.length === 0 && <div className="py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>항목 없음</div>}
            </div>
          </>
        )}

        {/* ── 라이브 모드 가격 수정 탭 ── */}
        {!isStaticMode && tab === "prices" && (
          <>
            <div className="flex gap-3 mb-4 flex-wrap">
              <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)}
                      className="text-sm px-3 py-2 rounded-lg outline-none"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
                <option value="">전체 과목</option>
                {liveCourses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterCompetitor} onChange={e => setFilterCompetitor(e.target.value)}
                      className="text-sm px-3 py-2 rounded-lg outline-none"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
                <option value="">전체 경쟁사</option>
                {liveCompetitors.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="text-xs self-center" style={{ color: "var(--text-muted)" }}>{liveFiltered.length}개 항목</span>
              <div className="ml-auto flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                <span className="flex items-center gap-1"><span style={{ color: "#16A34A" }}>●</span> 14일 이내</span>
                <span className="flex items-center gap-1"><span style={{ color: "#D97706" }}>●</span> 15~30일</span>
                <span className="flex items-center gap-1"><span style={{ color: "#DC2626" }}>●</span> 30일 초과</span>
              </div>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <table className="w-full">
                <thead>
                  <tr style={{ background: "var(--surface2)" }}>
                    {["과목", "경쟁사", "상품명", "마지막 수정", "내용 (직접 편집 가능)"].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {liveFiltered.map(row => (
                    <PriceRowItem key={`${row.item_id}-${row.competitor_id}`} row={row} onSaved={() => flash("저장 완료")} />
                  ))}
                </tbody>
              </table>
              {liveFiltered.length === 0 && <div className="py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>항목 없음</div>}
            </div>
          </>
        )}

        {/* ── 라이브 모드 알림 탭 ── */}
        {!isStaticMode && tab === "alerts" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>스크래퍼가 감지한 가격 변동 내역입니다.</p>
              {pendingAlerts.length > 0 && (
                <button onClick={markAllSeen} className="text-xs px-4 py-2 rounded-lg font-medium"
                        style={{ background: "var(--surface2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>전체 확인</button>
              )}
            </div>
            <div className="space-y-2">
              {alerts.length === 0 && (
                <div className="rounded-xl py-12 text-center text-sm" style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}>가격 변동 알림 없음</div>
              )}
              {alerts.map(a => (
                <div key={a.id} className="rounded-xl px-5 py-4 flex items-start gap-4"
                     style={{ background: a.status === "pending" ? "rgba(250,204,21,0.06)" : "var(--surface)", border: `1px solid ${a.status === "pending" ? "#FBBF24" : "var(--border)"}` }}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: a.status === "pending" ? "#FEF3C7" : "var(--surface2)", color: a.status === "pending" ? "#92400E" : "var(--text-muted)" }}>
                        {a.status === "pending" ? "미확인" : "확인됨"}
                      </span>
                      <span className="text-sm font-semibold">{a.course_name} · {a.competitor_name}</span>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{a.product_name}</span>
                      <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>
                        {a.detected_at ? new Date(a.detected_at).toLocaleDateString("ko-KR") : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="line-through" style={{ color: "#9CA3AF" }}>{a.old_price || "—"}</span>
                      <span style={{ color: "var(--text-muted)" }}>→</span>
                      <span className="font-bold" style={{ color: "#DC2626" }}>{a.new_price}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {a.status === "pending" && (
                      <button onClick={() => markSeen(a.id)} className="text-xs px-3 py-1.5 rounded-lg"
                              style={{ background: "rgba(34,197,94,0.1)", color: "var(--success)", border: "1px solid rgba(34,197,94,0.3)" }}>확인</button>
                    )}
                    <button onClick={() => deleteAlert(a.id)} className="text-xs px-3 py-1.5 rounded-lg"
                            style={{ background: "rgba(239,68,68,0.1)", color: "var(--danger)", border: "1px solid rgba(239,68,68,0.25)" }}>삭제</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
