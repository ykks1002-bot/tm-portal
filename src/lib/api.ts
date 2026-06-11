// 정적 모드 감지 (GitHub Pages 배포 시)
const isStatic = (): boolean =>
  typeof window !== "undefined" &&
  (window.location.hostname.includes("github.io") ||
    process.env.NEXT_PUBLIC_STATIC === "true");

const BASE     = process.env.NEXT_PUBLIC_API_URL ?? "";
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// ── 일반 API 요청 (로컬 서버) ────────────────────────────────────────────────
function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("tm_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem("tm_token");
    localStorage.removeItem("tm_user");
    window.location.href = `${BASE_PATH}/login`;
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "요청 실패");
  }

  return res.json() as Promise<T>;
}

// ── 정적 파일 요청 (GitHub Pages) ────────────────────────────────────────────
function apiPathToDataFile(path: string): string {
  // /api/courses                     → courses.json
  // /api/promotions/active           → promotions.json
  // /api/courses/1/comparison        → course-1-comparison.json
  // /api/courses/1/strengths         → course-1-strengths.json
  // /api/courses/1/scripts           → course-1-scripts.json
  // /api/courses/1/faq               → course-1-faq.json
  const p = path.replace(/^\/api\//, "");
  if (p === "courses") return "courses.json";
  if (p === "promotions/active") return "promotions.json";
  const m = p.match(/^courses\/(\d+)\/(comparison|strengths|scripts|faq)$/);
  if (m) return `course-${m[1]}-${m[2]}.json`;
  throw new Error(`정적 파일 없음: ${path}`);
}

async function staticRequest<T>(path: string): Promise<T> {
  const file = apiPathToDataFile(path);
  const res  = await fetch(`${BASE_PATH}/data/${file}`);
  if (!res.ok) throw new Error(`데이터 파일 없음: ${file}`);
  return res.json() as Promise<T>;
}

// ── 자동 선택 래퍼 ────────────────────────────────────────────────────────────
async function get<T>(path: string): Promise<T> {
  return isStatic() ? staticRequest<T>(path) : request<T>(path);
}

// ── 정적 모드 로그인 (백엔드 없이 .env.local 비밀번호로 인증) ─────────────────
function staticLogin(email: string, password: string) {
  const expected = process.env.NEXT_PUBLIC_STATIC_PASSWORD ?? "eduwill2026!";
  if (password !== expected) return Promise.reject(new Error("비밀번호가 올바르지 않습니다"));
  return Promise.resolve({
    access_token: "static-local",
    user_name: email.split("@")[0],
    user_role: "agent",
  });
}

// ── 공개 API ─────────────────────────────────────────────────────────────────
export const api = {
  // Auth
  login: (email: string, password: string) =>
    isStatic()
      ? staticLogin(email, password)
      : request<{ access_token: string; user_name: string; user_role: string }>(
          "/api/auth/login",
          { method: "POST", body: JSON.stringify({ email, password }) }
        ),
  me: () => request<{ id: number; email: string; name: string; role: string }>("/api/auth/me"),

  // Courses
  courses: () => get<Course[]>("/api/courses"),
  course:  (id: number) => get<Course>(`/api/courses/${id}`),

  // Comparison
  comparison: (courseId: number) => get<ComparisonResponse>(`/api/courses/${courseId}/comparison`),
  createComparisonItem: (courseId: number, body: Partial<ComparisonItem>) =>
    request(`/api/courses/${courseId}/comparison/items`, { method: "POST", body: JSON.stringify(body) }),
  updateComparisonItem: (itemId: number, body: Partial<ComparisonItem>) =>
    request(`/api/comparison/items/${itemId}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteComparisonItem: (itemId: number) =>
    request(`/api/comparison/items/${itemId}`, { method: "DELETE" }),
  upsertComparisonValue: (body: { comparison_item_id: number; competitor_id: number | null; value_text: string }) =>
    request("/api/comparison/values", { method: "POST", body: JSON.stringify(body) }),

  // Strengths
  strengths: (courseId: number) => get<StrengthPoint[]>(`/api/courses/${courseId}/strengths`),
  createStrength: (courseId: number, body: Partial<StrengthPoint>) =>
    request(`/api/courses/${courseId}/strengths`, { method: "POST", body: JSON.stringify(body) }),
  updateStrength: (id: number, body: Partial<StrengthPoint>) =>
    request(`/api/strengths/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteStrength: (id: number) => request(`/api/strengths/${id}`, { method: "DELETE" }),

  // Scripts
  scripts: (courseId: number) => get<Script[]>(`/api/courses/${courseId}/scripts`),
  recordScriptUse: (scriptId: number) =>
    isStatic()
      ? Promise.resolve()
      : request(`/api/scripts/${scriptId}/use`, { method: "POST" }),
  createScript: (courseId: number, body: Partial<Script>) =>
    request(`/api/courses/${courseId}/scripts`, { method: "POST", body: JSON.stringify(body) }),
  updateScript: (id: number, body: Partial<Script>) =>
    request(`/api/scripts/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteScript: (id: number) => request(`/api/scripts/${id}`, { method: "DELETE" }),

  // FAQ
  faq: (courseId: number) => get<FAQ[]>(`/api/courses/${courseId}/faq`),
  createFAQ: (courseId: number, body: Partial<FAQ>) =>
    request(`/api/courses/${courseId}/faq`, { method: "POST", body: JSON.stringify(body) }),
  updateFAQ: (id: number, body: Partial<FAQ>) =>
    request(`/api/faq/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteFAQ: (id: number) => request(`/api/faq/${id}`, { method: "DELETE" }),

  // Promotions
  activePromotions: () => get<Promotion[]>("/api/promotions/active"),
  createPromotion: (body: Partial<Promotion>) =>
    request("/api/promotions", { method: "POST", body: JSON.stringify(body) }),
  togglePromotion: (id: number) => request(`/api/promotions/${id}`, { method: "PUT" }),
  deletePromotion: (id: number) => request(`/api/promotions/${id}`, { method: "DELETE" }),

  // Competitors
  competitors: () => request<Competitor[]>("/api/competitors"),
  createCompetitor: (name: string) =>
    request("/api/competitors", { method: "POST", body: JSON.stringify({ name }) }),
  deleteCompetitor: (id: number) => request(`/api/competitors/${id}`, { method: "DELETE" }),

  // Admin
  adminStats: () => request<AdminStats>("/api/admin/stats"),
  adminUsers: () => request<User[]>("/api/admin/users"),
  createUser: (body: { email: string; name: string; password: string; role: string }) =>
    request("/api/admin/users", { method: "POST", body: JSON.stringify(body) }),
  toggleUser: (id: number) => request(`/api/admin/users/${id}/toggle`, { method: "PUT" }),

  // Price Management
  priceManagement: () => request<PriceRow[]>("/api/admin/prices"),
  priceAlerts: () => request<PriceAlert[]>("/api/admin/price-alerts"),
  markAlertSeen: (id: number) => request(`/api/admin/price-alerts/${id}/seen`, { method: "POST" }),
  markAllAlertsSeen: () => request("/api/admin/price-alerts/seen-all", { method: "POST" }),
  deleteAlert: (id: number) => request(`/api/admin/price-alerts/${id}`, { method: "DELETE" }),

  // Scrape Control
  triggerScrape: () => request<{ ok: boolean; message: string }>("/api/admin/scrape/trigger", { method: "POST" }),
  scrapeStatus: () => request<ScrapeStatus>("/api/admin/scrape/status"),
};

// Types
export interface Course {
  id: number; name: string; category: string; icon: string;
  sort_order: number; is_active: boolean;
}
export interface Competitor {
  id: number; name: string; is_active: boolean;
}
export interface ComparisonItem {
  id: number; name: string; description?: string;
  is_eduwill_advantage: boolean; sort_order: number;
  eduwill_value: string; competitor_values: Record<string, string>;
}
export interface ComparisonResponse {
  course: { id: number; name: string; category: string; icon: string };
  competitors: { id: number; name: string }[];
  items: ComparisonItem[];
  last_updated?: string | null;
}
export interface StrengthPoint {
  id: number; category: string; title: string;
  description?: string; evidence_text?: string; sort_order: number;
}
export interface Script {
  id: number; situation_tag: string; title: string;
  body_template: string; usage_count: number;
}
export interface FAQ {
  id: number; question: string; answer: string;
  objection_type?: string; is_active: boolean;
}
export interface Promotion {
  id: number; course_id?: number; title: string;
  content?: string; end_at?: string; is_active: boolean;
}
export interface User {
  id: number; email: string; name: string; role: string;
}
export interface AdminStats {
  total_courses: number; total_competitors: number; total_scripts: number;
  total_faqs: number; total_strength_points: number; active_promotions: number;
  pending_price_alerts: number;
}
export interface PriceRow {
  item_id: number; competitor_id: number | null;
  course_name: string; course_icon: string;
  item_name: string; competitor_name: string;
  value_text: string; updated_at: string | null;
}
export interface PriceAlert {
  id: number; course_name: string; competitor_name: string;
  product_name: string; old_price: string; new_price: string;
  detected_at: string | null; status: string;
}
export interface ScrapeStatus {
  is_running: boolean;
  last_run_at: string | null;
  last_success_at: string | null;
  message: string;
}
