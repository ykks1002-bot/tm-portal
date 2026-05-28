"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, type Course, type ComparisonResponse, type Script } from "@/lib/api";

// ── 타입 ──────────────────────────────────────────────────────────────────────
interface CompProduct { itemName: string; productName: string; price: string; weakPoints: string[] }
interface CompSummary { id: number; name: string; products: CompProduct[] }

interface SearchHit {
  courseId: number; courseName: string; courseIcon: string;
  competitorName: string; productName: string; price: string; weakPoints: string[];
}

// ── 상수 ──────────────────────────────────────────────────────────────────────
const SIT: Record<string, { label: string; bg: string; text: string; border: string; icon: string }> = {
  타사비교: { label: "타사 비교 중", bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA", icon: "⚔️" },
  가격이의: { label: "가격 이의",   bg: "#FFFBEB", text: "#92400E", border: "#FDE68A", icon: "💸" },
  첫상담:   { label: "첫 상담",     bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE", icon: "👋" },
  재상담:   { label: "재상담",      bg: "#F0FDF4", text: "#166534", border: "#BBF7D0", icon: "🔄" },
};

// ── 유틸 ─────────────────────────────────────────────────────────────────────
function parseCompVal(raw: string): { productName: string; price: string; weakPoints: string[] } {
  const lines = raw.split("\n").filter(Boolean);
  return {
    productName: lines[0] || "",
    price:       lines[1] || "가격 문의",
    weakPoints:  lines.slice(2).filter(l => l.startsWith("❌") || l.startsWith("⚠️")),
  };
}

function buildSummaries(comp: ComparisonResponse): CompSummary[] {
  const map = new Map<number, CompSummary>();
  for (const competitor of comp.competitors) {
    const products: CompProduct[] = [];
    for (const item of comp.items) {
      const raw = item.competitor_values[String(competitor.id)] || "";
      if (!raw || raw.startsWith("해당 상품 없음")) continue;
      const { productName, price, weakPoints } = parseCompVal(raw);
      products.push({ itemName: item.name, productName, price, weakPoints });
    }
    if (products.length) map.set(competitor.id, { id: competitor.id, name: competitor.name, products });
  }
  return Array.from(map.values());
}

// ── 경쟁사 카드 ───────────────────────────────────────────────────────────────
function CompetitorCard({
  summary, courseId, scripts, isExpanded, onToggle,
}: {
  summary: CompSummary;
  courseId: number;
  scripts: Script[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [copied, setCopied] = useState<number | null>(null);

  const copyScript = async (s: Script) => {
    await navigator.clipboard.writeText(s.body_template);
    setCopied(s.id);
    api.recordScriptUse(s.id).catch(() => {});
    setTimeout(() => setCopied(null), 2000);
  };

  const compScripts = scripts.filter(s => s.situation_tag === "타사비교").slice(0, 2);

  return (
    <div className="rounded-2xl overflow-hidden transition-shadow"
         style={{
           background: "var(--surface)",
           border: `1.5px solid ${isExpanded ? "var(--eduwill-navy)" : "var(--border)"}`,
           boxShadow: isExpanded ? "0 4px 16px rgba(28,43,94,0.12)" : "0 1px 4px rgba(0,0,0,0.06)",
         }}>

      {/* 경쟁사명 헤더 */}
      <button className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left"
              onClick={onToggle}
              style={{ background: isExpanded ? "var(--eduwill-navy)" : "var(--surface2)" }}>
        <span className={`text-sm font-bold ${isExpanded ? "text-white" : ""}`}
              style={{ color: isExpanded ? "white" : "var(--eduwill-navy)" }}>
          {summary.name}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium"
                style={{ color: isExpanded ? "rgba(255,255,255,0.6)" : "var(--text-muted)" }}>
            {isExpanded ? "스크립트 열림" : "스크립트 보기"}
          </span>
          <svg className="w-4 h-4 transition-transform duration-200"
               style={{ color: isExpanded ? "var(--eduwill-yellow)" : "var(--text-muted)",
                        transform: isExpanded ? "rotate(180deg)" : "none" }}
               fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* 상품 목록 */}
      <div className="px-4 pt-3 pb-2">
        {summary.products.map((p, pi) => (
          <div key={pi} className={pi > 0 ? "mt-3 pt-3" : ""}
               style={pi > 0 ? { borderTop: "1px dashed var(--border)" } : {}}>
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span className="text-sm font-semibold leading-snug"
                    style={{ color: "var(--text)" }}>
                {p.productName || "상품명 미확인"}
              </span>
              <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{
                      background: p.price === "가격 문의" ? "#F3F4F6" : "#FEF2F2",
                      color:      p.price === "가격 문의" ? "#9CA3AF"  : "#DC2626",
                    }}>
                {p.price}
              </span>
            </div>
            {p.weakPoints.length > 0 && (
              <ul className="space-y-0.5">
                {p.weakPoints.slice(0, 3).map((wp, wi) => (
                  <li key={wi} className="text-xs leading-snug" style={{ color: "#DC2626" }}>{wp}</li>
                ))}
                {p.weakPoints.length > 3 && (
                  <li className="text-xs" style={{ color: "var(--text-muted)" }}>
                    +{p.weakPoints.length - 3}개 더
                  </li>
                )}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* 확장 영역: 타사비교 스크립트 */}
      {isExpanded && (
        <div className="px-4 pb-4" style={{ borderTop: "1px solid var(--border)", marginTop: 4 }}>
          <p className="text-xs font-bold mt-3 mb-2" style={{ color: "var(--text-muted)" }}>
            타사 비교 상담 스크립트
          </p>
          {compScripts.length > 0 ? (
            <div className="space-y-2">
              {compScripts.map(s => (
                <div key={s.id} className="rounded-xl p-3"
                     style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold" style={{ color: "var(--eduwill-navy)" }}>
                      {s.title}
                    </span>
                    <button onClick={() => copyScript(s)}
                            className="shrink-0 text-xs px-2.5 py-1 rounded-lg font-bold transition"
                            style={{
                              background: copied === s.id ? "#DCFCE7" : "white",
                              color:      copied === s.id ? "#166534" : "var(--eduwill-blue)",
                              border:     `1px solid ${copied === s.id ? "#BBF7D0" : "var(--eduwill-blue)"}`,
                            }}>
                      {copied === s.id ? "✓ 복사됨" : "📋 복사"}
                    </button>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-sub)" }}>
                    {s.body_template.slice(0, 120)}{s.body_template.length > 120 ? "…" : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              타사비교 스크립트가 없습니다.{" "}
              <Link href={`/courses/${courseId}?tab=scripts`}
                    className="underline" style={{ color: "var(--eduwill-blue)" }}>
                전체 스크립트 보기
              </Link>
            </p>
          )}
        </div>
      )}

      {/* 하단 버튼 */}
      <div className="px-4 py-2.5 flex gap-2"
           style={{ borderTop: "1px solid var(--border)", background: "var(--surface2)" }}>
        <Link href={`/courses/${courseId}?competitor=${summary.id}`}
              className="flex-1 text-center text-xs py-2 rounded-xl font-bold"
              style={{ background: "var(--eduwill-yellow)", color: "var(--eduwill-navy)" }}>
          전체 비교표
        </Link>
      </div>
    </div>
  );
}

// ── 스크립트 패널 ─────────────────────────────────────────────────────────────
function ScriptPanel({
  scripts, situationTag, courseName, onClose,
}: {
  scripts: Script[]; situationTag: string; courseName: string; onClose: () => void;
}) {
  const [copied, setCopied] = useState<number | null>(null);
  const sit = SIT[situationTag];
  const filtered = scripts.filter(s => s.situation_tag === situationTag);

  const copyScript = async (s: Script) => {
    await navigator.clipboard.writeText(s.body_template);
    setCopied(s.id);
    api.recordScriptUse(s.id).catch(() => {});
    setTimeout(() => setCopied(null), 2000);
  };

  if (!sit) return null;

  return (
    <div className="rounded-2xl overflow-hidden mb-5"
         style={{ border: `1.5px solid ${sit.border}` }}>
      <div className="px-5 py-3 flex items-center justify-between"
           style={{ background: sit.bg }}>
        <div className="flex items-center gap-2">
          <span className="text-base">{sit.icon}</span>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: "white", color: sit.text, border: `1px solid ${sit.border}` }}>
            {sit.label}
          </span>
          <span className="text-sm font-semibold" style={{ color: "var(--eduwill-navy)" }}>
            {courseName} — 스크립트 {filtered.length}개
          </span>
        </div>
        <button onClick={onClose}
                className="text-xs font-bold px-3 py-1.5 rounded-lg"
                style={{ background: "white", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
          닫기
        </button>
      </div>

      {filtered.length > 0 ? (
        <div style={{ background: "var(--surface)" }}>
          {filtered.map((s, i) => (
            <div key={s.id}
                 className="px-5 py-4"
                 style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="font-semibold text-sm" style={{ color: "var(--eduwill-navy)" }}>
                  {s.title}
                </span>
                <button onClick={() => copyScript(s)}
                        className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold transition"
                        style={{
                          background: copied === s.id ? "#DCFCE7" : "var(--surface2)",
                          color:      copied === s.id ? "#166534" : "var(--eduwill-blue)",
                          border:     `1.5px solid ${copied === s.id ? "#BBF7D0" : "var(--eduwill-blue)"}`,
                        }}>
                  {copied === s.id ? "✓ 복사됨" : "📋 복사"}
                </button>
              </div>
              <pre className="text-sm whitespace-pre-wrap leading-relaxed font-sans"
                   style={{ color: "var(--text-sub)" }}>
                {s.body_template}
              </pre>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 py-8 text-center text-sm" style={{ color: "var(--text-muted)", background: "var(--surface)" }}>
          해당 상황의 스크립트가 없습니다.
        </div>
      )}
    </div>
  );
}

// ── 검색 결과 카드 ─────────────────────────────────────────────────────────────
function SearchResultCard({ hit }: { hit: SearchHit }) {
  return (
    <div className="rounded-2xl overflow-hidden"
         style={{ background: "var(--surface)", border: "1px solid var(--border)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div className="px-4 py-2.5 flex items-center justify-between"
           style={{ background: "var(--eduwill-navy)" }}>
        <span className="text-xs font-semibold text-white">
          {hit.courseIcon} {hit.courseName}
        </span>
        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
              style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)" }}>
          {hit.competitorName}
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-sm font-bold" style={{ color: "var(--text)" }}>
            {hit.productName || "상품명 미확인"}
          </span>
          <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-full"
                style={{
                  background: hit.price === "가격 문의" ? "#F3F4F6" : "#FEF2F2",
                  color:      hit.price === "가격 문의" ? "#9CA3AF"  : "#DC2626",
                }}>
            {hit.price}
          </span>
        </div>
        {hit.weakPoints.length > 0 && (
          <ul className="space-y-0.5 mb-3">
            {hit.weakPoints.slice(0, 2).map((wp, i) => (
              <li key={i} className="text-xs" style={{ color: "#DC2626" }}>{wp}</li>
            ))}
          </ul>
        )}
        <Link href={`/courses/${hit.courseId}`}
              className="inline-flex items-center gap-1 text-xs font-bold"
              style={{ color: "var(--eduwill-blue)" }}>
          상세 비교표 보기
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
export default function ConsultPage() {
  const [courses, setCourses]       = useState<Course[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [scripts, setScripts]       = useState<Script[]>([]);
  const [loading, setLoading]       = useState(true);
  const [courseLoading, setCourseLoading] = useState(false);

  const [query, setQuery]           = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [allComps, setAllComps]     = useState<Map<number, ComparisonResponse>>(new Map());

  const [expandedComp, setExpandedComp] = useState<number | null>(null);
  const [activeSit, setActiveSit]       = useState<string | null>(null);

  // 과목 로드
  useEffect(() => {
    api.courses()
      .then(cs => {
        const active = cs.filter(c => c.is_active).sort((a, b) => a.sort_order - b.sort_order);
        setCourses(active);
        if (active.length) setSelectedId(active[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  // 과목별 데이터 로드
  useEffect(() => {
    if (!selectedId) return;
    setCourseLoading(true);
    setExpandedComp(null);
    setActiveSit(null);
    Promise.all([api.comparison(selectedId), api.scripts(selectedId)])
      .then(([comp, sc]) => {
        setComparison(comp);
        setScripts(sc);
        setAllComps(prev => new Map(prev).set(selectedId, comp));
      })
      .finally(() => setCourseLoading(false));
  }, [selectedId]);

  // 전체 검색
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchHits([]); return; }
    let map = allComps;

    if (map.size < courses.length && courses.length > 0) {
      setSearchLoading(true);
      const missing = courses.filter(c => !map.has(c.id));
      const loaded  = await Promise.all(missing.map(c => api.comparison(c.id)));
      const newMap  = new Map(map);
      missing.forEach((c, i) => newMap.set(c.id, loaded[i]));
      setAllComps(newMap);
      map = newMap;
      setSearchLoading(false);
    }

    const lq   = q.toLowerCase();
    const hits: SearchHit[] = [];
    const seen = new Set<string>();

    for (const [cid, comp] of map) {
      const course = courses.find(c => c.id === cid);
      if (!course) continue;

      for (const competitor of comp.competitors) {
        const key = `${cid}-${competitor.id}`;
        if (seen.has(key)) continue;

        for (const item of comp.items) {
          const raw = item.competitor_values[String(competitor.id)] || "";
          const searchText = [competitor.name, course.name, raw, item.name].join(" ").toLowerCase();

          if (searchText.includes(lq)) {
            const { productName, price, weakPoints } = parseCompVal(raw);
            hits.push({
              courseId: cid, courseName: course.name, courseIcon: course.icon,
              competitorName: competitor.name, productName, price,
              weakPoints: weakPoints.slice(0, 3),
            });
            seen.add(key);
            break;
          }
        }
      }
    }

    setSearchHits(hits);
  }, [courses, allComps]);

  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 250);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  const isSearching = query.trim().length > 0;
  const selectedCourse = courses.find(c => c.id === selectedId);
  const summaries = comparison ? buildSummaries(comparison) : [];
  const scriptMap = scripts.reduce<Record<string, Script[]>>((acc, s) => {
    (acc[s.situation_tag] ??= []).push(s);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="w-10 h-10 rounded-full border-[3px] animate-spin"
             style={{ borderColor: "var(--eduwill-yellow)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>

      {/* 헤더 */}
      <header style={{ background: "var(--eduwill-navy)", borderBottom: "3px solid var(--eduwill-yellow)" }}>
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-xs font-medium hover:opacity-80"
                style={{ color: "rgba(255,255,255,0.65)" }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            홈
          </Link>
          <span style={{ color: "rgba(255,255,255,0.25)" }}>│</span>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
               style={{ background: "var(--eduwill-yellow)" }}>
            💬
          </div>
          <div>
            <div className="font-bold text-base text-white">상담 도우미</div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
              경쟁사 즉답 카드 · 상황별 스크립트 · 전체 키워드 검색
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">

        {/* 검색창 */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5" style={{ color: "var(--text-muted)" }}
                 fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder='경쟁사명·상품명·키워드 검색   예: "박문각", "환급", "평생패스"'
            className="w-full pl-12 pr-12 py-4 rounded-2xl text-sm font-medium outline-none"
            style={{
              background: "var(--surface)",
              border: `2px solid ${isSearching ? "var(--eduwill-blue)" : "var(--eduwill-yellow)"}`,
              color: "var(--text)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
              transition: "border-color 0.15s",
            }}
          />
          {query && (
            <button onClick={() => setQuery("")}
                    className="absolute inset-y-0 right-4 flex items-center text-xl font-light"
                    style={{ color: "var(--text-muted)" }}>
              ×
            </button>
          )}
        </div>

        {/* ── 검색 모드 ── */}
        {isSearching ? (
          <div>
            {searchLoading ? (
              <div className="flex flex-col items-center gap-3 py-16">
                <div className="w-8 h-8 rounded-full border-[3px] animate-spin"
                     style={{ borderColor: "var(--eduwill-yellow)", borderTopColor: "transparent" }} />
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>전체 과목 데이터 검색 중…</p>
              </div>
            ) : (
              <>
                <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                  <span className="font-bold" style={{ color: "var(--eduwill-navy)" }}>"{query}"</span>
                  {" "}검색 결과{" "}
                  <span className="font-bold" style={{ color: "var(--eduwill-blue)" }}>
                    {searchHits.length}건
                  </span>
                </p>
                {searchHits.length === 0 ? (
                  <div className="text-center py-16 rounded-2xl"
                       style={{ border: "2px dashed var(--border)", background: "var(--surface2)" }}>
                    <p className="text-lg mb-1">🔍</p>
                    <p className="text-sm font-semibold mb-1" style={{ color: "var(--eduwill-navy)" }}>
                      검색 결과가 없습니다
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      경쟁사명(박문각·해커스 등) 또는 키워드(환급·합격률 등)를 입력해보세요
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {searchHits.map((hit, i) => <SearchResultCard key={i} hit={hit} />)}
                  </div>
                )}
              </>
            )}
          </div>

        ) : (
          /* ── 탐색 모드 ── */
          <div>
            {/* 상황별 스크립트 바로가기 */}
            <div className="mb-5">
              <p className="text-xs font-bold mb-2.5" style={{ color: "var(--text-muted)" }}>
                상황별 스크립트 바로가기
              </p>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(SIT).map(([tag, { label, bg, text, border, icon }]) => {
                  const isActive = activeSit === tag;
                  return (
                    <button key={tag}
                            onClick={() => setActiveSit(isActive ? null : tag)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition"
                            style={{
                              background: isActive ? bg : "var(--surface)",
                              color:      isActive ? text : "var(--text-muted)",
                              border:     isActive ? `1.5px solid ${border}` : "1px solid var(--border)",
                              boxShadow:  isActive ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
                            }}>
                      {icon} {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 스크립트 패널 */}
            {activeSit && (
              <ScriptPanel
                scripts={scripts}
                situationTag={activeSit}
                courseName={selectedCourse?.name ?? ""}
                onClose={() => setActiveSit(null)}
              />
            )}

            {/* 과목 탭 */}
            <div className="mb-5">
              <p className="text-xs font-bold mb-2.5" style={{ color: "var(--text-muted)" }}>
                과목 선택
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1"
                   style={{ msOverflowStyle: "none", scrollbarWidth: "none" }}>
                {courses.map(c => (
                  <button key={c.id}
                          onClick={() => setSelectedId(c.id)}
                          className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition"
                          style={{
                            background: selectedId === c.id ? "var(--eduwill-navy)" : "var(--surface)",
                            color:      selectedId === c.id ? "white" : "var(--text-muted)",
                            border:     selectedId === c.id
                              ? "2px solid var(--eduwill-navy)"
                              : "1px solid var(--border)",
                          }}>
                    {c.icon} {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 경쟁사 카드 */}
            {courseLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 rounded-full border-[3px] animate-spin"
                     style={{ borderColor: "var(--eduwill-yellow)", borderTopColor: "transparent" }} />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    <span className="font-bold" style={{ color: "var(--eduwill-navy)" }}>
                      {selectedCourse?.icon} {selectedCourse?.name}
                    </span>
                    {" "}경쟁사 {summaries.length}개
                  </p>
                  <Link href={`/courses/${selectedId}`}
                        className="text-xs font-bold flex items-center gap-1"
                        style={{ color: "var(--eduwill-blue)" }}>
                    전체 비교표
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>

                {summaries.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {summaries.map(s => (
                      <CompetitorCard
                        key={s.id}
                        summary={s}
                        courseId={selectedId!}
                        scripts={scriptMap["타사비교"] || []}
                        isExpanded={expandedComp === s.id}
                        onToggle={() => setExpandedComp(expandedComp === s.id ? null : s.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 rounded-2xl"
                       style={{ border: "2px dashed var(--border)", background: "var(--surface2)" }}>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      경쟁사 비교 데이터가 없습니다.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
