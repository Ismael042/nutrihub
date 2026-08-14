import type { Metadata } from "next";
import { IconClipboard, IconBook, IconUsers } from "@/components/icons";

export const metadata: Metadata = {
  title: "NutriHub — área do paciente",
  description:
    "Veja seu plano alimentar, registre o diário alimentar e converse com seu nutricionista pelo app do NutriHub.",
  openGraph: {
    title: "NutriHub — área do paciente",
    description:
      "Veja seu plano alimentar, registre o diário alimentar e converse com seu nutricionista pelo app do NutriHub.",
    type: "website"
  }
};

export default function PacientePage() {
  return (
    <>
      <header className="marketing">
        <nav className="marketing-nav">
          <span style={{ fontWeight: 700, fontSize: 18 }}>
            Nutri<span style={{ color: "var(--color-primary)" }}>Hub</span>
          </span>
          <a href="/" className="btn-secondary btn-sm">
            Sou nutricionista
          </a>
        </nav>
      </header>

      <main>
        <section className="marketing marketing-section marketing-hero">
          <span className="marketing-eyebrow">Para pacientes</span>
          <h1>Seu plano alimentar e seu nutricionista, no celular.</h1>
          <p className="marketing-lede">
            O app do NutriHub mostra seu plano alimentar e prescrições, deixa você
            registrar o que comeu no diário alimentar e conversar direto com seu
            nutricionista — sem precisar esperar a próxima consulta.
          </p>
        </section>

        <section className="marketing marketing-section marketing-section-border">
          <span className="marketing-eyebrow">O que você encontra</span>
          <h2>Tudo que você precisa entre uma consulta e outra</h2>
          <div className="marketing-grid">
            <div className="card">
              <IconClipboard width={26} height={26} style={{ color: "var(--color-primary)" }} />
              <h3 style={{ marginTop: 10 }}>Plano alimentar</h3>
              <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginTop: 6 }}>
                Veja suas refeições e baixe o PDF sempre que seu nutricionista
                atualizar o plano.
              </p>
            </div>
            <div className="card">
              <IconBook width={26} height={26} style={{ color: "var(--color-primary)" }} />
              <h3 style={{ marginTop: 10 }}>Diário alimentar</h3>
              <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginTop: 6 }}>
                Registre o que comeu em cada refeição — seu nutricionista acompanha
                pelo painel dele.
              </p>
            </div>
            <div className="card">
              <IconUsers width={26} height={26} style={{ color: "var(--color-primary)" }} />
              <h3 style={{ marginTop: 10 }}>Chat</h3>
              <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginTop: 6 }}>
                Fale com seu nutricionista sem precisar esperar a próxima consulta.
              </p>
            </div>
          </div>
        </section>

        <section className="marketing marketing-section marketing-section-border">
          <h2 style={{ fontSize: 17 }}>Como ter acesso</h2>
          <div className="alert alert-info" style={{ maxWidth: "70ch" }}>
            <p>
              O acesso ao app é liberado pelo seu nutricionista, não por cadastro
              próprio — peça a ele para habilitar seu acesso e te passar o e-mail e a
              senha de entrada. O app ainda está em fase de testes e não está
              publicado nas lojas; se seu nutricionista já usa o NutriHub, pergunte a
              ele como acessar.
            </p>
          </div>
        </section>

        <section className="marketing marketing-section" style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: 19 }}>É nutricionista e quer oferecer isso aos seus pacientes?</h2>
          <div className="marketing-cta-row" style={{ justifyContent: "center" }}>
            <a href="/" className="btn-primary">
              Conheça o NutriHub
            </a>
          </div>
        </section>
      </main>

      <footer className="marketing" style={{ padding: "var(--space-6) clamp(1.25rem, 4vw, 2rem)", borderTop: "1px solid var(--color-border)" }}>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>
          NutriHub — sistema de gestão para nutricionistas.
        </p>
      </footer>
    </>
  );
}
