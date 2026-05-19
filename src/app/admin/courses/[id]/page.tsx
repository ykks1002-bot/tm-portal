"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  api,
  type ComparisonResponse,
  type StrengthPoint,
  type Script,
  type FAQ,
  type Competitor,
} from "@/lib/api";

type AdminTab = "comparison" | "strengths" | "scripts" | "faq";

const SITUATION_TAGS = ["첫상담", "가격이의", "타사비교", "재상담"];
const STRENGTH_CATS  = ["합격실적", "가격경쟁력", "콘텐츠", "지원서비스"];

function Input({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
           className="w-full rounded-lg px-3 py-2 text-sm outline-none"
           style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-y"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
  );
}

function Btn({ onClick, children, variant = "primary" }: {
  onClick: () => void; children: React.ReactNode; variant?: "primary" | "danger" | "ghost";
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: "var(--accent)", color: "#fff" },
    danger:  { background: "rgba(239,68,68,0.12)", color: "var(--danger)", border: "1px solid rgba(239,68,68,0.3)" },
    ghost:   { background: "var(--surface2)", color: "var(--text-muted)", border: "1px solid var(--border)" },
  };
  return (
    <button onClick={onClick}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
            style={styles[variant]}>
      {children}
    </button>
  );
}

// ── 비교표 편집 ────────────────────────────────────────────────────────────────
function ComparisonEditor({
  courseId, data, competitors, onRefresh,
}: {
  courseId: number;
  data: ComparisonResponse;
  competitors: Competitor[];
  onRefresh: () => void;
}) {
  const [newItemName, setNewItemName] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [isAdv, setIsAdv] = useState(false);
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<number | null>(null);

  const addItem = async () => {
    if (!newItemName) return;
    await api.createComparisonItem(courseId, {
      name: newItemName, description: newItemDesc, is_eduwill_advantage: isAdv, sort_order: data.items.length + 1,
    });
    setNewItemName(""); setNewItemDesc(""); setIsAdv(false);
    onRefresh();
  };

  const deleteItem = async (id: number) => {
    if (!confirm("항목을 삭제하면 관련 비교 데이터도 모두 삭제됩니다. 계속하시겠습니까?")) return;
    await api.deleteComparisonItem(id);
    onRefresh();
  };

  const toggleAdv = async (item: ComparisonResponse["items"][0]) => {
    await api.updateComparisonItem(item.id, { is_eduwill_advantage: !item.is_eduwill_advantage });
    onRefresh();
  };

  const saveValue = async (itemId: number, competitorId: number | null) => {
    const key = `${itemId}_${competitorId ?? "eduwill"}`;
    const value = editingValues[key] ?? "";
    setSaving(itemId);
    await api.upsertComparisonValue({ comparison_item_id: itemId, competitor_id: competitorId, value_text: value });
    setSaving(null);
    onRefresh();
  };

  const valueKey = (itemId: number, compId: number | null) => `${itemId}_${compId ?? "eduwill"}`;

  const initEdit = (itemId: number, compId: number | null, current: string) => {
    const k = valueKey(itemId, compId);
    if (!(k in editingValues)) {
      setEditingValues(prev => ({ ...prev, [k]: current }));
    }
  };

  return (
    <div className="space-y-6">
      {/* 새 항목 추가 */}
      <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h3 className="font-semibold text-sm mb-3">새 비교 항목 추가</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Input value={newItemName} onChange={setNewItemName} placeholder="항목명 (예: 수강료) *" />
          <Input value={newItemDesc} onChange={setNewItemDesc} placeholder="설명 (선택)" />
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--text-muted)" }}>
            <input type="checkbox" checked={isAdv} onChange={e => setIsAdv(e.target.checked)}
                   className="w-4 h-4 accent-blue-500" />
            에듀윌 우위 항목
          </label>
          <Btn onClick={addItem}>추가</Btn>
        </div>
      </div>

      {/* 항목별 값 편집 */}
      {data.items.map(item => (
        <div key={item.id} className="rounded-xl overflow-hidden"
             style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between px-5 py-3"
               style={{ background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>{item.name}</span>
              {item.description && <span className="text-xs" style={{ color: "var(--text-muted)" }}>— {item.description}</span>}
            </div>
            <div className="flex items-center gap-2">
              <Btn onClick={() => toggleAdv(item)} variant={item.is_eduwill_advantage ? "primary" : "ghost"}>
                {item.is_eduwill_advantage ? "★ 에듀윌 우위" : "우위 미설정"}
              </Btn>
              <Btn onClick={() => deleteItem(item.id)} variant="danger">삭제</Btn>
            </div>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* 에듀윌 */}
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: "#6b92ff" }}>★ 에듀윌</label>
              <Textarea
                value={editingValues[valueKey(item.id, null)] ?? item.eduwill_value}
                onChange={v => {
                  initEdit(item.id, null, item.eduwill_value);
                  setEditingValues(prev => ({ ...prev, [valueKey(item.id, null)]: v }));
                }}
                placeholder="에듀윌 값 입력"
                rows={2}
              />
              <Btn onClick={() => saveValue(item.id, null)}>
                {saving === item.id ? "저장 중..." : "저장"}
              </Btn>
            </div>
            {/* 경쟁사들 */}
            {competitors.map(c => (
              <div key={c.id}>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: "var(--text-muted)" }}>{c.name}</label>
                <Textarea
                  value={editingValues[valueKey(item.id, c.id)] ?? (item.competitor_values[String(c.id)] ?? "")}
                  onChange={v => {
                    initEdit(item.id, c.id, item.competitor_values[String(c.id)] ?? "");
                    setEditingValues(prev => ({ ...prev, [valueKey(item.id, c.id)]: v }));
                  }}
                  placeholder={`${c.name} 값 입력`}
                  rows={2}
                />
                <Btn onClick={() => saveValue(item.id, c.id)}>저장</Btn>
              </div>
            ))}
          </div>
        </div>
      ))}
      {data.items.length === 0 && (
        <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>비교 항목이 없습니다. 위에서 추가하세요.</p>
      )}
    </div>
  );
}

