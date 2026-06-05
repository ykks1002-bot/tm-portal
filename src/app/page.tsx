"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { api, type Course, type ComparisonResponse } from "@/lib/api";

// ── 타입 ──────────────────────────────────────────────────────────────────────
interface EProduct { name: string; price: string; features: string[] }
interface CProduct { name: string; price: string }
interface CompInfo  { id: number; name: string; products: CProduct[]; advantages: string[] }

// ── 데이터 파싱 ───────────────────────────────────────────────────────────────
function parseEduwill(comp: ComparisonResponse): EProduct[] {
  return comp.items
    .filter(it => it.eduwill_value || it.description)
    .map(it => {
      const lines = (it.eduwill_value || "").split("\n").filter(Boolean);
      return {
        name:     it.name,
        price:    it.description || "가격 문의",
        features: lines
          .filter(l => /^[✅★🔥•\-]/.test(l))
          .map(l => l.replace(/^[✅★🔥•\-]\s*/, "").trim())
          .filter(Boolean)
          .slice(0, 4),
      };
    });
}

function parseCompetitor(comp: ComparisonResponse, cid: number): CompInfo | null {
  const c = comp.competitors.find(x => x.id === cid);
  if (!c) return null;
  const key = String(cid);
  const seenP = new Set<string>(), seenA = new Set<string>();
  const products: CProduct[] = [], advantages: string[] = [];
  for (const it of comp.items) {
    const raw = it.competitor_values[key] || "";
    if (!raw || raw.startsWith("해당 상품 없음")) continue;
    const lines = raw.split("\n").filter(Boolean);
    const name = lines[0] || "", price = lines[1] || "가격 문의";
    if (name && !seenP.has(name)) { seenP.add(name); products.push({ name, price }); }
    for (const l of lines.slice(2)) {
      const cl = l.trim();
      if ((cl.startsWith("❌") || cl.startsWith("⚠️")) && !seenA.has(cl)) {
        seenA.add(cl); advantages.push(cl.replace(/^[❌⚠️]\s*/, ""));
      }
    }
  }
  return { id: cid, name: c.name, products, advantages };
}

// ── Claude API ─────────────────────────────────────────────────────────────────
async function genScript(
  key: string, course: string, sit: string,
  ew: EProduct[], ci: CompInfo
): Promise<string> {
  const sitLabel: Record<string, string> = {
    타사비교: "고객이 타사와 비교 중",
    가격이의: "고객이 가격 이의 제기",
    첫상담:   "첫 번째 상담",
    재상담:   "재상담 고객",
  };
  const prompt = `당신은 에듀윌 TM 상담사 전문 코치입니다.

과목: ${course}
상황: ${sitLabel[sit] || sit}
경쟁사: ${ci.name}

에듀윌 상품:
${ew.map(p => `• ${p.name} (${p.price})${p.features.length ? " - " + p.features.slice(0,2).join(", ") : ""}`).join("\n")}

${ci.name} 상품:
${ci.products.map(p => `• ${p.name}: ${p.price}`).join("\n")}

에듀윌 차별점:
${ci.advantages.slice(0,4).map(a => `• ${a}`).join("\n")}

위 정보를 바탕으로 상담사가 고객에게 바로 말할 수 있는 자연스러운 상담 스크립트를 작성해주세요.
- 경쟁사를 비방하지 않고 에듀윌 강점을 자연스럽게 부각
- 친근하고 전문적인 어조, 1인칭 대화체
- 3~4문장, 200자 내외`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
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
    const e = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(e.error?.message || `API 오류 ${res.status}`);
  }
  const d = await res.json() as { content: { type: string; text: string }[] };
  return d.content.find(x => x.type === "text")?.text || "";
}

