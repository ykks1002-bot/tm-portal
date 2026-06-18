"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { api, getCustomApiUrl, setCustomApiUrl, type Course, type ComparisonResponse, type ExamSchedule, type EmploymentStat, type ScrapeStatus } from "@/lib/api";

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

// ── 시험 정보 / 취업 전망 공통 ────────────────────────────────────────────────
function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-10 text-center">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{message}</p>
    </div>
  );
}

const OUTLOOK_CONFIG: Record<string, { label: string; color: string; bg: string; bar: number }> = {
  증가:     { label: "증가",      color: "#166534", bg: "#DCFCE7", bar: 90 },
  다소증가: { label: "다소 증가", color: "#1D4ED8", bg: "#EFF6FF", bar: 70 },
  유지:     { label: "유지",      color: "#92400E", bg: "#FFFBEB", bar: 50 },
  다소감소: { label: "다소 감소", color: "#C2410C", bg: "#FFF7ED", bar: 30 },
  감소:     { label: "감소",      color: "#DC2626", bg: "#FEF2F2", bar: 15 },
};

// ── 시험 정보 섹션 ─────────────────────────────────────────────────────────────
const EXAM_TABS = [
  { key: "시험일정", label: "📅 시험일정" },
  { key: "시험과목", label: "📋 시험과목" },
  { key: "시험시간", label: "⏱️ 시험시간" },
  { key: "합격률",  label: "📊 합격률" },
  { key: "유의사항", label: "⚠️ 유의사항" },
] as const;
type ExamTab = typeof EXAM_TABS[number]["key"];

