"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { patientLogin, setPatientSession } from "@/lib/patientAuth";
import PasswordInput from "@/components/PasswordInput";

export default function PatientLoginPage() {
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
      const res = await patientLogin(email, password);
      setPatientSession(res.access_token, res.patient);
      router.push("/portal/plano");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="form-container">
      <a href="/paciente" className="back-link">
        ← NutriHub
      </a>
      <h1>Entrar</h1>
      <p className="text-caption" style={{ marginBottom: 20 }}>
        Use o e-mail e a senha que seu nutricionista cadastrou pra você.
      </p>
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
    </main>
  );
}