// ── API 키 모달 ───────────────────────────────────────────────────────────────
function ApiKeyModal({ onSave, onClose }: { onSave: (k: string) => void; onClose: () => void }) {
  const [v, setV] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="rounded-2xl p-7 max-w-sm w-full mx-4" style={{ background: "var(--surface)", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <p className="text-2xl mb-2">🔑</p>
        <h2 className="font-bold text-base mb-1" style={{ color: "var(--eduwill-navy)" }}>Claude API 키 설정</h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          AI 스크립트 생성에 사용됩니다. 이 브라우저에만 저장되며 서버로 전송되지 않습니다.
        </p>
        <input type="password" placeholder="sk-ant-..." value={v} onChange={e => setV(e.target.value)}
               onKeyDown={e => e.key === "Enter" && v.startsWith("sk-ant-") && onSave(v)}
               className="w-full px-4 py-2.5 rounded-xl text-sm mb-3 outline-none"
               style={{ border: "1.5px solid var(--border)", background: "var(--surface2)", color: "var(--text)" }} />
        <div className="flex gap-2">
          <button onClick={() => v.startsWith("sk-ant-") && onSave(v)}
                  disabled={!v.startsWith("sk-ant-")}
                  className="flex-1 py-2 rounded-xl text-sm font-bold disabled:opacity-40"
                  style={{ background: "var(--eduwill-yellow)", color: "var(--eduwill-navy)" }}>저장</button>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold"
                  style={{ background: "var(--surface2)", color: "var(--text-muted)" }}>닫기</button>
        </div>
      </div>
    </div>
  );
}

// ── 가격 배지 ─────────────────────────────────────────────────────────────────
function PriceBadge({ price, navy }: { price: string; navy?: boolean }) {
  const unknown = price === "가격 문의";
  if (navy) {
    return (
      <span className="shrink-0 text-xs font-bold px-3 py-1 rounded-full"
            style={{ background: "var(--eduwill-yellow)", color: "var(--eduwill-navy)" }}>
        {price}
      </span>
    );
  }
  return (
    <span className="shrink-0 text-xs font-bold px-3 py-1 rounded-full"
          style={{
            background: unknown ? "#F3F4F6" : "#FEF2F2",
            color:      unknown ? "#9CA3AF" : "#DC2626",
          }}>
      {price}
    </span>
  );
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
function HomeInner() {
  const [courses, setCourses]       = useState<Course[]>([]);
  const [courseId, setCourseId]     = useState<number | null>(null);
  const [comp, setComp]             = useState<ComparisonResponse | null>(null);
  const [competitorId, setCompetitorId] = useState<number | null>(null);
  const [loading, setLoading]       = useState(true);
  const [compLoading, setCompLoading] = useState(false);

  const [sit, setSit]               = useState("타사비교");
  const [script, setScript]         = useState("");
  const [scriptLoading, setScriptLoading] = useState(false);
  const [scriptErr, setScriptErr]   = useState("");
  const [copied, setCopied]         = useState(false);
  const [apiKey, setApiKey]         = useState("");
  const [showModal, setShowModal]   = useState(false);
  const scriptEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setApiKey(localStorage.getItem("claude_api_key") || "");
    api.courses().then(cs => {
      const active = cs.filter(c => c.is_active).sort((a, b) => a.sort_order - b.sort_order);
      setCourses(active);
      if (active.length) setCourseId(active[0].id);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!courseId) return;
    setCompLoading(true);
    setComp(null); setCompetitorId(null); setScript("");
    api.comparison(courseId).then(d => {
      setComp(d);
      if (d.competitors.length) setCompetitorId(d.competitors[0].id);
    }).finally(() => setCompLoading(false));
  }, [courseId]);

  const handleGen = useCallback(async () => {
    if (!apiKey) { setShowModal(true); return; }
    if (!comp || competitorId === null) return;
    const ci = parseCompetitor(comp, competitorId);
    if (!ci) return;
    setScriptLoading(true); setScriptErr(""); setScript("");
    try {
      const course = courses.find(c => c.id === courseId);
      const result = await genScript(apiKey, course?.name || "", sit, parseEduwill(comp), ci);
      setScript(result);
      setTimeout(() => scriptEl.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) { setScriptErr((e as Error).message); }
    finally { setScriptLoading(false); }
  }, [apiKey, comp, competitorId, sit, courses, courseId]);

  const handleCopy = useCallback(async () => {
    if (!script) return;
    await navigator.clipboard.writeText(script);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }, [script]);

  const saveKey = useCallback((k: string) => {
    localStorage.setItem("claude_api_key", k);
    setApiKey(k); setShowModal(false);
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="w-10 h-10 rounded-full border-[3px] animate-spin"
           style={{ borderColor: "var(--eduwill-yellow)", borderTopColor: "transparent" }} />
    </div>
  );

  const course  = courses.find(c => c.id === courseId);
  const ewProds = comp ? parseEduwill(comp) : [];
  const ci      = (comp && competitorId !== null) ? parseCompetitor(comp, competitorId) : null;
  const SITS    = [
    { k: "타사비교", l: "⚔️ 타사 비교 중" },
    { k: "가격이의", l: "💸 가격 이의" },
    { k: "첫상담",   l: "👋 첫 상담" },
    { k: "재상담",   l: "🔄 재상담" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {showModal && <ApiKeyModal onSave={saveKey} onClose={() => setShowModal(false)} />}

      {/* ── 헤더 ── */}
      <header style={{ background: "var(--eduwill-navy)", borderBottom: "3px solid var(--eduwill-yellow)" }}>
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
                 style={{ background: "var(--eduwill-yellow)", color: "var(--eduwill-navy)" }}>TM</div>
            <div>
              <div className="font-bold text-sm text-white leading-tight">에듀윌 상담 도우미</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                타사 비교 고객 즉시 응대
              </div>
            </div>
          </div>
          <button onClick={() => setShowModal(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition"
                  style={{
                    background: apiKey ? "rgba(255,255,255,0.1)" : "rgba(255,210,0,0.25)",
                    color:      apiKey ? "rgba(255,255,255,0.65)" : "var(--eduwill-yellow)",
                    border:     `1px solid ${apiKey ? "rgba(255,255,255,0.2)" : "var(--eduwill-yellow)"}`,
                  }}>
            🔑 {apiKey ? "API 키" : "API 키 설정"}
          </button>
        </div>
      </header>

      {/* ── 과목 탭 ── */}
      <div style={{ background: "var(--surface)", borderBottom: "2px solid var(--eduwill-yellow)" }}>
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6">
          <div className="flex gap-0.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {courses.map(c => (
              <button key={c.id} onClick={() => setCourseId(c.id)}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-3 text-xs font-semibold transition border-b-2 whitespace-nowrap"
                      style={{
                        borderColor: courseId === c.id ? "var(--eduwill-navy)" : "transparent",
                        color:       courseId === c.id ? "var(--eduwill-navy)" : "var(--text-muted)",
                        background:  courseId === c.id ? "var(--eduwill-yellow-light)" : "transparent",
                      }}>
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-5">
        {compLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-[3px] animate-spin"
                 style={{ borderColor: "var(--eduwill-yellow)", borderTopColor: "transparent" }} />
          </div>
        ) : comp && (
          <>
            {/* ── 경쟁사 탭 ── */}
            <div className="flex gap-2 flex-wrap mb-4">
              <span className="text-xs font-bold self-center mr-1" style={{ color: "var(--text-muted)" }}>경쟁사</span>
              {comp.competitors.map(c => (
                <button key={c.id} onClick={() => { setCompetitorId(c.id); setScript(""); }}
                        className="px-4 py-2 rounded-xl text-sm font-bold transition"
                        style={{
                          background: competitorId === c.id ? "#1C2B5E" : "var(--surface)",
                          color:      competitorId === c.id ? "white" : "var(--text-muted)",
                          border:     competitorId === c.id ? "2px solid #1C2B5E" : "1.5px solid var(--border)",
                          boxShadow:  competitorId === c.id ? "0 2px 8px rgba(28,43,94,0.2)" : "none",
                        }}>
                  {c.name}
                </button>
              ))}
            </div>

            {/* ── 2컬럼 메인 ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">

              {/* 에듀윌 */}
              <section className="rounded-2xl overflow-hidden"
                       style={{ border: "2px solid var(--eduwill-yellow)", background: "var(--surface)" }}>
                <div className="px-5 py-3 flex items-center gap-2.5"
                     style={{ background: "var(--eduwill-navy)" }}>
                  <span className="text-lg">{course?.icon}</span>
                  <div>
                    <span className="text-xs font-bold block" style={{ color: "var(--eduwill-yellow)" }}>에듀윌</span>
                    <span className="text-sm font-bold text-white">{course?.name}</span>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {ewProds.map((p, i) => (
                    <div key={i} className="rounded-xl p-4"
                         style={{ background: "#FFFCE6", border: "1px solid #FDE68A" }}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="font-bold text-sm leading-snug" style={{ color: "#1C2B5E" }}>{p.name}</span>
                        <PriceBadge price={p.price} navy />
                      </div>
                      {p.features.length > 0 && (
                        <ul className="space-y-0.5 mt-1">
                          {p.features.map((f, fi) => (
                            <li key={fi} className="flex items-center gap-1.5 text-xs" style={{ color: "#374151" }}>
                              <span className="text-green-600">✓</span> {f}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                  {ewProds.length === 0 && (
                    <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>
                      에듀윌 상품 정보 없음
                    </p>
                  )}
                </div>
              </section>

              {/* 경쟁사 */}
              <section className="rounded-2xl overflow-hidden"
                       style={{ border: "1.5px solid var(--border)", background: "var(--surface)" }}>
                <div className="px-5 py-3 flex items-center justify-between" style={{ background: "#F9FAFB" }}>
                  <div>
                    <span className="text-xs font-bold block text-gray-400">경쟁사</span>
                    <span className="text-sm font-bold text-gray-800">
                      {ci?.name || "—"} {course?.name}
                    </span>
                  </div>
                  {ci && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{ background: "#F3F4F6", color: "#6B7280" }}>
                      {ci.products.length}개 상품
                    </span>
                  )}
                </div>

                {ci ? (
                  <div className="p-4 space-y-4">
                    {/* 상품 목록 */}
                    <div>
                      <p className="text-xs font-bold mb-2" style={{ color: "var(--text-muted)" }}>상품 현황</p>
                      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                        {ci.products.length > 0 ? ci.products.map((p, i) => (
                          <div key={i} className="flex items-center justify-between px-4 py-2.5"
                               style={{
                                 borderTop: i > 0 ? "1px solid var(--border)" : "none",
                                 background: i % 2 === 0 ? "var(--surface)" : "var(--surface2)",
                               }}>
                            <span className="text-sm" style={{ color: "var(--text)" }}>{p.name}</span>
                            <PriceBadge price={p.price} />
                          </div>
                        )) : (
                          <div className="px-4 py-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                            상품 정보 없음
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 에듀윌 차별점 */}
                    {ci.advantages.length > 0 && (
                      <div>
                        <p className="text-xs font-bold mb-2" style={{ color: "var(--text-muted)" }}>에듀윌 차별점</p>
                        <div className="rounded-xl p-3 space-y-1.5"
                             style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                          {ci.advantages.slice(0, 5).map((a, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs" style={{ color: "#1D4ED8" }}>
                              <span className="shrink-0 font-bold">✅</span>
                              <span>{a}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    경쟁사를 선택하세요
                  </div>
                )}
              </section>
            </div>

            {/* ── AI 스크립트 ── */}
            <section ref={scriptEl} className="rounded-2xl overflow-hidden"
                     style={{ border: "1.5px solid var(--border)", background: "var(--surface)" }}>
              <div className="px-5 py-3 flex items-center gap-2" style={{ background: "var(--eduwill-navy)" }}>
                <span className="text-base">💬</span>
                <span className="text-sm font-bold text-white">AI 상담 스크립트</span>
                <span className="text-xs px-2 py-0.5 rounded-full ml-1"
                      style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.75)" }}>
                  Claude Haiku
                </span>
              </div>
              <div className="p-5">
                {/* 상황 선택 */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {SITS.map(s => (
                    <button key={s.k} onClick={() => setSit(s.k)}
                            className="px-4 py-1.5 rounded-full text-xs font-bold transition"
                            style={{
                              background: sit === s.k ? "var(--eduwill-navy)" : "var(--surface2)",
                              color:      sit === s.k ? "white" : "var(--text-muted)",
                              border:     sit === s.k ? "none" : "1px solid var(--border)",
                            }}>
                      {s.l}
                    </button>
                  ))}
                </div>

                <button onClick={handleGen} disabled={scriptLoading || !ci}
                        className="w-full py-3 rounded-xl text-sm font-bold transition mb-4 disabled:opacity-50"
                        style={{ background: "var(--eduwill-yellow)", color: "var(--eduwill-navy)" }}>
                  {scriptLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      스크립트 생성 중…
                    </span>
                  ) : `✨ ${ci?.name || ""} 상담 스크립트 생성 — ${SITS.find(s => s.k === sit)?.l}`}
                </button>

                {scriptErr && (
                  <div className="rounded-xl px-4 py-3 mb-3 text-xs"
                       style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }}>
                    ⚠️ {scriptErr}
                    {scriptErr.includes("401") && (
                      <button onClick={() => setShowModal(true)} className="ml-2 underline font-bold">API 키 재설정</button>
                    )}
                  </div>
                )}

                {script ? (
                  <div className="rounded-xl overflow-hidden" style={{ border: "1.5px solid #BFDBFE" }}>
                    <div className="px-4 py-2.5 flex items-center justify-between"
                         style={{ background: "#DBEAFE", borderBottom: "1px solid #BFDBFE" }}>
                      <span className="text-xs font-bold" style={{ color: "#1D4ED8" }}>
                        💬 {ci?.name} · {SITS.find(s => s.k === sit)?.l}
                      </span>
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
                         style={{ color: "#1E3A5F", background: "#EFF6FF" }}>
                      {script}
                    </pre>
                  </div>
                ) : !scriptLoading && !scriptErr && (
                  <div className="text-center py-5 rounded-xl"
                       style={{ border: "2px dashed var(--border)", background: "var(--surface2)" }}>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      상황을 선택하고 버튼을 누르면 AI가 맞춤 상담 스크립트를 작성합니다
                    </p>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeInner />
    </Suspense>
  );
}