function ExamScheduleCard({ s }: { s: ExamSchedule }) {
  const [active, setActive] = useState<ExamTab | null>("시험일정");
  const subjects: { round: string; name: string; count: string; time: string }[] =
    s.subjects_json ? JSON.parse(s.subjects_json) : [];
  const rounds = Array.from(new Set(subjects.map(x => x.round)));

  const toggle = (tab: ExamTab) => setActive(prev => prev === tab ? null : tab);

  const dateRows = [
    { label: "필기(1차) 원서접수", start: s.written_reg_start, end: s.written_reg_end },
    { label: "필기(1차) 시험일",   date: s.written_exam_date },
    { label: "필기(1차) 합격발표", date: s.written_result_date },
    ...(s.practical_exam_date ? [
      { label: "실기(2차) 원서접수", start: s.practical_reg_start, end: s.practical_reg_end },
      { label: "실기(2차) 시험일",   date: s.practical_exam_date },
      { label: "실기(2차) 합격발표", date: s.practical_result_date },
    ] : []),
  ].filter(row => row.date || row.start);

  return (
    <div className="rounded-2xl overflow-hidden"
         style={{ border: "1px solid var(--border)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
      <div className="px-5 py-3.5 flex items-center justify-between"
           style={{ background: "var(--eduwill-navy)" }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white font-bold text-base">{s.year}년 {s.round_label}</span>
          {s.organizer && (
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                  style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)" }}>
              {s.organizer}
            </span>
          )}
          {s.exam_fee && (
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                  style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)" }}>
              응시료 {s.exam_fee}
            </span>
          )}
        </div>
        {s.source_url && (
          <a href={s.source_url} target="_blank" rel="noopener noreferrer"
             className="text-xs px-2.5 py-0.5 rounded-full shrink-0"
             style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)", textDecoration: "none" }}>
            출처 ↗
          </a>
        )}
      </div>

      <div className="flex gap-2 px-5 pt-4 pb-2 flex-wrap">
        {EXAM_TABS.map(tab => (
          <button key={tab.key} onClick={() => toggle(tab.key)}
                  className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
                  style={{
                    background: active === tab.key ? "var(--eduwill-navy)" : "var(--surface2)",
                    color: active === tab.key ? "white" : "var(--text-muted)",
                    border: `1px solid ${active === tab.key ? "var(--eduwill-navy)" : "var(--border)"}`,
                    cursor: "pointer",
                  }}>
            {tab.label}
          </button>
        ))}
      </div>

      {active && (
        <div className="px-5 pb-5 pt-2">
          {active === "시험일정" && (
            <div className="space-y-1">
              {dateRows.length > 0 ? dateRows.map((row, i) => (
                <div key={i} className="flex gap-3 items-start text-sm px-3 py-2 rounded-lg"
                     style={{ background: i % 2 === 0 ? "var(--surface2)" : "transparent" }}>
                  <span className="shrink-0 w-32 text-xs pt-0.5" style={{ color: "var(--text-muted)" }}>
                    {row.label}
                  </span>
                  <span className="font-medium text-xs" style={{ color: "var(--text)" }}>
                    {row.date ?? `${row.start} ~ ${row.end}`}
                  </span>
                </div>
              )) : <EmptyState message="시험 일정 정보가 없습니다." />}
            </div>
          )}
          {(active === "시험과목" || active === "시험시간") && (() => {
            const colLabel = active === "시험과목" ? "문항수" : "시험시간";
            const colKey   = active === "시험과목" ? "count" : "time";
            const colBg    = active === "시험과목" ? "rgba(79,127,255,0.08)" : "rgba(0,0,0,0.04)";
            const colColor = active === "시험과목" ? "var(--accent)" : "var(--text-muted)";
            if (!subjects.length) return <EmptyState message={`${colLabel} 정보가 없습니다.`} />;
            const rows = rounds.flatMap(r => {
              const grp = subjects.filter(x => x.round === r);
              return grp.map((subj, idx) => ({ isFirst: idx === 0, span: grp.length, round: r, name: subj.name, val: (subj as Record<string, string>)[colKey] || "-" }));
            });
            return (
              <div style={{ overflowX: "auto", borderRadius: 10, overflow: "hidden", border: "1.5px solid var(--eduwill-navy)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "var(--eduwill-navy)", color: "white" }}>
                      <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, width: "90px", whiteSpace: "nowrap",
                                   borderRight: "1px solid rgba(255,255,255,0.2)" }}>구분</th>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700,
                                   borderRight: "1px solid rgba(255,255,255,0.2)" }}>과목명</th>
                      <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, width: "90px", whiteSpace: "nowrap" }}>{colLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} style={{
                        borderTop: row.isFirst && i > 0 ? "2px solid rgba(0,45,105,0.45)" : "1px solid #C7D2E8",
                        background: i % 2 === 0 ? "white" : "#F0F4FF",
                      }}>
                        {row.isFirst && (
                          <td rowSpan={row.span}
                              style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, verticalAlign: "middle",
                                       background: "rgba(0,45,105,0.09)", color: "var(--eduwill-navy)",
                                       borderRight: "2px solid var(--eduwill-navy)", whiteSpace: "nowrap",
                                       fontSize: "12px", letterSpacing: "0.01em" }}>
                            {row.round}
                          </td>
                        )}
                        <td style={{ padding: "10px 14px", color: "var(--text)", borderRight: "1px solid #C7D2E8", fontWeight: 500 }}>{row.name}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700,
                                     background: colBg, color: colColor, whiteSpace: "nowrap" }}>
                          {row.val}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
          {active === "합격률" && (() => {
            // ── 계리직공무원: 합격선 매트릭스 표 ──
            if (s.cutoff_json) {
              type CutoffData = { label: string; years: string[]; rows: { region: string; scores: string[]; avg: string }[] };
              const cd: CutoffData = JSON.parse(s.cutoff_json);
              const scoreColor = (v: string) => {
                const n = parseFloat(v); if (isNaN(n)) return "var(--text)";
                if (n >= 80) return "#dc2626"; if (n >= 70) return "#d97706"; return "#2563eb";
              };
              return (
                <div>
                  <div style={{ overflowX: "auto", borderRadius: 10, overflow: "hidden", border: "1.5px solid var(--eduwill-navy)" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                      <thead>
                        <tr style={{ background: "var(--eduwill-navy)", color: "white" }}>
                          <th style={{ padding: "9px 12px", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap", borderRight: "1px solid rgba(255,255,255,0.2)" }}>우정청</th>
                          {cd.years.map(y => (
                            <th key={y} style={{ padding: "9px 10px", textAlign: "center", fontWeight: 700, whiteSpace: "nowrap", borderRight: "1px solid rgba(255,255,255,0.2)" }}>{y}</th>
                          ))}
                          <th style={{ padding: "9px 10px", textAlign: "center", fontWeight: 700, whiteSpace: "nowrap", background: "rgba(255,255,255,0.15)" }}>평균</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cd.rows.map((row, i) => {
                          const isAvgRow = row.region === "(연도)평균";
                          return (
                            <tr key={i} style={{
                              borderTop: "1px solid #C7D2E8",
                              background: isAvgRow ? "rgba(0,45,105,0.09)" : i % 2 === 0 ? "white" : "#F0F4FF",
                              fontWeight: isAvgRow ? 700 : 400,
                            }}>
                              <td style={{ padding: "8px 12px", color: isAvgRow ? "var(--eduwill-navy)" : "var(--text)", whiteSpace: "nowrap",
                                           borderRight: "2px solid var(--eduwill-navy)", fontWeight: isAvgRow ? 700 : 500 }}>
                                {row.region}
                              </td>
                              {row.scores.map((sc, si) => (
                                <td key={si} style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600, color: scoreColor(sc),
                                                      borderRight: "1px solid #C7D2E8" }}>
                                  {sc}
                                </td>
                              ))}
                              <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700,
                                           color: isAvgRow ? "var(--eduwill-navy)" : scoreColor(row.avg),
                                           background: "rgba(0,45,105,0.06)" }}>
                                {row.avg}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs mt-2 px-1" style={{ color: "var(--text-muted)" }}>
                    ※ {cd.label} | 출처: 우정사업본부 공식 발표 기준<br/>
                    색상 기준: <span style={{ color: "#dc2626", fontWeight: 600 }}>80점 이상</span> / <span style={{ color: "#d97706", fontWeight: 600 }}>70점 이상</span> / <span style={{ color: "#2563eb", fontWeight: 600 }}>70점 미만</span>
                  </p>
                </div>
              );
            }

            // ── 일반 합격률 표 ──
            type PassRate = { year: string; round: string; applicants: string; passed: string; rate: string };
            const passRates: PassRate[] = s.pass_rates_json ? JSON.parse(s.pass_rates_json) : [];
            if (!passRates.length) return (
              <div className="rounded-xl p-4 text-center"
                   style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                <p className="text-sm py-2" style={{ color: "var(--text-muted)" }}>합격률 데이터 업데이트 예정입니다.</p>
              </div>
            );
            const years = Array.from(new Set(passRates.map(r => r.year)));
            const rateColor = (rate: string) => {
              const n = parseFloat(rate);
              if (isNaN(n)) return "var(--text-muted)";
              if (n >= 50) return "#16a34a";
              if (n >= 25) return "#2563eb";
              if (n >= 10) return "#d97706";
              return "#dc2626";
            };
            return (
              <div>
                <div style={{ overflowX: "auto", borderRadius: 10, overflow: "hidden", border: "1.5px solid var(--eduwill-navy)" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: "var(--eduwill-navy)", color: "white" }}>
                        <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, width: "100px", borderRight: "1px solid rgba(255,255,255,0.2)" }}>연도</th>
                        <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, width: "72px", whiteSpace: "nowrap", borderRight: "1px solid rgba(255,255,255,0.2)" }}>구분</th>
                        <th style={{ padding: "10px 14px", textAlign: "right",  fontWeight: 700, borderRight: "1px solid rgba(255,255,255,0.2)" }}>응시인원</th>
                        <th style={{ padding: "10px 14px", textAlign: "right",  fontWeight: 700, borderRight: "1px solid rgba(255,255,255,0.2)" }}>합격인원</th>
                        <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, width: "72px" }}>합격률</th>
                      </tr>
                    </thead>
                    <tbody>
                      {years.flatMap((yr, yi) => {
                        const grp = passRates.filter(r => r.year === yr);
                        return grp.map((pr, pi) => (
                          <tr key={`${yi}-${pi}`} style={{
                            borderTop: pi === 0 && yi > 0 ? "2px solid rgba(0,45,105,0.45)" : "1px solid #C7D2E8",
                            background: yi % 2 === 0 ? "white" : "#F0F4FF",
                          }}>
                            {pi === 0 && (
                              <td rowSpan={grp.length}
                                  style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, verticalAlign: "middle",
                                           background: "rgba(0,45,105,0.09)", color: "var(--eduwill-navy)",
                                           borderRight: "2px solid var(--eduwill-navy)", whiteSpace: "nowrap" }}>
                                {pr.year}
                              </td>
                            )}
                            <td style={{ padding: "10px 14px", textAlign: "center", color: "var(--text-muted)", whiteSpace: "nowrap",
                                         borderRight: "1px solid #C7D2E8", fontWeight: 500 }}>{pr.round}</td>
                            <td style={{ padding: "10px 14px", textAlign: "right", color: "var(--text)", fontWeight: 500,
                                         borderRight: "1px solid #C7D2E8" }}>{pr.applicants}</td>
                            <td style={{ padding: "10px 14px", textAlign: "right", color: "var(--text)", fontWeight: 500,
                                         borderRight: "1px solid #C7D2E8" }}>{pr.passed}</td>
                            <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: rateColor(pr.rate) }}>
                              {pr.rate}
                            </td>
                          </tr>
                        ));
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs mt-2 px-1" style={{ color: "var(--text-muted)" }}>
                  ※ 출처: 큐넷·검정기관 공식 발표 기준
                </p>
              </div>
            );
          })()}
          {active === "유의사항" && (
            s.notes ? (
              <div className="rounded-xl p-4"
                   style={{ background: "#FFFDF0", borderLeft: "3px solid var(--eduwill-yellow)" }}>
                <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: "#374151" }}>
                  {s.notes}
                </p>
              </div>
            ) : (
              <EmptyState message="유의사항 정보가 없습니다." />
            )
          )}
        </div>
      )}
    </div>
  );
}

