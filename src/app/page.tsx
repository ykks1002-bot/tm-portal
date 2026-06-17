"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { api, type Course, type ComparisonResponse, type Script, type ScrapeStatus } from "@/lib/api";

// ── 타입 ──────────────────────────────────────────────────────────────────────
interface EProduct { name: string; price: string; features: string[] }
interface CProduct { name: string; price: string }
interface CompInfo  { id: number; name: string; products: CProduct[]; advantages: string[] }

// ── 사이트 바로가기 URL 맵 ──────────────────────────────────────────────────────

// 에듀윌 과목별 상품 페이지 (직접 확인용)
const EDUWILL_URLS: Record<string, string> = {
  "공인중개사":   "https://land.eduwill.net/",
  "주택관리사":   "https://house.eduwill.net/",
  "행정사":       "https://admin.eduwill.net/",
  "사회복지사1급": "https://social.eduwill.net/",
  "9급공무원":    "https://civil.eduwill.net/",
  "경비지도사":   "https://guard.eduwill.net/",
  "전기기사":     "https://elec.eduwill.net/",
  "소방설비기사": "https://fire.eduwill.net/",
  "계리직공무원": "https://kpost.eduwill.net/",
  "검정고시":     "https://pass.eduwill.net/",
  "손해평가사":   "https://sp.eduwill.net/sites/home",
};

// 경쟁사별·과목별 수강료 확인 페이지 (스크래퍼 확인 URL 기준)
const COMPETITOR_URLS: Record<string, Record<string, string>> = {
  "박문각": {
    "공인중개사":   "https://www.pmg.co.kr/user/plo/event/event_allpass.asp",
    "주택관리사":   "https://www.pmg.co.kr/user/pho/main.asp",
    "행정사":       "https://www.pmg.co.kr/user/phjo/main.asp",
    "사회복지사1급": "https://www.pmg.co.kr/user/human/main.asp",
    "9급공무원":    "https://www.pmg.co.kr/user/pno/main.asp",
    "손해평가사":   "https://www.pmg.co.kr/user/spo/main.asp",
  },
  "해커스": {
    "공인중개사":   "https://land.hackers.com/",
    "주택관리사":   "https://house.hackers.com/",
    "사회복지사1급": "https://sabok.edu2080.co.kr/",
    "검정고시":     "https://gumjung.edu2080.co.kr/",
    "9급공무원":    "https://egosi.hackers.com/site/?c=lec_9&bcart=1",
    "계리직공무원": "https://egosi.hackers.com/site/?c=lec_accounting",
  },
  "메가랜드": {
    "공인중개사":   "https://www.megaland.co.kr/lecture/",
  },
  "합격의법학원": {
    "행정사":       "https://adm.lawschool.co.kr/nlawschool/lecture/lecture.asp?field=35",
  },
  "시대에듀": {
    "경비지도사":   "https://www.sdedu.co.kr/cp/?cat_id=001002",
  },
  "에듀피디": {
    "경비지도사":   "https://www.edupd.com/lectureMK01/autolecture.htm?here=licence&pk=PK0000008L&tap=0",
  },
  "다산에듀": {
    "전기기사":     "https://www.e-dasan.net/shopList?cat=13",
  },
  "대산전기": {
    "전기기사":     "https://www.dsan.co.kr/online/main/index.jsp",
  },
  "모아바": {
    "소방설비기사": "https://fireegfp.moa-ba.com/lecture.php?code=010301&menu_code=0107",
  },
  "성안당": {
    "소방설비기사": "https://bm.cyber.co.kr/lecture.php?action=list&code=01010101",
  },
  "배울학": {
    "소방설비기사": "https://fire.baeulhak.com/",
  },
  "공단기": {
    "9급공무원":    "https://gong.conects.com/freepass/renewal/9th",
  },
  "넥스트공무원": {
    "9급공무원":    "https://www.megagong.net/s/gong/pass/double_sale_2026.asp",
  },
  "검스타트": {
    "검정고시":     "https://gumstart.sinjiwonedu.co.kr/",
  },
  "국자감": {
    "검정고시":     "http://www.kukjagam.co.kr/",
  },
  "유상통": {
    "계리직공무원": "https://yusangtong.com/",
  },
  "지안에듀": {
    "계리직공무원": "https://www.jianedu.co.kr/",
  },
  "계리단기": {
    "계리직공무원": "https://kaeri-danki.com/",
  },
  "에듀야": {
    "손해평가사":   "https://sh.eduyaa.com/main/",
  },
};

function getLinkUrl(competitorName: string | undefined, courseName: string | undefined): string {
  if (!competitorName || !courseName) return "";
  return COMPETITOR_URLS[competitorName]?.[courseName] ?? "";
}

function getEduwillUrl(courseName: string | undefined): string {
  if (!courseName) return "";
  return EDUWILL_URLS[courseName] ?? "";
}

// ── 바로가기 버튼 ──────────────────────────────────────────────────────────────
function LinkButton({ url, light }: { url: string; light?: boolean }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
       onClick={e => e.stopPropagation()}
       className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-semibold transition shrink-0"
       style={{
         background: light ? "rgba(255,255,255,0.15)" : "rgba(28,43,94,0.08)",
         color:      light ? "rgba(255,255,255,0.9)"  : "var(--accent)",
         border:     light ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(79,127,255,0.3)",
         textDecoration: "none",
       }}>
      바로가기
      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}

