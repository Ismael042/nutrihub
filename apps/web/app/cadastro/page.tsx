"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { resendCode, setSession, signInWithGoogle, signup, verifyEmailCode } from "@/lib/auth";
import { formatCPF, isValidCPF, onlyDigits } from "@/lib/masks";

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

const RESEND_COOLDOWN_SECONDS = 60;

export default function CadastroPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "verify">("form");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cpf, setCpf] = useState("");
  const cpfRef = useRef(cpf);
  useEffect(() => {
    cpfRef.current = cpf;
  }, [cpf]);

  const [professionalId, setProfessionalId] = useState("");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleGoogleCredential(response: { credential: string }) {
    setError(null);
    if (!isValidCPF(cpfRef.current)) {
      setError("Preencha seu CPF antes de continuar com o Google");
      return;
    }
    setLoading(true);
    try {
      const res = await signInWithGoogle({ id_token: response.credential, cpf: onlyDigits(cpfRef.current) });
      setSession(res.access_token, res.professional);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!googleReady || step !== "form") return;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const el = document.getElementById("google-signup-button");
    if (!clientId || !el || !window.google) return;
    window.google.accounts.id.initialize({ client_id: clientId, callback: handleGoogleCredential });
    window.google.accounts.id.renderButton(el, { theme: "outline", size: "large", width: 320 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleReady, step]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidCPF(cpf)) {
      setError("CPF inválido");
      return;
    }
    setLoading(true);
    try {
      const res = await signup({ name, email, password, cpf: onlyDigits(cpf) });
      setProfessionalId(res.professional_id);
      setStep("verify");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await verifyEmailCode({ professional_id: professionalId, code });
      setSession(res.access_token, res.professional);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setError(null);
    try {
      await resendCode({ professional_id: professionalId });
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    }
  }

  return (
    <main className="form-container">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setGoogleReady(true)} />
      <a href="/" className="back-link">
        ← NutriHub
      </a>

      {step === "form" ? (
        <>
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
            <div className="field field-sm">
              <label className="field-label field-required" htmlFor="cpf">
                CPF
              </label>
              <input
                id="cpf"
                inputMode="numeric"
                autoComplete="off"
                placeholder="000.000.000-00"
                maxLength={14}
                value={cpf}
                onChange={(e) => setCpf(formatCPF(e.target.value))}
                required
              />
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

          <div className="auth-divider">ou continue com</div>
          <div className="auth-google-button" data-disabled={!isValidCPF(cpf)}>
            <div id="google-signup-button" />
          </div>
          {!isValidCPF(cpf) && (
            <p className="field-hint" style={{ textAlign: "center", marginTop: 8 }}>
              Preencha um CPF válido pra habilitar o cadastro com Google.
            </p>
          )}

          <p style={{ marginTop: 16 }}>
            Já tem conta? <a href="/login">Entrar</a>
          </p>
        </>
      ) : (
        <>
          <h1>Confirme seu e-mail</h1>
          <p className="page-subtitle">Enviamos um código de 6 dígitos para {email}.</p>
          <form onSubmit={handleVerify}>
            <div className="field otp-field">
              <label className="field-label field-required" htmlFor="code">
                Código de verificação
              </label>
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(onlyDigits(e.target.value))}
                required
              />
            </div>
            {error && (
              <div className="alert alert-error" style={{ marginBottom: "var(--space-4)" }}>
                <p>{error}</p>
              </div>
            )}
            <button type="submit" disabled={loading || code.length !== 6} className="btn-primary btn-block">
              {loading ? "Confirmando..." : "Confirmar"}
            </button>
          </form>
          <div className="otp-resend">
            <button type="button" onClick={handleResend} disabled={cooldown > 0}>
              {cooldown > 0 ? `Reenviar código em ${cooldown}s` : "Reenviar código"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
