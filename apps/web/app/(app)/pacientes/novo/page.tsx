"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authFetch, useRequireAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";

export default function NovoPacientePage() {
  const professional = useRequireAuth();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!professional) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authFetch("/patients", {
        method: "POST",
        body: JSON.stringify({
          name,
          email: email || null,
          phone: phone || null,
          birth_date: birthDate || null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Não foi possível cadastrar o paciente");
      toast.success(`${name.split(" ")[0]} foi cadastrado(a).`);
      router.push(`/pacientes/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="form-container">
      <a href="/pacientes" className="back-link">← Pacientes</a>
      <h1>Novo paciente</h1>
      <p className="page-subtitle">Só o nome é obrigatório — o resto você completa quando quiser.</p>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label className="field-label field-required" htmlFor="name">
            Nome
          </label>
          <input id="name" placeholder="Nome completo" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="email">
            E-mail
          </label>
          <input id="email" placeholder="paciente@email.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="phone">
            Telefone
          </label>
          <input id="phone" placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="birthDate">
            Data de nascimento
          </label>
          <input id="birthDate" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "var(--space-4)" }}>
            <p>{error}</p>
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary btn-block">
          {loading ? "Salvando..." : "Salvar paciente"}
        </button>
      </form>
    </main>
  );
}
