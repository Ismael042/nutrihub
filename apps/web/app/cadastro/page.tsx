"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { API_URL, setSession } from "@/lib/auth";

export default function CadastroPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail ?? "Não foi possível cadastrar");
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
      <h1>Criar conta</h1>
      <p className="page-subtitle">Cadastro da nutricionista no NutriHub.</p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label className="field-label field-required" htmlFor="name">
            Nome
          </label>
          <input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <span className="field-hint">Mínimo de 8 caracteres.</span>
        </div>
        {error && (
          <div className="alert alert-error" style={{ marginBottom: "var(--space-4)" }}>
            <p>{error}</p>
          </div>
        )}
        <button type="submit" disabled={loading} className="btn-primary btn-block">
          {loading ? "Cadastrando..." : "Cadastrar"}
        </button>
      </form>
      <p style={{ marginTop: 16 }}>
        Já tem conta? <a href="/login">Entrar</a>
      </p>
    </main>
  );
}