function ExamSection({ schedules }: { schedules: ExamSchedule[] }) {
  if (!schedules.length) return <EmptyState message="등록된 시험 일정이 없습니다." />;
  return (
    <div className="space-y-5">
      {schedules.map(s => <ExamScheduleCard key={s.id} s={s} />)}
    </div>
  );
}

// ── 취업 전망 섹션 ─────────────────────────────────────────────────────────────
const EMP_TABS = [
  { key: "고용지표",   label: "📊 고용지표" },
  { key: "고용전망",   label: "📈 고용전망" },
  { key: "상담포인트", label: "📌 상담포인트" },
] as const;
type EmpTab = typeof EMP_TABS[number]["key"];

function EmploymentSection({ stat }: { stat: EmploymentStat | null }) {
  const [active, setActive] = useState<EmpTab | null>("고용지표");
  if (!stat) return <EmptyState message="등록된 취업 전망 데이터가 없습니다." />;

  const talkingPoints: string[] = stat.talking_points_json
    ? JSON.parse(stat.talking_points_json) : [];
  const outlook = stat.employment_outlook
    ? (OUTLOOK_CONFIG[stat.employment_outlook] ?? OUTLOOK_CONFIG["유지"]) : null;

  const toggle = (tab: EmpTab) => setActive(prev => prev === tab ? null : tab);

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-3">
        {EMP_TABS.map(tab => (
          <button key={tab.key} onClick={() => toggle(tab.key)}
                  className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
                  style={{
                    background: active === tab.key ? "var(--eduwill-navy)" : "var(--surface2)",
                    color: active === tab.key ? "white" : "var(--text-muted)",
                    border: `1px solid ${active === tab.key ? "var(--eduwill-navy)" : "var(--border)"}`,
                    cursor: "pointer",
                  }}>
            {tab.label}
          </button>
        ))}
      </div>

      {active === "고용지표" && (
        <div className="space-y-2">
          {[
            { label: "종사자 수", value: stat.worker_count },
            { label: "평균 임금", value: stat.avg_wage },
          ].filter(r => r.value).map((row, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                 style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
              <span className="text-xs shrink-0 w-20" style={{ color: "var(--text-muted)" }}>{row.label}</span>
              <span className="text-sm font-bold" style={{ color: "var(--eduwill-navy)" }}>{row.value}</span>
            </div>
          ))}
          {!stat.worker_count && !stat.avg_wage && <EmptyState message="고용 지표 데이터가 없습니다." />}
          {stat.stat_year && (
            <p className="text-xs mt-1 px-1" style={{ color: "var(--text-muted)" }}>
              기준: {stat.stat_year}년 | 출처: {stat.data_source}
            </p>
          )}
        </div>
      )}
      {active === "고용전망" && (
        <div className="space-y-3">
          {outlook ? (
            <div className="px-4 py-3 rounded-xl"
                 style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-bold shrink-0" style={{ color: "var(--text-muted)" }}>고용 전망 지수</span>
                <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ background: "var(--border)" }}>
                  <div className="h-full rounded-full" style={{ width: `${outlook.bar}%`, background: outlook.color }} />
                </div>
                <span className="text-xs font-semibold shrink-0 px-2.5 py-0.5 rounded-full"
                      style={{ background: outlook.bg, color: outlook.color }}>
                  {outlook.label}
                </span>
              </div>
              {stat.outlook_detail && (
                <p className="text-sm leading-relaxed mt-2" style={{ color: "var(--text)" }}>
                  {stat.outlook_detail}
                </p>
              )}
            </div>
          ) : (
            <EmptyState message="고용 전망 데이터가 없습니다." />
          )}
        </div>
      )}
      {active === "상담포인트" && (
        talkingPoints.length > 0 ? (
          <div className="space-y-1.5">
            {talkingPoints.map((pt, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs leading-relaxed px-3 py-2 rounded-lg"
                   style={{ background: "var(--surface2)" }}>
                <span className="shrink-0 font-bold mt-0.5" style={{ color: "var(--eduwill-navy)" }}>•</span>
                <span style={{ color: "var(--text)" }}>{pt}</span>
              </div>
            ))}
          </div>
        ) : <EmptyState message="상담 포인트 데이터가 없습니다." />
      )}
    </div>
  );
}

