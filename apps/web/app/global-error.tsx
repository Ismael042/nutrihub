"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "-apple-system, 'Segoe UI', sans-serif", background: "#F6F8F6", color: "#182019" }}>
        <main style={{ maxWidth: 440, margin: "18vh auto 0", padding: "0 24px", textAlign: "center" }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Algo deu errado</h1>
          <p style={{ color: "#54604F", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
            O NutriHub encontrou um erro inesperado ao carregar. Tente novamente — se persistir, feche e reabra a
            página.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#0F9D74",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Tentar de novo
          </button>
        </main>
      </body>
    </html>
  );
}
