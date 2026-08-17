"use client";

import { useEffect, useState, type FormEvent } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { API_URL, setSession, signInWithGoogle } from "@/lib/auth";
import PasswordInput from "@/components/PasswordInput";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  async function handleGoogleCredential(response: { credential: string }) {
    setError(null);
    try {
      const res = await signInWithGoogle({ id_token: response.credential });
      setSession(res.access_token, res.professional);
      router.push("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado";
      if (message === "cpf_required") {
        setError("Conta não encontrada. Crie uma conta primeiro.");
      } else {
        setError(message);
      }
    }
  }

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const el = document.getElementById("google-login-button");
    if (!googleReady || !clientId || !el || !window.google) return;
    window.google.accounts.id.initialize({ client_id: clientId, callback: handleGoogleCredential });
    window.google.accounts.id.renderButton(el, { theme: "outline", size: "large", width: 320 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleReady]);

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
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setGoogleReady(true)} />
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
          <PasswordInput
            id="password"
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

      <div className="auth-divider">ou continue com</div>
      <div className="auth-google-button">
        <div id="google-login-button" />
      </div>

      <p style={{ marginTop: 16 }}>
        Ainda não tem conta? <a href="/cadastro">Cadastrar</a>
      </p>
    </main>
  );
}
