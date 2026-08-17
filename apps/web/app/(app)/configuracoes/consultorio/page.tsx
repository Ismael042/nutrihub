"use client";

import { useEffect, useState } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
import PhotoUpload from "@/components/PhotoUpload";

interface TenantSettings {
  id: string;
  name: string;
  logo_url: string | null;
}

export default function ConsultorioConfigPage() {
  const professional = useRequireAuth();
  const [tenant, setTenant] = useState<TenantSettings | null>(null);

  useEffect(() => {
    if (!professional) return;
    authFetch("/me/tenant").then(async (res) => {
      if (res.ok) setTenant(await res.json());
    });
  }, [professional]);

  if (!professional) return null;

  const isAdmin = professional.role === "admin" || !professional.role;

  return (
    <main className="form-container">
      <a href="/dashboard" className="back-link">← Dashboard</a>
      <h1>Consultório</h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
        Configurações que valem pra todo mundo do consultório, não só pra você.
      </p>

      <div className="field" style={{ marginTop: 16 }}>
        <span className="field-label">Logo</span>
        {isAdmin ? (
          <PhotoUpload
            endpoint="/me/tenant/logo"
            photoUrl={tenant?.logo_url ?? null}
            onChange={(data) => setTenant(data as unknown as TenantSettings)}
            fallback="Sem logo"
            emptyLabel="Enviar logo"
            hint="PNG com fundo transparente fica melhor. Aparece no cabeçalho do PDF do plano alimentar."
            alt="Logo do consultório"
            shape="rect"
            confirmTitle="Remover o logo?"
            confirmDescription="Os PDFs voltam a sair sem marca."
          />
        ) : (
          <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
            Só administradores podem trocar o logo do consultório.
          </p>
        )}
      </div>
    </main>
  );
}
