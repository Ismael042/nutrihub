"use client";

import { useEffect } from "react";
import EmptyState from "@/components/EmptyState";
import { IconAlertCircle } from "@/components/icons";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="page-container">
      <EmptyState
        icon={<IconAlertCircle />}
        title="Algo deu errado"
        description="Essa tela encontrou um erro inesperado. Tente novamente — se persistir, volte pro painel."
      />
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: "var(--space-4)" }}>
        <button type="button" className="btn-primary" onClick={reset}>
          Tentar de novo
        </button>
        <a href="/dashboard" className="btn-secondary">
          Voltar ao painel
        </a>
      </div>
    </main>
  );
}
