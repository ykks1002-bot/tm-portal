"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, type Course } from "@/lib/api";

// ── 타입 ──────────────────────────────────────────────────────────────────────
interface ExamSchedule { type: string; start: string; end: string; note?: string }
interface ExamRound    { label: string; schedule: ExamSchedule[] }
interface ExamItem     { id: number; course: string; icon: string; rounds: ExamRound[] }

interface BannerEntry {
  icon: string; course: string; roundLabel: string;
  eventType: string; start: string; end: string; note?: string;
  status: "upcoming" | "ongoing" | "done";
}

// ── 상수 ──────────────────────────────────────────────────────────────────────
const CATEGORY_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  전문자격: { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
  학력인증: { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
  기술자격: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  공무원:   { bg: "#F5F3FF", text: "#6D28D9", border: "#DDD6FE" },
};

const COURSE_COMPETITOR: Record<string, string> = {
  "공인중개사":    "메가랜드·해커스·박문각",
  "주택관리사":    "해커스·박문각",
  "사회복지사1급": "해커스·박문각",
  "행정사":        "박문각·해커스·합격의법학원",
  "경비지도사":    "시대에듀·에듀피디",
  "검정고시":      "검스타트·국자감·해커스",
  "전기기사":      "다산에듀·대산전기",
  "소방설비기사":  "모아바·성안당·배울학",
  "9급공무원":     "공단기·넥스트공무원·해커스·박문각",
  "손해평가사":    "에듀야·박문각",
};

const CATEGORY_ORDER = ["전문자격", "공무원", "기술자격", "학력인증"];

// ── 유틸 ──────────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  const dt = new Date(d);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

function dday(d: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(d); target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function getStatus(start: string, end: string): "upcoming" | "ongoing" | "done" {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const s = new Date(start); s.setHours(0, 0, 0, 0);
  const e = new Date(end);   e.setHours(0, 0, 0, 0);
  if (today < s) return "upcoming";
  if (today <= e) return "ongoing";
  return "done";
}

/** 라운드에서 "가장 가까운 미래" 또는 "진행 중" 이벤트 반환 */
function pickEvent(round: ExamRound): ExamSchedule | null {
  // 진행 중인 이벤트 우선
  const ongoing = round.schedule.find(s => getStatus(s.start, s.end) === "ongoing");
  if (ongoing) return ongoing;
  // 다음 예정 이벤트
  const upcoming = round.schedule.find(s => getStatus(s.start, s.end) === "upcoming");
  if (upcoming) return upcoming;
  // 모두 완료면 마지막 이벤트
  return round.schedule[round.schedule.length - 1] ?? null;
}

// ── 시험 일정 배너 ────────────────────────────────────────────────────────────
function ExamBanner({ entries }: { entries: BannerEntry[] }) {
  const [idx, setIdx]         = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (entries.length <= 1) return;
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIdx(i => (i + 1) % entries.length); setVisible(true); }, 280);
    }, 5000);
    return () => clearInterval(t);
  }, [entries.length]);

  if (!entries.length) return null;
  const e = entries[idx];

  const isRange   = e.start !== e.end;
  const dateText  = isRange ? `${fmtDate(e.start)}~${fmtDate(e.end)}` : fmtDate(e.start);
  const dd        = dday(e.start);
  const ddEnd     = dday(e.end);

  let badge: { text: string; bg: string; color: string } | null = null;
  if (e.status === "ongoing") {
    badge = { text: "진행중", bg: "#22C55E", color: "#fff" };
  } else if (e.status === "upcoming" && dd <= 60) {
    badge = { text: `D-${dd}`, bg: "var(--eduwill-yellow)", color: "var(--eduwill-navy)" };
  } else if (e.status === "done") {
    badge = { text: "완료", bg: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)" };
  }

  return (
    <div className="rounded-xl mb-6 overflow-hidden"
         style={{ background: "var(--eduwill-navy)", minHeight: 52 }}>
      <div className="flex items-center justify-between gap-3 px-5 py-3"
           style={{ opacity: visible ? 1 : 0, transition: "opacity 0.28s ease" }}>

        {/* 왼쪽: 아이콘 + 과목 + 라벨 */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-lg shrink-0">{e.icon}</span>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-sm text-white shrink-0">{e.course}</span>
            <span className="text-xs px-1.5 py-0.5 rounded font-medium shrink-0"
                  style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)" }}>
              {e.roundLabel}
            </span>
          </div>
        </div>

        {/* 가운데: 이벤트 타입 + 날짜 */}
        <div className="flex items-center gap-2 flex-1 justify-center min-w-0">
          <span className="text-xs font-semibold shrink-0"
                style={{ color: "var(--eduwill-yellow)" }}>
            {e.eventType}
          </span>
          <span className="text-sm font-bold text-white shrink-0">{dateText}</span>
          {e.note && (
            <span className="text-xs hidden sm:inline"
                  style={{ color: "rgba(255,255,255,0.55)" }}>({e.note})</span>
          )}
        </div>

        {/* 오른쪽: 배지 + 인디케이터 */}
        <div className="flex items-center gap-2 shrink-0">
          {badge && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: badge.bg, color: badge.color }}>
              {badge.text}
            </span>
          )}
          <div className="hidden sm:flex gap-1">
            {entries.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)}
                      className="rounded-full transition-all"
                      style={{
                        width: i === idx ? 14 : 5, height: 5,
                        background: i === idx
                          ? "var(--eduwill-yellow)"
                          : "rgba(255,255,255,0.25)",
                      }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 네비게이션 ────────────────────────────────────────────────────────────────
function Navbar({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    const u = localStorage.getItem("tm_user");
    if (u) { const { role } = JSON.parse(u); setIsAdmin(role === "admin" || role === "superadmin"); }
  }, []);

  return (
    <header style={{ background: "var(--eduwill-navy)", borderBottom: "3px solid var(--eduwill-yellow)" }}>
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-base"
               style={{ background: "var(--eduwill-yellow)", color: "var(--eduwill-navy)" }}>E</div>
          <div>
            <div className="font-bold text-sm text-white">에듀윌 TM 상담지원</div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>실시간 비교 분석 포털</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onRefresh} disabled={refreshing}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition disabled:opacity-60"
                  style={{ background: "var(--eduwill-yellow)", color: "var(--eduwill-navy)" }}>
            <svg xmlns="http://www.w3.org/2000/svg"
                 className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
                 fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? "업데이트 중..." : "새로고침"}
          </button>
          {isAdmin && (
            <Link href="/admin" className="text-xs px-3 py-1.5 rounded-lg font-medium transition"
                  style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>관리자</Link>
          )}
          <Link href="/login" className="text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}>
            로그인
          </Link>
        </div>
      </div>
    </header>
  );
}

