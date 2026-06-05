"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { api, type Course, type ComparisonResponse } from "@/lib/api";

// ── 타입 ──────────────────────────────────────────────────────────────────────
interface CompetitorProduct { name: string; price: string }
interface CompetitorInfo {
  id: number;
  name: string;
  products: CompetitorProduct[];
  advantages: string[]; // 에듀윌 우위 포인트
}
interface EduwillProduct { name: string; price: string; features: string[] }

const SITUATIONS = [
  { key: "타사비교", label: "타사 비교 중", icon: "⚔️" },
  { key: "가격이의", label: "가격 이의",    icon: "💸" },
  { key: "첫상담",   label: "첫 상담",      icon: "👋" },
  { key: "재상담",   label: "재상담",       icon: "🔄" },
];

// ── 데이터 추출 유틸 ──────────────────────────────────────────────────────────
function parseEduwillProducts(comp: ComparisonResponse): EduwillProduct[] {
  return comp.items
    .filter(item => item.eduwill_value)
    .map(item => {
      const lines = (item.eduwill_value || "").split("\n").filter(Boolean);
      const features = lines
        .filter(l => l.startsWith("✅") || l.startsWith("★") || l.startsWith("🔥"))
        .map(l => l.replace(/^[✅★🔥]\s*/, "").trim());
      return {
        name:     item.name,
        price:    item.description || "가격 문의",
        features,
      };
    });
}

function parseCompetitorInfo(comp: ComparisonResponse, competitorId: number): CompetitorInfo | null {
  const competitor = comp.competitors.find(c => c.id === competitorId);
  if (!competitor) return null;

  const cid = String(competitorId);
  const seenProds = new Set<string>();
  const seenAdvs  = new Set<string>();
  const products:   CompetitorProduct[] = [];
  const advantages: string[]            = [];

  for (const item of comp.items) {
    const raw = item.competitor_values[cid] || "";
    if (!raw || raw.startsWith("해당 상품 없음")) continue;
    const lines = raw.split("\n").filter(Boolean);

    // 상품 추출 (중복 제거)
    const prodName  = lines[0] || "";
    const prodPrice = lines[1] || "가격 문의";
    if (prodName && !seenProds.has(prodName)) {
      seenProds.add(prodName);
      products.push({ name: prodName, price: prodPrice });
    }

    // 에듀윌 우위(경쟁사 약점) 수집
    for (const line of lines.slice(2)) {
      const clean = line.trim();
      if ((clean.startsWith("❌") || clean.startsWith("⚠️")) && !seenAdvs.has(clean)) {
        seenAdvs.add(clean);
        advantages.push(clean);
      }
    }
  }

  return { id: competitorId, name: competitor.name, products, advantages };
}

// ── Claude API 스크립트 생성 ───────────────────────────────────────────────────
const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";

async function generateScript(
  apiKey: string,
  courseName: string,
  situation: string,
  eduwillProducts: EduwillProduct[],
  competitorInfo: CompetitorInfo
): Promise<string> {
  const eduwillDesc = eduwillProducts
    .map(p => `• ${p.name} (${p.price})${p.features.length ? " — " + p.features.slice(0,3).join(", ") : ""}`)
    .join("\n");

  const compDesc = competitorInfo.products
    .map(p => `• ${p.name}: ${p.price}`)
    .join("\n");

  const advDesc = competitorInfo.advantages.slice(0, 5)
    .map(a => a.replace(/^[❌⚠️]\s*/, ""))
    .join("\n• ");

  const situationLabel: Record<string, string> = {
    타사비교: "고객이 경쟁사와 비교 중",
    가격이의: "고객이 가격이 비싸다고 이의 제기",
    첫상담:   "첫 번째 상담 전화",
    재상담:   "이전 상담 고객 재연결",
  };

  const prompt = `당신은 에듀윌 TM 상담사를 돕는 전문 상담 코치입니다. 아래 정보를 바탕으로 상담사가 고객과의 통화에서 바로 읽을 수 있는 자연스럽고 설득력 있는 상담 스크립트를 작성하세요.

## 상황
- 과목: ${courseName}
- 상담 상황: ${situationLabel[situation] || situation}
- 언급된 경쟁사: ${competitorInfo.name}

## 에듀윌 상품
${eduwillDesc}

## ${competitorInfo.name} 상품
${compDesc}

## 에듀윌 차별점 (경쟁사 대비)
• ${advDesc}

## 작성 조건
- 상담사가 고객에게 직접 말하는 형태 (1인칭 대화체)
- 경쟁사를 직접 비방하지 않고 에듀윌 강점을 자연스럽게 부각
- 친근하고 전문적인 어조
- 3~4문장, 간결하게
- 한국어로 작성`;

  const res = await fetch(ANTHROPIC_ENDPOINT, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message || `API 오류 (${res.status})`);
  }
  const data = await res.json() as { content: { type: string; text: string }[] };
  return data.content.find(c => c.type === "text")?.text || "";
}

