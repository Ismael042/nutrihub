"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authFetch, useRequireAuth } from "@/lib/auth";

export default function NovoPacientePage() {
  const professional = useRequireAuth();
  const router = useRouter();
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
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
        <input
          placeholder="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input placeholder="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Data de nascimento
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </label>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary" style={{ padding: 10 }}>
          {loading ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </main>
  );
}