// ── 과목 카드 ─────────────────────────────────────────────────────────────────
function CourseCard({ course }: { course: Course }) {
  const color      = CATEGORY_COLOR[course.category] ?? CATEGORY_COLOR["전문자격"];
  const competitor = COURSE_COMPETITOR[course.name];

  return (
    <Link href={`/courses/${course.id}`}
          className="group flex flex-col gap-3 p-5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
          style={{ background: "var(--surface)", border: "1px solid var(--border)",
                   boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div className="flex items-start justify-between">
        <span className="text-3xl">{course.icon}</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: color.bg, color: color.text, border: `1px solid ${color.border}` }}>
          {course.category}
        </span>
      </div>
      <div>
        <h3 className="font-bold text-base transition-colors group-hover:text-blue-700"
            style={{ color: "var(--eduwill-navy)" }}>
          {course.name}
        </h3>
        {competitor && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                  style={{ background: "#FEF2F2", color: "#B91C1C", fontSize: "10px" }}>vs</span>
            <span className="text-xs font-semibold" style={{ color: "#B91C1C" }}>{competitor}</span>
          </div>
        )}
        <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
          비교표 · 강점 · 스크립트 · FAQ
        </p>
      </div>
      <div className="flex items-center gap-1 text-xs font-semibold mt-auto"
           style={{ color: "var(--eduwill-blue)" }}>
        상담 자료 보기
        <svg xmlns="http://www.w3.org/2000/svg"
             className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform"
             fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [courses, setCourses]       = useState<Course[]>([]);
  const [examEntries, setExamEntries] = useState<BannerEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback((isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    Promise.all([
      api.courses(),
      fetch(`${basePath}/data/exams.json`).then(r => r.json() as Promise<ExamItem[]>),
    ])
      .then(([c, exams]) => {
        setCourses(c);
        // 각 라운드에서 대표 이벤트를 추출해 배너 엔트리 생성
        const entries: BannerEntry[] = [];
        for (const item of exams) {
          for (const round of item.rounds) {
            const ev = pickEvent(round);
            if (!ev) continue;
            entries.push({
              icon: item.icon, course: item.course, roundLabel: round.label,
              eventType: ev.type, start: ev.start, end: ev.end, note: ev.note,
              status: getStatus(ev.start, ev.end),
            });
          }
        }
        setExamEntries(entries);
      })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3"
           style={{ background: "var(--bg)" }}>
        <div className="w-10 h-10 rounded-full border-[3px] animate-spin"
             style={{ borderColor: "var(--eduwill-yellow)", borderTopColor: "transparent" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>데이터 불러오는 중...</p>
      </div>
    );
  }

  const categories = CATEGORY_ORDER.filter(cat => courses.some(c => c.category === cat));

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Navbar onRefresh={() => load(true)} refreshing={refreshing} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* 시험 일정 슬라이더 */}
        <ExamBanner entries={examEntries} />

        {/* 페이지 제목 */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-5 rounded-full" style={{ background: "var(--eduwill-yellow)" }} />
            <h2 className="text-xl font-bold" style={{ color: "var(--eduwill-navy)" }}>과목 선택</h2>
          </div>
          <p className="text-sm ml-3" style={{ color: "var(--text-muted)" }}>
            상담할 과목을 선택하면 타사 비교표 · 에듀윌 강점 · 상담 스크립트 · FAQ를 바로 확인할 수 있습니다.
          </p>
        </div>

        {/* 과목 그리드 */}
        {categories.map(cat => {
          const color = CATEGORY_COLOR[cat] ?? CATEGORY_COLOR["전문자격"];
          return (
            <div key={cat} className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: color.bg, color: color.text, border: `1px solid ${color.border}` }}>
                  {cat}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {courses.filter(c => c.category === cat).map(c => (
                  <CourseCard key={c.id} course={c} />
                ))}
              </div>
            </div>
          );
        })}

        <div className="mt-4 pt-6 flex items-center justify-between text-xs"
             style={{ borderTop: "1px solid var(--border)", color: "var(--text-sub)" }}>
          <span>에듀윌 TM 상담지원 포털 — 실시간 타사 비교 데이터</span>
          <span>2026년 기준 | 관리자 편집 가능</span>
        </div>
      </main>
    </div>
  );
}
