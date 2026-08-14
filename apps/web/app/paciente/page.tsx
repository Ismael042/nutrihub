export default function PacientePage() {
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
          Para pacientes
        </span>
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 2.75rem)", lineHeight: 1.15, marginTop: 8 }}>
          Seu plano alimentar e seu nutricionista, no celular.
        </h1>
        <p style={{ fontSize: 18, color: "#555", marginTop: 12, lineHeight: 1.6 }}>
          O app do NutriHub mostra seu plano alimentar e prescrições, deixa você
          registrar o que comeu no diário alimentar e conversar direto com seu
          nutricionista.
        </p>

        <div className="card-grid" style={{ marginTop: 32 }}>
          <div className="card">
            <h3 style={{ margin: 0, fontSize: 15 }}>Plano alimentar</h3>
            <p style={{ fontSize: 14, color: "#666", marginTop: 6 }}>
              Veja suas refeições e baixe o PDF sempre que seu nutricionista atualizar o
              plano.
            </p>
          </div>
          <div className="card">
            <h3 style={{ margin: 0, fontSize: 15 }}>Diário alimentar</h3>
            <p style={{ fontSize: 14, color: "#666", marginTop: 6 }}>
              Registre o que comeu em cada refeição — seu nutricionista acompanha pelo
              painel dele.
            </p>
          </div>
          <div className="card">
            <h3 style={{ margin: 0, fontSize: 15 }}>Chat</h3>
            <p style={{ fontSize: 14, color: "#666", marginTop: 6 }}>
              Fale com seu nutricionista sem precisar esperar a próxima consulta.
            </p>
          </div>
        </div>

        <div
          style={{
            marginTop: 40,
            padding: 20,
            border: "1px solid var(--color-border, #ddd)",
            borderRadius: 10,
            background: "#faf9f6"
          }}
        >
          <h2 style={{ fontSize: 17, margin: "0 0 8px" }}>Como ter acesso</h2>
          <p style={{ fontSize: 15, color: "#444", margin: 0, lineHeight: 1.6 }}>
            O acesso ao app é liberado pelo seu nutricionista, não por cadastro próprio
            — peça a ele para habilitar seu acesso e te passar o e-mail e a senha de
            entrada. O app ainda está em fase de testes e não está publicado nas lojas;
            se seu nutricionista já usa o NutriHub, pergunte a ele como instalar.
          </p>
        </div>

        <p style={{ marginTop: 32, fontSize: 14, color: "#888" }}>
          É nutricionista e quer oferecer isso aos seus pacientes?{" "}
          <a href="/">Conheça o NutriHub</a>
        </p>
      </div>
    </main>
  );
}