// ── 어드민 인라인 로그인 모달 ────────────────────────────────────────────────
function AdminLoginModal({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [email, setEmail]       = useState("");
  const [pw, setPw]             = useState("");
  const [serverUrl, setServerUrl] = useState(getCustomApiUrl() ?? "");
  const [showServer, setShowServer] = useState(!!getCustomApiUrl());
  const [err, setErr]           = useState("");
  const [loading, setLoading]   = useState(false);

  const doLogin = async () => {
    setErr(""); setLoading(true);
    try {
      if (serverUrl.trim()) {
        setCustomApiUrl(serverUrl.trim());
      } else {
        setCustomApiUrl(null);
      }
      const res = await api.login(email, pw);
      if (res.user_role !== "admin" && res.user_role !== "superadmin") {
        setCustomApiUrl(null);
        throw new Error("어드민 권한이 없습니다");
      }
      localStorage.setItem("tm_token", res.access_token);
      localStorage.setItem("tm_user", JSON.stringify({ name: res.user_name, role: res.user_role }));
      onSuccess();
    } catch (e) {
      if (serverUrl.trim()) setCustomApiUrl(null);
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

        {/* 서버 연결 설정 */}
        <button
          onClick={() => setShowServer(s => !s)}
          className="w-full flex items-center justify-between text-xs px-3 py-2 rounded-lg mb-3"
          style={{ background: "var(--surface2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
          <span>🔗 서버 연결 설정 <span style={{ color: serverUrl ? "#16A34A" : "var(--text-muted)" }}>{serverUrl ? "(연결됨)" : "(미설정 — 정적모드)"}</span></span>
          <span>{showServer ? "▲" : "▼"}</span>
        </button>
        {showServer && (
          <div className="mb-3">
            <input
              type="url"
              placeholder="http://10.10.30.40:8000"
              value={serverUrl}
              onChange={e => setServerUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs outline-none mb-1"
              style={{ background: "var(--surface2)", border: "1.5px solid var(--border)", color: "var(--text)" }}
            />
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              입력 시 라이브 서버 계정으로 로그인, 빈칸은 정적 모드
            </p>
          </div>
        )}

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
  const serverUrl = getCustomApiUrl();
  const items = [
    { icon: "🏠", label: "어드민 대시보드",      href: "/admin" },
    { icon: "💰", label: "가격 관리",            href: "/admin/prices" },
    { icon: "📅", label: "시험 정보 / 취업 전망", href: "/admin/exam-info" },
    { icon: "📚", label: "과목 관리",            href: "/admin/courses" },
  ];
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-2 w-52 rounded-xl overflow-hidden z-50"
           style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 8px 30px rgba(0,0,0,0.2)" }}>
        <div className="px-4 py-2 text-xs" style={{ background: "var(--surface2)", borderBottom: "1px solid var(--border)", color: serverUrl ? "#16A34A" : "var(--text-muted)" }}>
          {serverUrl ? `🟢 ${serverUrl}` : "🔵 정적 모드"}
        </div>
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

function HomeInner() {
  const [courses, setCourses]           = useState<Course[]>([]);
  const [courseId, setCourseId]         = useState<number | null>(null);
  const [comp, setComp]                 = useState<ComparisonResponse | null>(null);
  const [competitorId, setCompetitorId] = useState<number | null>(null);
  const [examSchedules, setExamSchedules] = useState<ExamSchedule[]>([]);
  const [employmentStat, setEmploymentStat] = useState<EmploymentStat | null>(null);
  const [loading, setLoading]           = useState(true);
  const [compLoading, setCompLoading]   = useState(false);

  const [category, setCategory]         = useState<string>("all");
  const [search, setSearch]             = useState("");

  // 관리자 기능
  const [isAdmin, setIsAdmin]           = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus | null>(null);
  const [scrapeTriggered, setScrapeTriggered] = useState(false);
  const [showAdminLogin, setShowAdminLogin]   = useState(false);
  const [showAdminPanel, setShowAdminPanel]   = useState(false);

  useEffect(() => {
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
    setComp(null); setCompetitorId(null); setExamSchedules([]); setEmploymentStat(null);
    Promise.all([
      api.comparison(courseId),
      api.examSchedules(courseId),
      api.employmentStat(courseId).catch(() => null),
    ])
      .then(([d, exams, emp]) => {
        setComp(d); setExamSchedules(exams); setEmploymentStat(emp);
        if (d.competitors.length) setCompetitorId(d.competitors[0].id);
      }).finally(() => setCompLoading(false));
  }, [courseId]);

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
    setCustomApiUrl(null);
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
  const dataAge    = getDataAge(comp?.last_updated);
  const priceSummary = calcPriceSummary(ewProds, ci);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
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
            {/* 관리자: 데이터 업데이트 버튼 (라이브 서버 전용) */}
            {isAdmin && process.env.NEXT_PUBLIC_STATIC !== "true" && (
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
                  <button key={c.id} onClick={() => setCompetitorId(c.id)}
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

            {/* ── 시험 정보 섹션 ── */}
            <section className="rounded-2xl overflow-hidden mb-4"
                     style={{ border: "1.5px solid var(--border)", background: "var(--surface)" }}>
              <div className="px-5 py-3 flex items-center gap-2" style={{ background: "var(--eduwill-navy)" }}>
                <span className="text-base">📅</span>
                <span className="text-sm font-bold text-white">시험 정보</span>
                {course && <span className="text-xs text-white opacity-60">— {course.name}</span>}
              </div>
              <div className="p-5">
                <ExamSection schedules={examSchedules} />
              </div>
            </section>

            {/* ── 취업 전망 섹션 ── */}
            <section className="rounded-2xl overflow-hidden"
                     style={{ border: "1.5px solid var(--border)", background: "var(--surface)" }}>
              <div className="px-5 py-3 flex items-center gap-2" style={{ background: "var(--eduwill-navy)" }}>
                <span className="text-base">📈</span>
                <span className="text-sm font-bold text-white">취업 전망</span>
                {course && <span className="text-xs text-white opacity-60">— {course.name}</span>}
              </div>
              <div className="p-5">
                <EmploymentSection stat={employmentStat} />
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