// ── 강점 편집 ────────────────────────────────────────────────────────────────
function StrengthsEditor({ courseId, strengths, onRefresh }: {
  courseId: number; strengths: StrengthPoint[]; onRefresh: () => void;
}) {
  const [cat, setCat] = useState(STRENGTH_CATS[0]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [evidence, setEvidence] = useState("");

  const add = async () => {
    if (!title) return;
    await api.createStrength(courseId, { category: cat, title, description: desc, evidence_text: evidence, sort_order: strengths.length + 1 });
    setTitle(""); setDesc(""); setEvidence("");
    onRefresh();
  };

  const del = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await api.deleteStrength(id);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h3 className="font-semibold text-sm mb-3">새 강점 추가</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <select value={cat} onChange={e => setCat(e.target.value)}
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
            {STRENGTH_CATS.map(c => <option key={c}>{c}</option>)}
          </select>
          <Input value={title} onChange={setTitle} placeholder="강점 제목 *" />
          <Textarea value={desc} onChange={setDesc} placeholder="설명 (선택)" rows={2} />
          <Textarea value={evidence} onChange={setEvidence} placeholder="근거 데이터 (선택)" rows={2} />
        </div>
        <Btn onClick={add}>추가</Btn>
      </div>

      {strengths.map(sp => (
        <div key={sp.id} className="rounded-xl p-5 flex items-start justify-between gap-4"
             style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div>
            <span className="text-xs px-2 py-0.5 rounded-full mr-2"
                  style={{ background: "rgba(79,127,255,0.12)", color: "var(--accent)" }}>{sp.category}</span>
            <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>{sp.title}</span>
            {sp.description && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{sp.description}</p>}
            {sp.evidence_text && <p className="text-xs mt-1" style={{ color: "#fbbf24" }}>📌 {sp.evidence_text}</p>}
          </div>
          <Btn onClick={() => del(sp.id)} variant="danger">삭제</Btn>
        </div>
      ))}
    </div>
  );
}

// ── 스크립트 편집 ────────────────────────────────────────────────────────────
function ScriptsEditor({ courseId, scripts, onRefresh }: {
  courseId: number; scripts: Script[]; onRefresh: () => void;
}) {
  const [tag, setTag] = useState(SITUATION_TAGS[0]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const add = async () => {
    if (!title || !body) return;
    await api.createScript(courseId, { situation_tag: tag, title, body_template: body });
    setTitle(""); setBody("");
    onRefresh();
  };

  const del = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await api.deleteScript(id);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h3 className="font-semibold text-sm mb-3">새 스크립트 추가</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <select value={tag} onChange={e => setTag(e.target.value)}
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
            {SITUATION_TAGS.map(t => <option key={t}>{t}</option>)}
          </select>
          <Input value={title} onChange={setTitle} placeholder="스크립트 제목 *" />
        </div>
        <div className="mb-3">
          <Textarea value={body} onChange={setBody} placeholder="스크립트 내용 * ([고객명], [수강료] 등 변수 사용 가능)" rows={5} />
        </div>
        <Btn onClick={add}>추가</Btn>
      </div>

      {scripts.map(s => (
        <div key={s.id} className="rounded-xl p-5"
             style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(79,127,255,0.12)", color: "var(--accent)" }}>{s.situation_tag}</span>
              <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>{s.title}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>사용 {s.usage_count}회</span>
              <Btn onClick={() => del(s.id)} variant="danger">삭제</Btn>
            </div>
          </div>
          <pre className="text-xs whitespace-pre-wrap rounded-lg p-3 font-sans"
               style={{ background: "var(--surface2)", color: "var(--text-muted)" }}>{s.body_template}</pre>
        </div>
      ))}
    </div>
  );
}