// ── 카테고리 정의 ─────────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: "all",  label: "전체" },
  { key: "전문자격", label: "전문자격" },
  { key: "학력인증", label: "학력인증" },
  { key: "기술자격", label: "기술자격" },
  { key: "공무원",   label: "공무원" },
] as const;

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
          .filter(Boolean).slice(0, 4),
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

// ── 가격 파싱 / 비교 ─────────────────────────────────────────────────────────
function parsePrice(str: string): number | null {
  const m = str.match(/[\d,]+/);
  if (!m) return null;
  const n = parseInt(m[0].replace(/,/g, ""), 10);
  return n >= 10000 ? n : null;
}

function fmtWon(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

interface PriceSummary {
  eduwillMin: number | null;
  competitorMin: number | null;
  diff: number | null;
  eduwillCheaper: boolean;
  hasPrices: boolean;
}

function calcPriceSummary(ew: EProduct[], ci: CompInfo | null): PriceSummary {
  const ewPrices = ew.map(p => parsePrice(p.price)).filter((n): n is number => n !== null);
  const ciPrices = ci?.products.map(p => parsePrice(p.price)).filter((n): n is number => n !== null) ?? [];
  const eduwillMin = ewPrices.length ? Math.min(...ewPrices) : null;
  const competitorMin = ciPrices.length ? Math.min(...ciPrices) : null;
  const diff = eduwillMin !== null && competitorMin !== null ? competitorMin - eduwillMin : null;
  return {
    eduwillMin,
    competitorMin,
    diff,
    eduwillCheaper: diff !== null && diff > 0,
    hasPrices: eduwillMin !== null && competitorMin !== null,
  };
}

// ── 데이터 신선도 ──────────────────────────────────────────────────────────────
interface DataAge { hours: number; label: string; color: string; bg: string; warn: boolean }

function getDataAge(isoDate: string | null | undefined): DataAge {
  if (!isoDate) return { hours: 9999, label: "업데이트 기록 없음", color: "#DC2626", bg: "#FEF2F2", warn: true };
  const hours = Math.floor((Date.now() - new Date(isoDate).getTime()) / 3_600_000);
  if (hours < 8)  return { hours, label: `${hours}시간 전 확인됨`, color: "#16A34A", bg: "#F0FDF4", warn: false };
  if (hours < 24) return { hours, label: `${hours}시간 전 확인됨`, color: "#D97706", bg: "#FFFBEB", warn: true };
  const days = Math.floor(hours / 24);
  return { hours, label: `${days}일 전 확인됨 — 가격이 변경됐을 수 있습니다`, color: "#DC2626", bg: "#FEF2F2", warn: true };
}

// ── AI 스크립트 생성 ──────────────────────────────────────────────────────────

const ALL_COMPETITORS = [
  "해커스", "박문각", "메가랜드", "공단기", "시대에듀", "에듀피디",
  "넥스트공무원", "지안에듀", "유상통", "계리단기", "국자감", "검스타트",
  "다산에듀", "대산전기", "모아바", "성안당", "배울학", "에듀야", "합격의법학원",
];

function filterAdvantages(advantages: string[], targetCompetitor: string): string[] {
  const others = ALL_COMPETITORS.filter(c => c !== targetCompetitor);
  return advantages.filter(a => !others.some(c => a.includes(c)));
}

function buildPrompt(course: string, sit: string, ew: EProduct[], ci: CompInfo): string {
  const sitLabel: Record<string, string> = {
    타사비교: "고객이 타사와 비교 중",
    가격이의: "고객이 가격 이의 제기",
    첫상담:   "첫 번째 상담",
    재상담:   "재상담 고객",
  };

  const cleanAdvantages = filterAdvantages(ci.advantages, ci.name).slice(0, 4);

  return `당신은 에듀윌 TM 상담사 전문 코치입니다.
고객이 비교하는 경쟁사는 오직 【${ci.name}】입니다.
스크립트에서 반드시 【${ci.name}】만 언급하고, 다른 경쟁사(해커스·박문각·공단기 등)는 절대 언급하지 마세요.

[상담 정보]
과목: ${course}
상황: ${sitLabel[sit] || sit}
비교 대상: ${ci.name}

[에듀윌 상품]
${ew.map(p => `• ${p.name} (${p.price})`).join("\n")}

[${ci.name} 상품]
${ci.products.length > 0
  ? ci.products.map(p => `• ${p.name}: ${p.price}`).join("\n")
  : "• 상품 정보 없음"}

[에듀윌의 ${ci.name} 대비 강점]
${cleanAdvantages.length > 0
  ? cleanAdvantages.map(a => `• ${a}`).join("\n")
  : "• 합격률, 강사진, 학습관리 시스템 우위"}

[작성 조건]
- 비교 대상은 반드시 ${ci.name}만 언급 (다른 경쟁사명 사용 금지)
- ${ci.name}을 직접 비방하지 않고 에듀윌 강점 자연스럽게 부각
- 친근하고 전문적인 한국어 1인칭 대화체
- 3~4문장, 200자 내외로 간결하게
- 바로 사용 가능한 완성형 스크립트만 작성`;
}

const GEMINI_FALLBACK_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash-8b",
  "gemini-1.5-flash",
];

