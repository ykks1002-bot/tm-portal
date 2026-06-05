"use client";

import { useEffect, useState, use, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  api,
  type ComparisonResponse,
  type ComparisonItem,
  type StrengthPoint,
  type Script,
  type FAQ,
} from "@/lib/api";

type Tab = "comparison" | "strengths" | "scripts" | "faq";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "comparison", label: "상품 비교표",    icon: "⚖️" },
  { id: "strengths",  label: "에듀윌 강점",    icon: "🚀" },
  { id: "scripts",    label: "상담 스크립트",  icon: "📞" },
  { id: "faq",        label: "FAQ / 반론 대응", icon: "💬" },
];

const SITUATION_LABEL: Record<string, string> = {
  첫상담:   "첫 상담",
  가격이의: "가격 이의",
  타사비교: "타사 비교 중",
  재상담:   "재상담",
};

const SITUATION_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  첫상담:   { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
  타사비교: { bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA" },
  가격이의: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  재상담:   { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
};

const STRENGTH_COLOR: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  합격실적:   { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE", icon: "🏆" },
  가격경쟁력: { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0", icon: "💰" },
  콘텐츠:     { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A", icon: "📚" },
  지원서비스: { bg: "#F5F3FF", text: "#6D28D9", border: "#DDD6FE", icon: "🎯" },
};

// ── 상품 비교 카드 ─────────────────────────────────────────────────────────────
function ProductCompareCard({
  item,
  competitors,
}: {
  item: ComparisonItem;
  competitors: { id: number; name: string }[];
}) {
  const eduwillLines  = (item.eduwill_value || "").split("\n").filter(Boolean);
  const compEntries   = competitors.map(c => ({
    name: c.name,
    text: item.competitor_values[String(c.id)] || "",
  })).filter(c => c.text);

  // competitor_values의 첫 줄을 타사 상품명으로, 나머지를 특징으로 파싱
  const parseComp = (raw: string) => {
    const lines = raw.split("\n").filter(Boolean);
    return { productName: lines[0] || "", features: lines.slice(1) };
  };

  return (
    <div className="rounded-2xl overflow-hidden"
         style={{ border: "1px solid var(--border)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
      {/* 에듀윌 상품 헤더 */}
      <div className="px-5 py-3 flex items-center justify-between"
           style={{ background: "var(--eduwill-navy)" }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: "var(--eduwill-yellow)", color: "var(--eduwill-navy)" }}>
            에듀윌
          </span>
          <span className="font-bold text-sm text-white">{item.name}</span>
        </div>
        {item.description && (
          <span className="text-sm font-bold" style={{ color: "var(--eduwill-yellow)" }}>
            {item.description}
          </span>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: compEntries.length ? "1fr 1fr" : "1fr" }}>
        {/* 에듀윌 구성 */}
        <div className="p-4" style={{ background: "var(--eduwill-yellow-light)", borderRight: compEntries.length ? "1px solid var(--border)" : "none" }}>
          {item.is_eduwill_advantage && (
            <div className="flex items-center gap-1 mb-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "var(--eduwill-yellow)", color: "var(--eduwill-navy)" }}>
                ★ 에듀윌 우위
              </span>
            </div>
          )}
          <ul className="space-y-1.5">
            {eduwillLines.map((line, i) => {
              const isAdvantage = line.startsWith("✅") || line.startsWith("★") || line.startsWith("🔥");
              return (
                <li key={i} className="flex items-start gap-1.5 text-xs leading-snug">
                  {!isAdvantage && (
                    <span className="mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full"
                          style={{ background: "var(--eduwill-navy)", marginTop: 5 }} />
                  )}
                  <span style={{ color: isAdvantage ? "var(--eduwill-navy)" : "#374151",
                                 fontWeight: isAdvantage ? 700 : 400 }}>
                    {line}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* 타사 비교 */}
        {compEntries.length > 0 && (
          <div className="p-4" style={{ background: "#F8F9FA" }}>
            {compEntries.map((comp, ci) => {
              const { productName, features } = parseComp(comp.text);
              return (
                <div key={ci} className={ci > 0 ? "mt-4 pt-4 border-t border-gray-200" : ""}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: "#E5E7EB", color: "#6B7280" }}>
                      {comp.name}
                    </span>
                    {productName && (
                      <span className="text-xs font-semibold" style={{ color: "#374151" }}>
                        {productName}
                      </span>
                    )}
                  </div>
                  <ul className="space-y-1">
                    {features.map((f, fi) => {
                      const isWeak = f.startsWith("❌") || f.startsWith("⚠️") || f.startsWith("△");
                      return (
                        <li key={fi} className="flex items-start gap-1.5 text-xs leading-snug">
                          {!isWeak && (
                            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-gray-400 mt-1" />
                          )}
                          <span style={{ color: isWeak ? "#DC2626" : "#6B7280" }}>{f}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 비교표 탭 ─────────────────────────────────────────────────────────────────
function ComparisonTable({
  data,
  filterCompetitorId,
  onClearFilter,
}: {
  data: ComparisonResponse;
  filterCompetitorId?: number;
  onClearFilter?: () => void;
}) {
  const hasProducts = data.items.some(i => i.eduwill_value);
  const competitors = filterCompetitorId
    ? data.competitors.filter(c => c.id === filterCompetitorId)
    : data.competitors;
  const filteredName = filterCompetitorId
    ? data.competitors.find(c => c.id === filterCompetitorId)?.name
    : null;

  if (!hasProducts) {
    return <EmptyState message="상품 비교 데이터가 없습니다. 관리자 페이지에서 추가해주세요." />;
  }

  return (
    <div className="space-y-4">
      {/* 경쟁사 필터 배너 */}
      {filteredName && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl"
             style={{ background: "#FEF2F2", border: "1.5px solid #FECACA" }}>
          <span className="text-sm font-semibold" style={{ color: "#B91C1C" }}>
            <span className="font-bold">{filteredName}</span> 비교만 표시 중
          </span>
          <button onClick={onClearFilter}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg"
                  style={{ background: "white", color: "#B91C1C", border: "1px solid #FECACA" }}>
            전체 경쟁사 보기
          </button>
        </div>
      )}

      {/* 범례 */}
      <div className="flex items-center gap-4 text-xs px-1" style={{ color: "var(--text-muted)" }}>
        <span className="flex items-center gap-1">
          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: "var(--eduwill-yellow)", color: "var(--eduwill-navy)" }}>에듀윌</span>
          = 현재 판매 상품 기준
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-red-500 opacity-80" />
          = 타사 약점
        </span>
      </div>

      {data.items.map(item => (
        <ProductCompareCard key={item.id} item={item} competitors={competitors} />
      ))}
    </div>
  );
}

// ── 강점 ──────────────────────────────────────────────────────────────────────
function StrengthsTab({ strengths }: { strengths: StrengthPoint[] }) {
  const categories = Array.from(new Set(strengths.map(s => s.category)));
  const [active, setActive] = useState("전체");
  const filtered = active === "전체" ? strengths : strengths.filter(s => s.category === active);

  return (
    <div>
      <div className="flex gap-2 mb-5 flex-wrap">
        {["전체", ...categories].map(cat => {
          const c = STRENGTH_COLOR[cat];
          const isOn = active === cat;
          return (
            <button key={cat} onClick={() => setActive(cat)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition"
                    style={{
                      background: isOn ? (c?.bg ?? "#EFF6FF") : "var(--surface2)",
                      color: isOn ? (c?.text ?? "var(--eduwill-blue)") : "var(--text-muted)",
                      border: isOn ? `1.5px solid ${c?.border ?? "#BFDBFE"}` : "1px solid var(--border)",
                    }}>
              {c?.icon} {cat}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(sp => {
          const c = STRENGTH_COLOR[sp.category] ?? STRENGTH_COLOR["합격실적"];
          return (
            <div key={sp.id} className="rounded-2xl p-5"
                 style={{ background: "var(--surface)", border: "1px solid var(--border)",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className="font-bold text-sm leading-snug" style={{ color: "var(--eduwill-navy)" }}>
                  {sp.title}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0"
                      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                  {c.icon} {sp.category}
                </span>
              </div>
              {sp.description && (
                <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--text-muted)" }}>
                  {sp.description}
                </p>
              )}
              {sp.evidence_text && (
                <div className="rounded-xl px-3 py-2.5 text-xs leading-relaxed"
                     style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                  📌 {sp.evidence_text}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {filtered.length === 0 && <EmptyState message="해당 카테고리 데이터가 없습니다." />}
    </div>
  );
}

// ── 스크립트 ──────────────────────────────────────────────────────────────────
function ScriptsTab({ scripts }: { scripts: Script[] }) {
  const [activeTag, setActiveTag] = useState("전체");
  const [copied, setCopied]       = useState<number | null>(null);
  const tags     = Array.from(new Set(scripts.map(s => s.situation_tag)));
  const filtered = activeTag === "전체" ? scripts : scripts.filter(s => s.situation_tag === activeTag);

  const copy = async (script: Script) => {
    await navigator.clipboard.writeText(script.body_template);
    setCopied(script.id);
    api.recordScriptUse(script.id).catch(() => {});
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div>
      <div className="flex gap-2 mb-5 flex-wrap">
        {["전체", ...tags].map(tag => {
          const c = SITUATION_COLOR[tag];
          const isOn = activeTag === tag;
          return (
            <button key={tag} onClick={() => setActiveTag(tag)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition"
                    style={{
                      background: isOn ? (c?.bg ?? "#EFF6FF") : "var(--surface2)",
                      color: isOn ? (c?.text ?? "var(--eduwill-blue)") : "var(--text-muted)",
                      border: isOn ? `1.5px solid ${c?.border ?? "#BFDBFE"}` : "1px solid var(--border)",
                    }}>
              {SITUATION_LABEL[tag] ?? tag}
            </button>
          );
        })}
      </div>
      <div className="space-y-4">
        {filtered.map(script => {
          const c = SITUATION_COLOR[script.situation_tag];
          return (
            <div key={script.id} className="rounded-2xl overflow-hidden"
                 style={{ background: "var(--surface)", border: "1px solid var(--border)",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <div className="flex items-center justify-between px-5 py-3.5"
                   style={{ background: c?.bg ?? "#EFF6FF",
                            borderBottom: `1px solid ${c?.border ?? "#BFDBFE"}` }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{ background: "white", color: c?.text ?? "var(--eduwill-blue)",
                                 border: `1px solid ${c?.border ?? "#BFDBFE"}` }}>
                    {SITUATION_LABEL[script.situation_tag] ?? script.situation_tag}
                  </span>
                  <span className="font-semibold text-sm" style={{ color: "var(--eduwill-navy)" }}>
                    {script.title}
                  </span>
                </div>
                <button onClick={() => copy(script)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition"
                        style={{
                          background: copied === script.id ? "#DCFCE7" : "white",
                          color: copied === script.id ? "#166534" : "var(--eduwill-blue)",
                          border: `1.5px solid ${copied === script.id ? "#BBF7D0" : "var(--eduwill-blue)"}`,
                        }}>
                  {copied === script.id ? "✓ 복사됨" : "📋 복사"}
                </button>
              </div>
              <pre className="px-5 py-4 text-sm whitespace-pre-wrap leading-relaxed font-sans"
                   style={{ color: "var(--text)", background: "white" }}>
                {script.body_template}
              </pre>
            </div>
          );
        })}
      </div>
      {filtered.length === 0 && <EmptyState message="해당 상황의 스크립트가 없습니다." />}
    </div>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
function FAQTab({ faqs }: { faqs: FAQ[] }) {
  const [open, setOpen]             = useState<number | null>(null);
  const [activeType, setActiveType] = useState("전체");
  const types   = Array.from(new Set(faqs.map(f => f.objection_type).filter(Boolean)));
  const filtered = activeType === "전체" ? faqs : faqs.filter(f => f.objection_type === activeType);

  return (
    <div>
      <div className="flex gap-2 mb-5 flex-wrap">
        {["전체", ...types].map(t => (
          <button key={t} onClick={() => setActiveType(t!)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition"
                  style={{
                    background: activeType === t ? "#F5F3FF" : "var(--surface2)",
                    color: activeType === t ? "#6D28D9" : "var(--text-muted)",
                    border: activeType === t ? "1.5px solid #DDD6FE" : "1px solid var(--border)",
                  }}>
            {t}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {filtered.map(faq => (
          <div key={faq.id} className="rounded-2xl overflow-hidden"
               style={{ background: "var(--surface)", border: "1px solid var(--border)",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <button className="w-full flex items-center justify-between px-5 py-4 text-left"
                    onClick={() => setOpen(open === faq.id ? null : faq.id)}>
              <div className="flex items-center gap-2.5">
                {faq.objection_type && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0"
                        style={{ background: "#F5F3FF", color: "#6D28D9", border: "1px solid #DDD6FE" }}>
                    {faq.objection_type}
                  </span>
                )}
                <span className="font-semibold text-sm" style={{ color: "var(--eduwill-navy)" }}>
                  Q. {faq.question}
                </span>
              </div>
              <span className="text-lg shrink-0 font-bold"
                    style={{ color: "var(--eduwill-blue)",
                             transform: open === faq.id ? "rotate(45deg)" : "none",
                             display: "inline-block", transition: "transform 0.15s" }}>
                +
              </span>
            </button>
            {open === faq.id && (
              <div className="px-5 pb-5">
                <div className="rounded-xl p-4 text-sm whitespace-pre-line leading-relaxed"
                     style={{ background: "#FFFDF0", color: "var(--text)",
                              borderLeft: "3px solid var(--eduwill-yellow)" }}>
                  <span className="font-bold" style={{ color: "var(--eduwill-blue)" }}>A. </span>
                  {faq.answer}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {filtered.length === 0 && <EmptyState message="해당 유형의 FAQ가 없습니다." />}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16 rounded-2xl"
         style={{ border: "2px dashed var(--border)", background: "var(--surface2)" }}>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{message}</p>
    </div>
  );
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
function CoursePageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id }      = use(params);
  const router      = useRouter();
  const searchParams = useSearchParams();
  const courseId    = parseInt(id);

  const [filterCompetitorId, setFilterCompetitorId] = useState<number | null>(null);

  // useSearchParams는 Suspense 내에서만 안전하게 읽힘 → useEffect로 동기화
  useEffect(() => {
    const param = searchParams?.get("competitor");
    setFilterCompetitorId(param ? parseInt(param) || null : null);
  }, [searchParams]);

  const [tab, setTab]               = useState<Tab>("comparison");
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [strengths, setStrengths]   = useState<StrengthPoint[]>([]);
  const [scripts, setScripts]       = useState<Script[]>([]);
  const [faqs, setFaqs]             = useState<FAQ[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const userRaw  = typeof window !== "undefined" ? localStorage.getItem("tm_user") : null;
  const userRole = userRaw ? JSON.parse(userRaw).role : "";

  const loadData = useCallback((isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    Promise.all([
      api.comparison(courseId),
      api.strengths(courseId),
      api.scripts(courseId),
      api.faq(courseId),
    ])
      .then(([comp, str, sc, fq]) => {
        setComparison(comp); setStrengths(str);
        setScripts(sc);      setFaqs(fq);
      })
      .catch(() => router.replace("/"))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [courseId, router]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading || !comparison) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3"
           style={{ background: "var(--bg)" }}>
        <div className="w-10 h-10 rounded-full border-[3px] animate-spin"
             style={{ borderColor: "var(--eduwill-yellow)", borderTopColor: "transparent" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>데이터 불러오는 중...</p>
      </div>
    );
  }

  const course = comparison.course;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* 헤더 */}
      <header style={{ background: "var(--eduwill-navy)", borderBottom: "3px solid var(--eduwill-yellow)" }}>
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1 text-xs font-medium hover:opacity-80"
                style={{ color: "rgba(255,255,255,0.65)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                 viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>홈
          </Link>
          <span style={{ color: "rgba(255,255,255,0.25)" }}>│</span>
          <span className="text-xl">{course.icon}</span>
          <h1 className="font-bold text-base text-white">{course.name}</h1>
          <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)" }}>
            {course.category}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/"
                  className="text-xs px-3 py-1.5 rounded-lg font-bold"
                  style={{ background: "var(--eduwill-yellow)", color: "var(--eduwill-navy)" }}>
              💬 상담 도우미
            </Link>
            <button onClick={() => loadData(true)} disabled={refreshing}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold transition disabled:opacity-60"
                    style={{ background: "var(--eduwill-yellow)", color: "var(--eduwill-navy)" }}>
              <svg xmlns="http://www.w3.org/2000/svg"
                   className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
                   fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing ? "업데이트 중..." : "새로고침"}
            </button>
            {(userRole === "admin" || userRole === "superadmin") && (
              <Link href={`/admin/courses/${courseId}`}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium"
                    style={{ background: "rgba(255,255,255,0.15)", color: "#fff",
                             border: "1px solid rgba(255,255,255,0.3)" }}>
                데이터 편집
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* 탭 */}
      <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div className="max-w-6xl mx-auto px-6 flex">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
                    className="px-5 py-3.5 text-sm font-semibold transition border-b-2 flex items-center gap-1.5"
                    style={{
                      borderColor: tab === t.id ? "var(--eduwill-yellow)" : "transparent",
                      color: tab === t.id ? "var(--eduwill-navy)" : "var(--text-muted)",
                      background: tab === t.id ? "var(--eduwill-yellow-light)" : "transparent",
                    }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 본문 */}
      <main className="max-w-6xl mx-auto px-6 py-6">
        {tab === "comparison" && (
          <ComparisonTable
            data={comparison}
            filterCompetitorId={filterCompetitorId ?? undefined}
            onClearFilter={() => setFilterCompetitorId(null)}
          />
        )}
        {tab === "strengths"  && <StrengthsTab strengths={strengths} />}
        {tab === "scripts"    && <ScriptsTab scripts={scripts} />}
        {tab === "faq"        && <FAQTab faqs={faqs} />}
      </main>
    </div>
  );
}

// useSearchParams 사용 시 정적 빌드에서 Suspense 필수
export default function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense>
      <CoursePageInner params={params} />
    </Suspense>
  );
}