// ── FAQ 편집 ────────────────────────────────────────────────────────────────
function FAQEditor({ courseId, faqs, onRefresh }: {
  courseId: number; faqs: FAQ[]; onRefresh: () => void;
}) {
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [type, setType] = useState("");

  const add = async () => {
    if (!q || !a) return;
    await api.createFAQ(courseId, { question: q, answer: a, objection_type: type || undefined });
    setQ(""); setA(""); setType("");
    onRefresh();
  };

  const del = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await api.deleteFAQ(id);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h3 className="font-semibold text-sm mb-3">새 FAQ 추가</h3>
        <div className="space-y-3 mb-3">
          <Input value={type} onChange={setType} placeholder="반론 유형 (예: 가격 이의, 합격률 의심)" />
          <Input value={q} onChange={setQ} placeholder="질문 *" />
          <Textarea value={a} onChange={setA} placeholder="답변 * (줄바꿈 가능)" rows={4} />
        </div>
        <Btn onClick={add}>추가</Btn>
      </div>

      {faqs.map(f => (
        <div key={f.id} className="rounded-xl p-5"
             style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              {f.objection_type && (
                <span className="text-xs px-2 py-0.5 rounded-full mr-2"
                      style={{ background: "rgba(168,85,247,0.12)", color: "#c084fc" }}>{f.objection_type}</span>
              )}
              <p className="font-semibold text-sm mt-1" style={{ color: "var(--text)" }}>Q. {f.question}</p>
              <p className="text-xs mt-2 whitespace-pre-line leading-relaxed" style={{ color: "var(--text-muted)" }}>A. {f.answer}</p>
            </div>
            <Btn onClick={() => del(f.id)} variant="danger">삭제</Btn>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 메인 ────────────────────────────────────────────────────────────────────
export default function AdminCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const courseId = parseInt(id);
  const [tab, setTab] = useState<AdminTab>("comparison");
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [strengths, setStrengths] = useState<StrengthPoint[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("tm_token");
    if (!token) { router.replace("/login"); return; }
    loadAll();
  }, [courseId, router]);

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      api.comparison(courseId),
      api.strengths(courseId),
      api.scripts(courseId),
      api.faq(courseId),
      api.competitors(),
    ])
      .then(([comp, str, sc, fq, comps]) => {
        setComparison(comp); setStrengths(str); setScripts(sc); setFaqs(fq); setCompetitors(comps);
      })
      .finally(() => setLoading(false));
  };

  if (loading || !comparison) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const course = comparison.course;
  const TABS: { id: AdminTab; label: string }[] = [
    { id: "comparison", label: "비교표 편집" },
    { id: "strengths",  label: "강점 편집" },
    { id: "scripts",    label: "스크립트 편집" },
    { id: "faq",        label: "FAQ 편집" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <header className="flex items-center gap-4 px-6 py-4"
              style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <Link href="/admin" className="text-sm flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          관리자
        </Link>
        <span style={{ color: "var(--border)" }}>│</span>
        <span className="text-lg">{course.icon}</span>
        <h1 className="font-bold">{course.name} — 데이터 편집</h1>
        <Link href={`/courses/${courseId}`} className="ml-auto text-xs px-3 py-1.5 rounded-lg"
              style={{ background: "var(--surface2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
          미리보기 →
        </Link>
      </header>

      <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-5xl mx-auto px-6 flex">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
                    className="px-5 py-3.5 text-sm font-medium border-b-2 transition"
                    style={{
                      borderColor: tab === t.id ? "var(--accent)" : "transparent",
                      color: tab === t.id ? "var(--accent)" : "var(--text-muted)",
                    }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-6">
        {tab === "comparison" && (
          <ComparisonEditor courseId={courseId} data={comparison} competitors={competitors} onRefresh={loadAll} />
        )}
        {tab === "strengths" && (
          <StrengthsEditor courseId={courseId} strengths={strengths} onRefresh={loadAll} />
        )}
        {tab === "scripts" && (
          <ScriptsEditor courseId={courseId} scripts={scripts} onRefresh={loadAll} />
        )}
        {tab === "faq" && (
          <FAQEditor courseId={courseId} faqs={faqs} onRefresh={loadAll} />
        )}
      </main>
    </div>
  );
}