async function genWithGemini(key: string, prompt: string): Promise<string> {
  let lastErr = "";
  for (const model of GEMINI_FALLBACK_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      const data = await res.json() as {
        candidates?: { content: { parts: { text: string }[] } }[];
        error?: { message?: string; code?: number };
      };
      if (!res.ok || data.error) {
        const msg = data.error?.message || `Gemini 오류 ${res.status}`;
        // 할당량 초과 또는 모델 미지원 → 다음 모델 시도
        if (res.status === 429 || res.status === 403 ||
            msg.toLowerCase().includes("quota") ||
            msg.toLowerCase().includes("exhausted") ||
            msg.toLowerCase().includes("not found") ||
            msg.toLowerCase().includes("limit")) {
          lastErr = `${model}: ${msg.slice(0, 80)}`;
          continue;
        }
        throw new Error(msg);
      }
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("quota") || msg.includes("exhausted") || msg.includes("limit") || msg.includes("not found")) {
        lastErr = `${model}: ${msg.slice(0, 80)}`;
        continue;
      }
      throw e;
    }
  }
  throw new Error(`모든 Gemini 모델 할당량 초과. 마지막 오류: ${lastErr}`);
}

async function genWithGroq(key: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 600,
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(e.error?.message || `Groq 오류 ${res.status}`);
  }
  const d = await res.json() as { choices: { message: { content: string } }[] };
  return d.choices?.[0]?.message?.content || "";
}

async function genWithClaude(key: string, prompt: string): Promise<string> {
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
    throw new Error(e.error?.message || `Claude 오류 ${res.status}`);
  }
  const d = await res.json() as { content: { type: string; text: string }[] };
  return d.content.find(x => x.type === "text")?.text || "";
}

async function genScript(key: string, course: string, sit: string, ew: EProduct[], ci: CompInfo): Promise<string> {
  const prompt = buildPrompt(course, sit, ew, ci);
  if (key.startsWith("sk-ant-")) return genWithClaude(key, prompt);
  if (key.startsWith("gsk_"))    return genWithGroq(key, prompt);
  return genWithGemini(key, prompt);
}

function detectKeyType(key: string): "groq" | "claude" | "gemini" | "" {
  if (!key) return "";
  if (key.startsWith("sk-ant-")) return "claude";
  if (key.startsWith("gsk_"))    return "groq";
  if (key.length >= 10)          return "gemini";
  return "";
}

function isAuthError(msg: string) {
  return msg.includes("invalid") || msg.includes("401") || msg.includes("authentication") ||
         msg.includes("Unauthorized") || msg.includes("API_KEY_INVALID") || msg.includes("403");
}