// ── API 키 모달 ───────────────────────────────────────────────────────────────
function ApiKeyModal({ onSave }: { onSave: (key: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
         style={{ background: "rgba(0,0,0,0.55)" }}>
      <div className="rounded-2xl p-8 max-w-md w-full mx-4"
           style={{ background: "var(--surface)", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div className="text-2xl mb-2">🔑</div>
        <h2 className="font-bold text-lg mb-1" style={{ color: "var(--eduwill-navy)" }}>
          Claude API 키 설정
        </h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          AI 상담 스크립트 생성에 Claude API 키가 필요합니다.
          키는 이 브라우저에만 저장되며 서버로 전송되지 않습니다.
        </p>
        <input
          type="password"
          placeholder="sk-ant-..."
          value={val}
          onChange={e => setVal(e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-sm mb-4 outline-none"
          style={{ border: "1.5px solid var(--border)", background: "var(--surface2)", color: "var(--text)" }}
        />
        <div className="flex gap-2">
          <button
            onClick={() => { if (val.startsWith("sk-ant-")) onSave(val); }}
            disabled={!val.startsWith("sk-ant-")}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-40"
            style={{ background: "var(--eduwill-yellow)", color: "var(--eduwill-navy)" }}>
            저장
          </button>
          <button onClick={() => onSave("")}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: "var(--surface2)", color: "var(--text-muted)" }}>
            건너뛰기
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function ConsultPage() {
  const [courses, setCourses]               = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const [comparison, setComparison]         = useState<ComparisonResponse | null>(null);
  const [selectedComp, setSelectedComp]     = useState<number | null>(null);
  const [loading, setCourseLoading]         = useState(true);
  const [compLoading, setCompLoading]       = useState(false);

  const [situation, setSituation]           = useState("타사비교");
  const [script, setScript]                 = useState("");
  const [scriptLoading, setScriptLoading]   = useState(false);
  const [scriptError, setScriptError]       = useState("");
  const [copied, setCopied]                 = useState(false);

  const [apiKey, setApiKey]                 = useState<string | null>(null);
  const [showApiModal, setShowApiModal]     = useState(false);
  const scriptRef = useRef<HTMLDivElement>(null);

  // localStorage에서 API 키 로드
  useEffect(() => {
    const stored = localStorage.getItem("claude_api_key") || "";
    setApiKey(stored);
  }, []);

  // 과목 목록 로드
  useEffect(() => {
    api.courses()
      .then(cs => {
        const active = cs.filter(c => c.is_active).sort((a, b) => a.sort_order - b.sort_order);
        setCourses(active);
        if (active.length) setSelectedCourse(active[0].id);
      })
      .finally(() => setCourseLoading(false));
  }, []);

  // 과목 선택 시 비교 데이터 로드
  useEffect(() => {
    if (!selectedCourse) return;
    setCompLoading(true);
    setComparison(null);
    setSelectedComp(null);
    setScript("");
    api.comparison(selectedCourse)
      .then(comp => {
        setComparison(comp);
        if (comp.competitors.length) setSelectedComp(comp.competitors[0].id);
      })
      .finally(() => setCompLoading(false));
  }, [selectedCourse]);

  const handleSaveApiKey = useCallback((key: string) => {
    localStorage.setItem("claude_api_key", key);
    setApiKey(key);
    setShowApiModal(false);
  }, []);

  const handleGenerateScript = useCallback(async () => {
    if (!apiKey) { setShowApiModal(true); return; }
    if (!comparison || selectedComp === null) return;

    const compInfo = parseCompetitorInfo(comparison, selectedComp);
    if (!compInfo) return;
    const ewProds = parseEduwillProducts(comparison);
    const course  = courses.find(c => c.id === selectedCourse);

    setScriptLoading(true);
    setScriptError("");
    setScript("");
    try {
      const result = await generateScript(
        apiKey,
        course?.name || "",
        situation,
        ewProds,
        compInfo
      );
      setScript(result);
      setTimeout(() => scriptRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      setScriptError((e as Error).message);
    } finally {
      setScriptLoading(false);
    }
  }, [apiKey, comparison, selectedComp, situation, courses, selectedCourse]);

  const handleCopy = useCallback(async () => {
    if (!script) return;
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [script]);

  // 파생 데이터
  const eduwillProducts  = comparison ? parseEduwillProducts(comparison) : [];
  const competitorInfo   = (comparison && selectedComp !== null)
    ? parseCompetitorInfo(comparison, selectedComp) : null;
  const selectedCourseObj = courses.find(c => c.id === selectedCourse);

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

      {showApiModal && <ApiKeyModal onSave={handleSaveApiKey} />}

      {/* 헤더 */}
      <header style={{ background: "var(--eduwill-navy)", borderBottom: "3px solid var(--eduwill-yellow)" }}>
        <div className="max-w-7xl mx-auto px-5 py-3 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1 text-xs font-medium hover:opacity-80"
                style={{ color: "rgba(255,255,255,0.6)" }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>홈
          </Link>
          <span style={{ color: "rgba(255,255,255,0.25)" }}>│</span>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
               style={{ background: "var(--eduwill-yellow)" }}>💬</div>
          <div>
            <div className="font-bold text-sm text-white">상담 어시스턴트</div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
              에듀윌·경쟁사 정보 즉시 확인 + AI 스크립트 생성
            </div>
          </div>
          <div className="ml-auto">
            <button onClick={() => setShowApiModal(true)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
                    style={{ background: apiKey ? "rgba(255,255,255,0.12)" : "rgba(255,200,0,0.2)",
                             color: apiKey ? "rgba(255,255,255,0.7)" : "var(--eduwill-yellow)",
                             border: `1px solid ${apiKey ? "rgba(255,255,255,0.2)" : "var(--eduwill-yellow)"}` }}>
              🔑 {apiKey ? "API 키 변경" : "API 키 설정"}
            </button>
          </div>
        </div>
      </header>

      {/* 과목 탭 */}
      <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-7xl mx-auto px-5">
          <div className="flex gap-1 overflow-x-auto py-2" style={{ scrollbarWidth: "none" }}>
            {courses.map(c => (
              <button key={c.id} onClick={() => setSelectedCourse(c.id)}
                      className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                      style={{
                        background: selectedCourse === c.id ? "var(--eduwill-navy)" : "transparent",
                        color:      selectedCourse === c.id ? "white" : "var(--text-muted)",
                      }}>
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-5 py-5">

        {compLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 rounded-full border-[3px] animate-spin"
                 style={{ borderColor: "var(--eduwill-yellow)", borderTopColor: "transparent" }} />
          </div>
        ) : !comparison ? null : (
          <>
            {/* 경쟁사 탭 */}
            <div className="flex gap-2 flex-wrap mb-5">
              {comparison.competitors.map(c => (
                <button key={c.id} onClick={() => { setSelectedComp(c.id); setScript(""); }}
                        className="px-4 py-2 rounded-xl text-sm font-bold transition"
                        style={{
                          background: selectedComp === c.id ? "var(--eduwill-navy)" : "var(--surface)",
                          color:      selectedComp === c.id ? "white" : "var(--text-muted)",
                          border:     selectedComp === c.id
                            ? "2px solid var(--eduwill-navy)"
                            : "1.5px solid var(--border)",
                        }}>
                  {c.name}
                </button>
              ))}
            </div>

            {/* 메인 2컬럼 */}
            {competitorInfo && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">

                {/* ── 에듀윌 상품 ── */}
                <div className="rounded-2xl overflow-hidden"
                     style={{ border: "2px solid var(--eduwill-yellow)", background: "var(--surface)" }}>
                  <div className="px-5 py-3 flex items-center gap-2"
                       style={{ background: "var(--eduwill-navy)" }}>
                    <span className="text-lg">{selectedCourseObj?.icon}</span>
                    <div>
                      <div className="text-xs font-bold" style={{ color: "var(--eduwill-yellow)" }}>에듀윌</div>
                      <div className="text-sm font-bold text-white">{selectedCourseObj?.name}</div>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    {eduwillProducts.map((p, i) => (
                      <div key={i} className="rounded-xl p-4"
                           style={{ background: "var(--eduwill-yellow-light)",
                                    border: "1px solid var(--eduwill-yellow)" }}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="font-bold text-sm leading-snug"
                                style={{ color: "var(--eduwill-navy)" }}>{p.name}</span>
                          <span className="shrink-0 text-sm font-bold px-3 py-1 rounded-full"
                                style={{ background: "var(--eduwill-navy)", color: "var(--eduwill-yellow)" }}>
                            {p.price}
                          </span>
                        </div>
                        {p.features.length > 0 && (
                          <ul className="space-y-0.5">
                            {p.features.map((f, fi) => (
                              <li key={fi} className="text-xs flex items-center gap-1.5"
                                  style={{ color: "var(--eduwill-navy)" }}>
                                <span className="text-green-600 font-bold">✓</span> {f}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── 경쟁사 상품 ── */}
                <div className="rounded-2xl overflow-hidden"
                     style={{ border: "1.5px solid var(--border)", background: "var(--surface)" }}>
                  <div className="px-5 py-3 flex items-center justify-between"
                       style={{ background: "#F3F4F6" }}>
                    <div>
                      <div className="text-xs font-bold text-gray-500">경쟁사</div>
                      <div className="text-sm font-bold" style={{ color: "#374151" }}>
                        {competitorInfo.name} {selectedCourseObj?.name}
                      </div>
                    </div>
                    <Link href={`/courses/${selectedCourse}`}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium"
                          style={{ background: "white", color: "var(--eduwill-blue)",
                                   border: "1px solid var(--border)" }}>
                      상세 비교표 →
                    </Link>
                  </div>

                  <div className="p-4">
                    {/* 상품 목록 */}
                    <p className="text-xs font-bold mb-2" style={{ color: "var(--text-muted)" }}>상품 현황</p>
                    <div className="space-y-2 mb-4">
                      {competitorInfo.products.length > 0 ? (
                        competitorInfo.products.map((p, i) => (
                          <div key={i} className="flex items-center justify-between py-2 px-3 rounded-xl"
                               style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                            <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                              {p.name}
                            </span>
                            <span className="text-sm font-bold shrink-0 ml-2"
                                  style={{
                                    color:      p.price === "가격 문의" ? "#9CA3AF" : "#DC2626",
                                    background: p.price === "가격 문의" ? "#F3F4F6" : "#FEF2F2",
                                    padding: "2px 10px",
                                    borderRadius: "999px",
                                  }}>
                              {p.price}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>
                          상품 정보 없음
                        </p>
                      )}
                    </div>

                    {/* 에듀윌 우위 포인트 */}
                    {competitorInfo.advantages.length > 0 && (
                      <>
                        <p className="text-xs font-bold mb-2" style={{ color: "var(--text-muted)" }}>
                          에듀윌 차별점
                        </p>
                        <div className="rounded-xl p-3"
                             style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                          <ul className="space-y-1">
                            {competitorInfo.advantages.slice(0, 5).map((a, i) => (
                              <li key={i} className="text-xs flex items-start gap-1.5"
                                  style={{ color: "#1D4ED8" }}>
                                <span className="shrink-0 font-bold">✅</span>
                                <span>{a.replace(/^[❌⚠️]\s*/, "")}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── AI 스크립트 생성 ── */}
            <div className="rounded-2xl overflow-hidden"
                 style={{ border: "1.5px solid var(--border)", background: "var(--surface)" }}
                 ref={scriptRef}>
              <div className="px-5 py-3 flex items-center justify-between"
                   style={{ background: "var(--eduwill-navy)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-base">💬</span>
                  <span className="font-bold text-sm text-white">AI 상담 스크립트</span>
                  <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)" }}>
                    Claude Haiku
                  </span>
                </div>
                {!apiKey && (
                  <button onClick={() => setShowApiModal(true)}
                          className="text-xs px-3 py-1.5 rounded-lg font-bold"
                          style={{ background: "var(--eduwill-yellow)", color: "var(--eduwill-navy)" }}>
                    API 키 설정 필요
                  </button>
                )}
              </div>

              <div className="p-5">
                {/* 상황 선택 */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {SITUATIONS.map(s => (
                    <button key={s.key} onClick={() => setSituation(s.key)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition"
                            style={{
                              background: situation === s.key ? "var(--eduwill-navy)" : "var(--surface2)",
                              color:      situation === s.key ? "white" : "var(--text-muted)",
                              border:     situation === s.key ? "none" : "1px solid var(--border)",
                            }}>
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>

                {/* 생성 버튼 */}
                <button
                  onClick={handleGenerateScript}
                  disabled={scriptLoading || !competitorInfo}
                  className="w-full py-3 rounded-xl text-sm font-bold transition mb-4 disabled:opacity-50"
                  style={{ background: "var(--eduwill-yellow)", color: "var(--eduwill-navy)" }}>
                  {scriptLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      스크립트 생성 중…
                    </span>
                  ) : (
                    `✨ ${competitorInfo?.name || ""} 대상 ${SITUATIONS.find(s => s.key === situation)?.label} 스크립트 생성`
                  )}
                </button>

                {/* 오류 */}
                {scriptError && (
                  <div className="rounded-xl px-4 py-3 mb-3 text-xs"
                       style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }}>
                    ⚠️ {scriptError}
                    {scriptError.includes("401") && (
                      <button onClick={() => setShowApiModal(true)} className="ml-2 underline font-bold">
                        API 키 재설정
                      </button>
                    )}
                  </div>
                )}

                {/* 생성된 스크립트 */}
                {script && (
                  <div className="rounded-xl overflow-hidden"
                       style={{ border: "1.5px solid #BFDBFE", background: "#EFF6FF" }}>
                    <div className="px-4 py-2.5 flex items-center justify-between"
                         style={{ background: "#DBEAFE", borderBottom: "1px solid #BFDBFE" }}>
                      <div className="flex items-center gap-2 text-xs font-bold" style={{ color: "#1D4ED8" }}>
                        <span>💬</span>
                        <span>{competitorInfo?.name} · {SITUATIONS.find(s => s.key === situation)?.label}</span>
                      </div>
                      <button onClick={handleCopy}
                              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold transition"
                              style={{
                                background: copied ? "#DCFCE7" : "white",
                                color:      copied ? "#166534" : "#1D4ED8",
                                border:     `1px solid ${copied ? "#BBF7D0" : "#BFDBFE"}`,
                              }}>
                        {copied ? "✓ 복사됨" : "📋 복사"}
                      </button>
                    </div>
                    <pre className="px-5 py-4 text-sm whitespace-pre-wrap leading-relaxed font-sans"
                         style={{ color: "#1E3A5F" }}>
                      {script}
                    </pre>
                  </div>
                )}

                {/* 미생성 안내 */}
                {!script && !scriptLoading && !scriptError && (
                  <div className="text-center py-6 rounded-xl"
                       style={{ border: "2px dashed var(--border)", background: "var(--surface2)" }}>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      상황을 선택하고 생성 버튼을 누르면 AI가 맞춤 스크립트를 작성합니다
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
