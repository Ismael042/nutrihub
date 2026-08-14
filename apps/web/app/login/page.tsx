"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { API_URL, setSession } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail ?? "Não foi possível entrar");
      }
      setSession(data.access_token, data.professional);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="form-container">
      <a href="/" className="back-link">
        ← NutriHub
      </a>
      <h1>Entrar</h1>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label className="field-label field-required" htmlFor="email">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label className="field-label field-required" htmlFor="password">
            Senha
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && (
          <div className="alert alert-error" style={{ marginBottom: "var(--space-4)" }}>
            <p>{error}</p>
          </div>
        )}
        <button type="submit" disabled={loading} className="btn-primary btn-block">
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
      <p style={{ marginTop: 16 }}>
        Ainda não tem conta? <a href="/cadastro">Cadastrar</a>
      </p>
    </main>
  );
}