// ── API 키 모달 ───────────────────────────────────────────────────────────────
function ApiKeyModal({ onSave, onClose }: { onSave: (k: string) => void; onClose: () => void }) {
  const [v, setV] = useState("");
  const keyType = detectKeyType(v);
  const valid = keyType !== "";

  const labelMap: Record<string, string> = {
    groq: "Groq 저장",
    claude: "Claude 저장",
    gemini: "Gemini 저장",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="rounded-2xl p-6 max-w-md w-full mx-4" style={{ background: "var(--surface)", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <h2 className="font-bold text-base mb-4" style={{ color: "var(--eduwill-navy)" }}>🔑 AI 스크립트 API 키</h2>

        {/* Groq - 최우선 추천 */}
        <div className="rounded-xl p-3.5 mb-3" style={{ background: "#F0FDF4", border: "2px solid #86EFAC" }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#16A34A", color: "white" }}>무료 · 추천</span>
            <span className="text-xs font-bold" style={{ color: "#15803D" }}>Groq (Llama 3.3)</span>
            <span className="text-xs ml-auto" style={{ color: "#16A34A" }}>한국 정상작동 ✓</span>
          </div>
          <p className="text-xs" style={{ color: "#166534" }}>
            <strong>console.groq.com</strong> → API Keys → Create API Key → 무료 발급
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#166534", opacity: 0.8 }}>
            키 형식: <strong>gsk_...</strong> · 하루 14,400회 무료 · 카드 불필요
          </p>
        </div>

        {/* Gemini */}
        <div className="rounded-xl p-3 mb-3" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#F59E0B", color: "white" }}>무료 (지역제한)</span>
            <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>Google Gemini</span>
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            aistudio.google.com → Get API key · 키 형식: AIza... 또는 AQ...
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#D97706" }}>
            ⚠️ 한국 계정에서 할당량 0 오류 발생 시 Groq 사용 권장
          </p>
        </div>

        {/* Claude */}
        <div className="rounded-xl p-3 mb-4" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#6B7280", color: "white" }}>유료</span>
            <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>Claude (Anthropic)</span>
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>console.anthropic.com → API Keys · 키 형식: sk-ant-...</p>
        </div>

        <input type="password"
               placeholder="gsk_... (Groq) / AIza... (Gemini) / sk-ant-... (Claude)"
               value={v} onChange={e => setV(e.target.value)}
               onKeyDown={e => e.key === "Enter" && valid && onSave(v)}
               className="w-full px-4 py-2.5 rounded-xl text-sm mb-3 outline-none"
               style={{
                 border: `1.5px solid ${valid ? "#16A34A" : "var(--border)"}`,
                 background: "var(--surface2)", color: "var(--text)",
               }} />

        {v && !valid && (
          <p className="text-xs mb-2" style={{ color: "#DC2626" }}>키를 10자 이상 입력해주세요</p>
        )}
        {keyType === "groq" && (
          <p className="text-xs mb-2 font-medium" style={{ color: "#16A34A" }}>✓ Groq API 키 감지됨</p>
        )}

        <div className="flex gap-2">
          <button onClick={() => valid && onSave(v)} disabled={!valid}
                  className="flex-1 py-2 rounded-xl text-sm font-bold disabled:opacity-40"
                  style={{ background: "var(--eduwill-yellow)", color: "var(--eduwill-navy)" }}>
            {keyType ? labelMap[keyType] : "저장"}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold"
                  style={{ background: "var(--surface2)", color: "var(--text-muted)" }}>닫기</button>
        </div>
      </div>
    </div>
  );
}

// ── 어드민 인라인 로그인 모달 ────────────────────────────────────────────────
function AdminLoginModal({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [email, setEmail]   = useState("");
  const [pw, setPw]         = useState("");
  const [err, setErr]       = useState("");
  const [loading, setLoading] = useState(false);

  const doLogin = async () => {
    setErr(""); setLoading(true);
    try {
      const res = await api.login(email, pw);
      if (res.user_role !== "admin" && res.user_role !== "superadmin") {
        throw new Error("어드민 권한이 없습니다");
      }
      localStorage.setItem("tm_token", res.access_token);
      localStorage.setItem("tm_user", JSON.stringify({ name: res.user_name, role: res.user_role }));
      onSuccess();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="rounded-2xl p-6 w-full max-w-sm mx-4"
           style={{ background: "var(--surface)", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-sm" style={{ color: "var(--eduwill-navy)" }}>⚙️ 어드민 로그인</h2>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}>✕</button>
        </div>
        <input type="email" placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)}
               className="w-full px-4 py-2.5 rounded-xl text-sm mb-2 outline-none"
               style={{ background: "var(--surface2)", border: "1.5px solid var(--border)", color: "var(--text)" }} />
        <input type="password" placeholder="비밀번호" value={pw} onChange={e => setPw(e.target.value)}
               onKeyDown={e => e.key === "Enter" && doLogin()}
               className="w-full px-4 py-2.5 rounded-xl text-sm mb-3 outline-none"
               style={{ background: "var(--surface2)", border: "1.5px solid var(--border)", color: "var(--text)" }} />
        {err && <p className="text-xs mb-2" style={{ color: "#DC2626" }}>{err}</p>}
        <button onClick={doLogin} disabled={loading || !email || !pw}
                className="w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
                style={{ background: "var(--eduwill-navy)", color: "white" }}>
          {loading ? "로그인 중…" : "로그인"}
        </button>
      </div>
    </div>
  );
}

// ── 어드민 드롭다운 패널 ──────────────────────────────────────────────────────
function AdminDropdown({ onClose, onLogout, courseId }: { onClose: () => void; onLogout: () => void; courseId: number | null }) {
  const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const items = [
    { icon: "🏠", label: "어드민 대시보드",     href: `${BASE_PATH}/admin` },
    { icon: "💰", label: "가격 관리",           href: `${BASE_PATH}/admin/prices` },
    { icon: "📅", label: "시험 정보 / 취업 전망", href: `${BASE_PATH}/admin/exam-info` },
    { icon: "📚", label: "과목 관리",           href: `${BASE_PATH}/admin/courses` },
  ];
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-2 w-52 rounded-xl overflow-hidden z-50"
           style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 8px 30px rgba(0,0,0,0.2)" }}>
        {items.map(it => (
          <Link key={it.href} href={it.href} onClick={onClose}
                className="flex items-center gap-2.5 px-4 py-3 text-sm transition hover:opacity-80"
                style={{ color: "var(--text)", borderBottom: "1px solid var(--border)" }}>
            <span>{it.icon}</span>{it.label}
          </Link>
        ))}
        <button onClick={onLogout}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm transition hover:opacity-80"
                style={{ color: "#DC2626" }}>
          <span>🚪</span>로그아웃
        </button>
      </div>
    </>
  );
}

// ── 가격 배지 ─────────────────────────────────────────────────────────────────
function PriceBadge({ price, navy }: { price: string; navy?: boolean }) {
  const unknown = price === "가격 문의" || price === "미확인";
  if (navy) return (
    <span className="shrink-0 text-xs font-bold px-3 py-1 rounded-full"
          style={{ background: "var(--eduwill-yellow)", color: "var(--eduwill-navy)" }}>{price}</span>
  );
  return (
    <span className="shrink-0 text-xs font-bold px-3 py-1 rounded-full"
          style={{ background: unknown ? "#F3F4F6" : "#FEF2F2", color: unknown ? "#9CA3AF" : "#DC2626" }}>
      {unknown ? "현재가 미확인" : price}
    </span>
  );
}

// ── 가격 비교 요약 배너 ────────────────────────────────────────────────────────
function PriceSummaryBanner({ summary, competitorName }: { summary: PriceSummary; competitorName: string }) {
  if (!summary.hasPrices) {
    return (
      <div className="rounded-xl px-4 py-3 flex items-center gap-2 mb-4 text-xs"
           style={{ background: "#F9FAFB", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
        <span>⚠️</span>
        <span><strong>{competitorName}</strong> 현재 가격 자동 수집 불가 — 수동 확인 또는 관리자 업데이트 필요</span>
      </div>
    );
  }
  const { diff, eduwillCheaper, eduwillMin, competitorMin } = summary;
  if (diff === null) return null;
  const absDiff = Math.abs(diff);

  return (
    <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 mb-4"
         style={{
           background: eduwillCheaper ? "#F0FDF4" : "#FEF2F2",
           border: `1.5px solid ${eduwillCheaper ? "#86EFAC" : "#FECACA"}`,
         }}>
      <div className="flex items-center gap-2.5">
        <span className="text-lg">{eduwillCheaper ? "💚" : "⚠️"}</span>
        <div>
          <p className="text-sm font-bold" style={{ color: eduwillCheaper ? "#166534" : "#991B1B" }}>
            {eduwillCheaper
              ? `에듀윌이 ${fmtWon(absDiff)} 더 저렴`
              : `${competitorName}이 ${fmtWon(absDiff)} 더 저렴`}
          </p>
          <p className="text-xs mt-0.5" style={{ color: eduwillCheaper ? "#16A34A" : "#DC2626" }}>
            에듀윌 최저 {fmtWon(eduwillMin!)} vs {competitorName} 최저 {fmtWon(competitorMin!)}
          </p>
        </div>
      </div>
      {!eduwillCheaper && (
        <span className="text-xs px-2.5 py-1 rounded-full font-medium shrink-0"
              style={{ background: "rgba(239,68,68,0.1)", color: "#DC2626" }}>
          가격 외 강점 부각 필요
        </span>
      )}
    </div>
  );
}

const SITS = [
  { k: "타사비교", l: "⚔️ 타사 비교 중" },
  { k: "가격이의", l: "💸 가격 이의" },
  { k: "첫상담",   l: "👋 첫 상담" },
  { k: "재상담",   l: "🔄 재상담" },
];

function HomeInner() {
  const [courses, setCourses]           = useState<Course[]>([]);
  const [courseId, setCourseId]         = useState<number | null>(null);
  const [comp, setComp]                 = useState<ComparisonResponse | null>(null);
  const [competitorId, setCompetitorId] = useState<number | null>(null);
  const [scripts, setScripts]           = useState<Script[]>([]);
  const [loading, setLoading]           = useState(true);
  const [compLoading, setCompLoading]   = useState(false);

  const [sit, setSit]                   = useState("타사비교");
  const [aiScript, setAiScript]         = useState("");
  const [scriptLoading, setScriptLoading] = useState(false);
  const [scriptErr, setScriptErr]       = useState("");
  const [copied, setCopied]             = useState<string | null>(null);
  const [apiKey, setApiKey]             = useState("");
  const [showModal, setShowModal]       = useState(false);

  const [category, setCategory]         = useState<string>("all");
  const [search, setSearch]             = useState("");

  // 관리자 기능
  const [isAdmin, setIsAdmin]           = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus | null>(null);
  const [scrapeTriggered, setScrapeTriggered] = useState(false);
  const [showAdminLogin, setShowAdminLogin]   = useState(false);
  const [showAdminPanel, setShowAdminPanel]   = useState(false);

  const scriptEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setApiKey(localStorage.getItem("claude_api_key") || "");
    const u = localStorage.getItem("tm_user");
    if (u) {
      try {
        const { role } = JSON.parse(u);
        if (role === "admin" || role === "superadmin") setIsAdmin(true);
      } catch {}
    }
    api.courses().then(cs => {
      const active = cs.filter(c => c.is_active).sort((a, b) => a.sort_order - b.sort_order);
      setCourses(active);
      if (active.length) setCourseId(active[0].id);
    }).finally(() => setLoading(false));
  }, []);

  // 관리자용 스크래핑 상태 폴링
  useEffect(() => {
    if (!isAdmin) return;
    const fetchStatus = () => {
      api.scrapeStatus().then(setScrapeStatus).catch(() => {});
    };
    fetchStatus();
    const id = setInterval(fetchStatus, scrapeTriggered ? 3000 : 30000);
    return () => clearInterval(id);
  }, [isAdmin, scrapeTriggered]);

  useEffect(() => {
    if (scrapeStatus && !scrapeStatus.is_running) {
      setScrapeTriggered(false);
    }
  }, [scrapeStatus]);

  useEffect(() => {
    if (!courseId) return;
    setCompLoading(true);
    setComp(null); setCompetitorId(null); setAiScript(""); setScripts([]);
    Promise.all([api.comparison(courseId), api.scripts(courseId)])
      .then(([d, sc]) => {
        setComp(d); setScripts(sc);
        if (d.competitors.length) setCompetitorId(d.competitors[0].id);
      }).finally(() => setCompLoading(false));
  }, [courseId]);

  const handleCopy = useCallback(async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id); setTimeout(() => setCopied(null), 2000);
  }, []);

  const handleGenAI = useCallback(async () => {
    if (!apiKey) { setShowModal(true); return; }
    if (!comp || competitorId === null) return;
    const ci = parseCompetitor(comp, competitorId);
    if (!ci) return;
    setScriptLoading(true); setScriptErr(""); setAiScript("");
    try {
      const course = courses.find(c => c.id === courseId);
      const result = await genScript(apiKey, course?.name || "", sit, parseEduwill(comp), ci);
      setAiScript(result);
      setTimeout(() => scriptEl.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) {
      const msg = (e as Error).message;
      setScriptErr(msg);
      if (isAuthError(msg)) {
        localStorage.removeItem("claude_api_key"); setApiKey("");
        setTimeout(() => setShowModal(true), 300);
      }
    } finally { setScriptLoading(false); }
  }, [apiKey, comp, competitorId, sit, courses, courseId]);

  const saveKey = useCallback((k: string) => {
    localStorage.setItem("claude_api_key", k); setApiKey(k); setShowModal(false);
  }, []);

  const handleTriggerScrape = useCallback(async () => {
    try {
      await api.triggerScrape();
      setScrapeTriggered(true);
    } catch (e) {
      alert((e as Error).message);
    }
  }, []);

  const handleAdminLogout = useCallback(() => {
    localStorage.removeItem("tm_token");
    localStorage.removeItem("tm_user");
    setIsAdmin(false);
    setShowAdminPanel(false);
  }, []);

  const filteredCourses = courses.filter(c => {
    const catMatch = category === "all" || c.category === category;
    const searchMatch = !search || c.name.includes(search);
    return catMatch && searchMatch;
  });

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="w-10 h-10 rounded-full border-[3px] animate-spin"
           style={{ borderColor: "var(--eduwill-yellow)", borderTopColor: "transparent" }} />
    </div>
  );

  const course  = courses.find(c => c.id === courseId);
  const ewProds = comp ? parseEduwill(comp) : [];
  const ci      = (comp && competitorId !== null) ? parseCompetitor(comp, competitorId) : null;
  const preScripts = scripts.filter(s => s.situation_tag === sit);
  const apiLabel   = apiKey.startsWith("sk-ant-") ? "Claude" : apiKey.startsWith("gsk_") ? "Groq" : "Gemini";
  const dataAge    = getDataAge(comp?.last_updated);
  const priceSummary = calcPriceSummary(ewProds, ci);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {showModal && <ApiKeyModal onSave={saveKey} onClose={() => setShowModal(false)} />}
      {showAdminLogin && (
        <AdminLoginModal
          onSuccess={() => { setIsAdmin(true); setShowAdminLogin(false); setShowAdminPanel(true); }}
          onClose={() => setShowAdminLogin(false)}
        />
      )}

      {/* ── 헤더 ── */}
      <header style={{ background: "var(--eduwill-navy)", borderBottom: "3px solid var(--eduwill-yellow)" }}>
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
                 style={{ background: "var(--eduwill-yellow)", color: "var(--eduwill-navy)" }}>TM</div>
            <div>
              <div className="font-bold text-sm text-white leading-tight">에듀윌 상담 도우미</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>타사 비교 고객 즉시 응대</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 관리자: 데이터 업데이트 버튼 */}
            {isAdmin && (
              <button
                onClick={handleTriggerScrape}
                disabled={scrapeStatus?.is_running || scrapeTriggered}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-50"
                style={{
                  background: scrapeStatus?.is_running ? "rgba(255,210,0,0.2)" : "rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.8)",
                  border: "1px solid rgba(255,255,255,0.2)",
                }}>
                {scrapeStatus?.is_running ? (
                  <>
                    <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    업데이트 중…
                  </>
                ) : "🔄 가격 업데이트"}
              </button>
            )}

            {/* 어드민 버튼 — 항상 표시 */}
            <div className="relative">
              <button
                onClick={() => isAdmin ? setShowAdminPanel(p => !p) : setShowAdminLogin(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition"
                style={{
                  background: isAdmin ? "rgba(255,210,0,0.2)" : "rgba(255,255,255,0.08)",
                  color:      isAdmin ? "var(--eduwill-yellow)" : "rgba(255,255,255,0.5)",
                  border:     `1px solid ${isAdmin ? "rgba(255,210,0,0.4)" : "rgba(255,255,255,0.15)"}`,
                }}>
                {isAdmin ? "⚙️ 관리" : "🔐"}
              </button>
              {isAdmin && showAdminPanel && (
                <AdminDropdown
                  onClose={() => setShowAdminPanel(false)}
                  onLogout={handleAdminLogout}
                  courseId={courseId}
                />
              )}
            </div>

            <button onClick={() => setShowModal(true)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition"
                    style={{
                      background: apiKey ? "rgba(255,255,255,0.1)" : "rgba(255,210,0,0.25)",
                      color:      apiKey ? "rgba(255,255,255,0.65)" : "var(--eduwill-yellow)",
                      border:     `1px solid ${apiKey ? "rgba(255,255,255,0.2)" : "var(--eduwill-yellow)"}`,
                    }}>
              🔑 {apiKey ? `AI (${apiLabel})` : "AI 키 설정"}
            </button>
          </div>
        </div>
      </header>

      {/* ── 과목 선택 영역 ── */}
      <div style={{ background: "var(--surface)", borderBottom: "2px solid var(--eduwill-yellow)" }}>
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 pt-2">

          {/* 카테고리 탭 + 검색 */}
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <div className="flex gap-1">
              {CATEGORIES.map(cat => (
                <button key={cat.key} onClick={() => setCategory(cat.key)}
                        className="px-3 py-1 rounded-full text-xs font-semibold transition"
                        style={{
                          background: category === cat.key ? "var(--eduwill-navy)" : "var(--surface2)",
                          color:      category === cat.key ? "white" : "var(--text-muted)",
                          border:     category === cat.key ? "none" : "1px solid var(--border)",
                        }}>
                  {cat.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <div className="relative">
                <input
                  type="text"
                  placeholder="과목 검색…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="text-xs px-3 py-1.5 pl-7 rounded-lg outline-none w-32 transition"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--text-muted)" }}>🔍</span>
                {search && (
                  <button onClick={() => setSearch("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
                          style={{ color: "var(--text-muted)" }}>✕</button>
                )}
              </div>
            </div>
          </div>

          {/* 과목 탭 */}
          <div className="flex gap-0.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {filteredCourses.length === 0 ? (
              <p className="text-xs py-3 px-1" style={{ color: "var(--text-muted)" }}>검색 결과 없음</p>
            ) : filteredCourses.map(c => (
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
            {/* ── 데이터 신선도 + 경쟁사 선택 헤더 ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              {/* 경쟁사 선택 */}
              <div className="flex gap-2 flex-wrap items-center">
                <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>경쟁사 선택</span>
                {comp.competitors.map(c => (
                  <button key={c.id} onClick={() => { setCompetitorId(c.id); setAiScript(""); setScriptErr(""); }}
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

              {/* 데이터 신선도 표시 */}
              {comp.last_updated && (
                <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full"
                     style={{ background: dataAge.bg, color: dataAge.color, border: `1px solid ${dataAge.color}30` }}>
                  <span>{dataAge.warn ? "⚠️" : "✅"}</span>
                  <span>{dataAge.label}</span>
                  {isAdmin && !scrapeStatus?.is_running && (
                    <button onClick={handleTriggerScrape}
                            className="ml-1 font-bold underline">지금 갱신</button>
                  )}
                </div>
              )}
            </div>

            {/* ── 가격 비교 요약 ── */}
            {ci && <PriceSummaryBanner summary={priceSummary} competitorName={ci.name} />}

            {/* ── 2컬럼 비교 ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">

              {/* 에듀윌 */}
              <section className="rounded-2xl overflow-hidden"
                       style={{ border: "2px solid var(--eduwill-yellow)", background: "var(--surface)" }}>
                <div className="px-5 py-3 flex items-center gap-2.5" style={{ background: "var(--eduwill-navy)" }}>
                  <span className="text-lg">{course?.icon}</span>
                  <div>
                    <span className="text-xs font-bold block" style={{ color: "var(--eduwill-yellow)" }}>에듀윌</span>
                    <span className="text-sm font-bold text-white">{course?.name}</span>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <LinkButton url={getEduwillUrl(course?.name)} light />
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                          style={{ background: "var(--eduwill-yellow)", color: "var(--eduwill-navy)" }}>
                      자사 상품
                    </span>
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
                        <ul className="space-y-0.5">
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
                    <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>상품 정보 없음</p>
                  )}
                </div>
              </section>

              {/* 경쟁사 */}
              <section className="rounded-2xl overflow-hidden"
                       style={{ border: "1.5px solid var(--border)", background: "var(--surface)" }}>
                <div className="px-5 py-3 flex items-center justify-between" style={{ background: "#F9FAFB" }}>
                  <div>
                    <span className="text-xs font-bold block text-gray-400">경쟁사</span>
                    <span className="text-sm font-bold text-gray-800">{ci?.name || "—"} {course?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {ci && (
                      <>
                        <LinkButton url={getLinkUrl(ci.name, course?.name)} />
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                                style={{ background: "#F3F4F6", color: "#6B7280" }}>{ci.products.length}개 상품</span>
                          {ci.products.filter(p => p.price === "가격 문의").length > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full"
                                  style={{ background: "#FEF3C7", color: "#D97706" }}>
                              {ci.products.filter(p => p.price === "가격 문의").length}개 미확인
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {ci ? (
                  <div className="p-4 space-y-4">
                    <div>
                      <p className="text-xs font-bold mb-2" style={{ color: "var(--text-muted)" }}>상품 현황</p>
                      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                        {ci.products.length > 0 ? ci.products.map((p, i) => (
                          <div key={i} className="flex items-center justify-between px-4 py-2.5"
                               style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none",
                                        background: i % 2 === 0 ? "var(--surface)" : "var(--surface2)" }}>
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
                    {ci.advantages.length > 0 && (
                      <div>
                        <p className="text-xs font-bold mb-2" style={{ color: "var(--text-muted)" }}>
                          에듀윌 차별점 <span className="font-normal opacity-70">(상담 포인트)</span>
                        </p>
                        <div className="rounded-xl p-3 space-y-1.5" style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                          {ci.advantages.slice(0, 5).map((a, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs" style={{ color: "#1D4ED8" }}>
                              <span className="shrink-0 font-bold">✅</span><span>{a}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>경쟁사를 선택하세요</div>
                )}
              </section>
            </div>

            {/* ── 스크립트 섹션 ── */}
            <section ref={scriptEl} className="rounded-2xl overflow-hidden"
                     style={{ border: "1.5px solid var(--border)", background: "var(--surface)" }}>
              <div className="px-5 py-3 flex items-center justify-between" style={{ background: "var(--eduwill-navy)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-base">💬</span>
                  <span className="text-sm font-bold text-white">상담 스크립트</span>
                  {ci && <span className="text-xs text-white opacity-60">— {ci.name} 고객 응대용</span>}
                </div>
              </div>

              <div className="p-5">
                {/* 상황 선택 */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {SITS.map(s => (
                    <button key={s.k} onClick={() => { setSit(s.k); setAiScript(""); setScriptErr(""); }}
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

                {/* 사전 작성 스크립트 */}
                {preScripts.length > 0 && (
                  <div className="mb-5">
                    <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                      <span className="px-2 py-0.5 rounded-full text-white text-xs" style={{ background: "#16A34A" }}>기본</span>
                      사전 준비 스크립트
                    </p>
                    <div className="space-y-3">
                      {preScripts.map(s => (
                        <div key={s.id} className="rounded-xl overflow-hidden"
                             style={{ border: "1px solid var(--border)" }}>
                          <div className="px-4 py-2.5 flex items-center justify-between"
                               style={{ background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
                            <span className="text-xs font-bold" style={{ color: "var(--eduwill-navy)" }}>{s.title}</span>
                            <button onClick={() => handleCopy(s.body_template, String(s.id))}
                                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold transition"
                                    style={{
                                      background: copied === String(s.id) ? "#DCFCE7" : "white",
                                      color:      copied === String(s.id) ? "#166534" : "var(--eduwill-blue)",
                                      border:     `1px solid ${copied === String(s.id) ? "#BBF7D0" : "var(--eduwill-blue)"}`,
                                    }}>
                              {copied === String(s.id) ? "✓ 복사됨" : "📋 복사"}
                            </button>
                          </div>
                          <pre className="px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed font-sans"
                               style={{ color: "var(--text)", background: "var(--surface)" }}>
                            {s.body_template}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI 생성 스크립트 */}
                <div>
                  <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                    <span className="px-2 py-0.5 rounded-full text-white text-xs"
                          style={{ background: apiKey ? "#2563EB" : "#9CA3AF" }}>
                      {apiKey ? `AI · ${apiLabel}` : "AI · 선택"}
                    </span>
                    경쟁사 정보 기반 맞춤 스크립트
                    {!apiKey && (
                      <button onClick={() => setShowModal(true)}
                              className="ml-1 text-xs underline" style={{ color: "var(--eduwill-blue)" }}>
                        (무료 키 발급)
                      </button>
                    )}
                  </p>

                  <button onClick={handleGenAI} disabled={scriptLoading || !ci}
                          className="w-full py-2.5 rounded-xl text-sm font-bold transition mb-3 disabled:opacity-50"
                          style={{
                            background: apiKey ? "#2563EB" : "var(--surface2)",
                            color:      apiKey ? "white" : "var(--text-muted)",
                            border:     apiKey ? "none" : "1.5px solid var(--border)",
                          }}>
                    {scriptLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        AI 스크립트 생성 중…
                      </span>
                    ) : apiKey
                      ? `✨ ${ci?.name || ""} 맞춤 스크립트 생성 (${apiLabel})`
                      : "✨ AI 맞춤 스크립트 — API 키 설정 후 사용 가능"}
                  </button>

                  {scriptErr && (
                    <div className="rounded-xl px-4 py-3 mb-3 text-xs"
                         style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }}>
                      ⚠️ {scriptErr}
                      {isAuthError(scriptErr) && (
                        <button onClick={() => { localStorage.removeItem("claude_api_key"); setApiKey(""); setShowModal(true); }}
                                className="ml-2 underline font-bold">API 키 재설정</button>
                      )}
                    </div>
                  )}

                  {aiScript && (
                    <div className="rounded-xl overflow-hidden" style={{ border: "1.5px solid #BFDBFE" }}>
                      <div className="px-4 py-2.5 flex items-center justify-between"
                           style={{ background: "#DBEAFE", borderBottom: "1px solid #BFDBFE" }}>
                        <span className="text-xs font-bold" style={{ color: "#1D4ED8" }}>
                          ✨ AI 생성 — {ci?.name} · {SITS.find(s => s.k === sit)?.l}
                        </span>
                        <button onClick={() => handleCopy(aiScript, "ai")}
                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold transition"
                                style={{
                                  background: copied === "ai" ? "#DCFCE7" : "white",
                                  color:      copied === "ai" ? "#166534" : "#1D4ED8",
                                  border:     `1px solid ${copied === "ai" ? "#BBF7D0" : "#BFDBFE"}`,
                                }}>
                          {copied === "ai" ? "✓ 복사됨" : "📋 복사"}
                        </button>
                      </div>
                      <pre className="px-5 py-4 text-sm whitespace-pre-wrap leading-relaxed font-sans"
                           style={{ color: "#1E3A5F", background: "#EFF6FF" }}>
                        {aiScript}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default function Home() {
  return <Suspense><HomeInner /></Suspense>;
}
