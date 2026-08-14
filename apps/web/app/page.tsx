export default function HomePage() {
  return (
    <main className="page-container" style={{ paddingTop: "clamp(32px, 8vh, 96px)" }}>
      <div style={{ maxWidth: 620 }}>
        <span
          style={{
            fontSize: 13,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--color-accent, #B08D57)",
            fontWeight: 700
          }}
        >
          Para nutricionistas
        </span>
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 2.75rem)", lineHeight: 1.15, marginTop: 8 }}>
          O consultório de nutrição, organizado num só lugar.
        </h1>
        <p style={{ fontSize: 18, color: "#555", marginTop: 12, lineHeight: 1.6 }}>
          Pacientes, agenda, planos alimentares, financeiro e prescrições — com um app
          próprio para o seu paciente acompanhar o plano, conversar com você e registrar
          o diário alimentar pelo celular.
        </p>

        <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
          <a href="/cadastro" className="btn-primary" style={{ padding: "12px 24px", fontSize: 16 }}>
            Criar minha conta
          </a>
          <a
            href="/login"
            style={{
              padding: "12px 24px",
              fontSize: 16,
              border: "1px solid var(--color-border, #ddd)",
              borderRadius: 8
            }}
          >
            Já tenho conta
          </a>
        </div>

        <div className="card-grid" style={{ marginTop: 48 }}>
          <div className="card">
            <h3 style={{ margin: 0, fontSize: 15 }}>Atendimento</h3>
            <p style={{ fontSize: 14, color: "#666", marginTop: 6 }}>
              Pacientes, agenda, locais de atendimento e página pública com agendamento
              online.
            </p>
          </div>
          <div className="card">
            <h3 style={{ margin: 0, fontSize: 15 }}>Planos e prescrições</h3>
            <p style={{ fontSize: 14, color: "#666", marginTop: 6 }}>
              Planos alimentares com PDF, listas de substituição, exames e prescrições
              estruturadas.
            </p>
          </div>
          <div className="card">
            <h3 style={{ margin: 0, fontSize: 15 }}>App do paciente</h3>
            <p style={{ fontSize: 14, color: "#666", marginTop: 6 }}>
              Chat, diário alimentar e acompanhamento do plano direto no celular do seu
              paciente.
            </p>
          </div>
          <div className="card">
            <h3 style={{ margin: 0, fontSize: 15 }}>Financeiro</h3>
            <p style={{ fontSize: 14, color: "#666", marginTop: 6 }}>
              Fluxo de caixa, categorias, relatórios, cobrança recorrente e estoque de
              produtos.
            </p>
          </div>
        </div>

        <p style={{ marginTop: 40, fontSize: 14, color: "#888" }}>
          É paciente e precisa acessar seu plano alimentar?{" "}
          <a href="/paciente">Veja como funciona</a> — o acesso é liberado pelo seu
          nutricionista.
        </p>
      </div>
    </main>
  );
}
