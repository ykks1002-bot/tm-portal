"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("tm_token")) router.replace("/");
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.login(email, password);
      localStorage.setItem("tm_token", res.access_token);
      localStorage.setItem("tm_user", JSON.stringify({ name: res.user_name, role: res.user_role }));
      router.replace("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "로그인 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-sm">
        {/* 로고 영역 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
               style={{ background: "var(--accent)" }}>
            <span className="text-2xl font-black text-white">E</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>에듀윌 TM 상담지원</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>내부 전용 포털 — 사내 계정으로 로그인하세요</p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit}
              className="rounded-2xl p-6 space-y-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="example@eduwill.net"
              required
              className="w-full rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 transition"
              style={{
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                color: "var(--text)",
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 transition"
              style={{
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                color: "var(--text)",
              }}
            />
          </div>

          {error && (
            <p className="text-sm rounded-lg px-4 py-2.5"
               style={{ background: "rgba(239,68,68,0.1)", color: "var(--danger)", border: "1px solid rgba(239,68,68,0.2)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg font-semibold text-sm transition disabled:opacity-60"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: "var(--text-muted)" }}>
          계정 문의: IT 인프라팀
        </p>
      </div>
    </main>
  );
}
