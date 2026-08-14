import type { Metadata } from "next";
import { IconUsers, IconClipboard, IconWallet, IconCalendar } from "@/components/icons";

export const metadata: Metadata = {
  title: "NutriHub — painel para nutricionistas",
  description:
    "Pacientes, agenda, planos alimentares e financeiro num só painel, com um app para o paciente acompanhar tudo pelo celular.",
  openGraph: {
    title: "NutriHub — painel para nutricionistas",
    description:
      "Pacientes, agenda, planos alimentares e financeiro num só painel, com um app para o paciente acompanhar tudo pelo celular.",
    type: "website"
  }
};

export default function HomePage() {
  return (
    <>
      <header className="marketing">
        <nav className="marketing-nav">
          <span style={{ fontWeight: 700, fontSize: 18 }}>
            Nutri<span style={{ color: "var(--color-primary)" }}>Hub</span>
          </span>
          <a href="/login" className="btn-secondary btn-sm">
            Entrar
          </a>
        </nav>
      </header>

      <main>
        <section className="marketing marketing-section marketing-hero">
          <span className="marketing-eyebrow">Para nutricionistas</span>
          <h1>O consultório de nutrição, organizado num só lugar.</h1>
          <p className="marketing-lede">
            Pare de dividir o consultório entre planilha, WhatsApp e agenda de papel.
            Pacientes, agenda, planos alimentares e financeiro num só painel — com um
            app próprio para o seu paciente acompanhar o plano, conversar com você e
            registrar o diário alimentar pelo celular.
          </p>
          <div className="marketing-cta-row">
            <a href="/cadastro" className="btn-primary">
              Criar minha conta
            </a>
            <a href="/login" className="btn-secondary">
              Já tenho conta
            </a>
          </div>
        </section>

        <section className="marketing marketing-section marketing-section-border">
          <span className="marketing-eyebrow">O que resolve</span>
          <h2>Tudo que o dia a dia do consultório precisa</h2>
          <div className="marketing-grid">
            <div className="card">
              <IconUsers width={26} height={26} style={{ color: "var(--color-primary)" }} />
              <h3 style={{ marginTop: 10 }}>Atendimento</h3>
              <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginTop: 6 }}>
                Pacientes, agenda, locais de atendimento e página pública com
                agendamento online.
              </p>
            </div>
            <div className="card">
              <IconClipboard width={26} height={26} style={{ color: "var(--color-primary)" }} />
              <h3 style={{ marginTop: 10 }}>Planos e prescrições</h3>
              <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginTop: 6 }}>
                Planos alimentares com PDF, listas de substituição, exames e
                prescrições estruturadas.
              </p>
            </div>
            <div className="card">
              <IconCalendar width={26} height={26} style={{ color: "var(--color-primary)" }} />
              <h3 style={{ marginTop: 10 }}>App do paciente</h3>
              <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginTop: 6 }}>
                Chat, diário alimentar e acompanhamento do plano direto no celular do
                seu paciente.
              </p>
            </div>
            <div className="card">
              <IconWallet width={26} height={26} style={{ color: "var(--color-primary)" }} />
              <h3 style={{ marginTop: 10 }}>Financeiro</h3>
              <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginTop: 6 }}>
                Fluxo de caixa, categorias, relatórios, cobrança recorrente e estoque
                de produtos.
              </p>
            </div>
          </div>
        </section>

        <section className="marketing marketing-section marketing-section-border">
          <span className="marketing-eyebrow">Planos</span>
          <h2>Um plano pra cada tamanho de consultório</h2>
          <p className="marketing-lede" style={{ marginBottom: "var(--space-6)" }}>
            Valores em definição — o NutriHub ainda está em fase de testes. As faixas
            abaixo são uma referência de para onde os planos devem ir, não um preço
            fechado.
          </p>
          <div className="pricing-grid">
            <div className="pricing-card">
              <h3 style={{ margin: 0 }}>Autônomo</h3>
              <p style={{ color: "var(--color-text-muted)", fontSize: 14, margin: 0 }}>
                Pra quem atende sozinho.
              </p>
              <div className="pricing-price">
                R$ 49<span className="period">/mês (a definir)</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: "var(--color-text-secondary)" }}>
                <li>1 profissional</li>
                <li>Pacientes ilimitados</li>
                <li>App do paciente incluído</li>
              </ul>
            </div>
            <div className="pricing-card featured">
              <h3 style={{ margin: 0 }}>Consultório</h3>
              <p style={{ color: "var(--color-text-muted)", fontSize: 14, margin: 0 }}>
                Pra equipes pequenas.
              </p>
              <div className="pricing-price">
                R$ 99<span className="period">/mês (a definir)</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: "var(--color-text-secondary)" }}>
                <li>Até 5 profissionais</li>
                <li>Papéis de admin/assistente</li>
                <li>Relatórios financeiros</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="marketing marketing-section marketing-section-border">
          <span className="marketing-eyebrow">Dúvidas comuns</span>
          <h2>Perguntas frequentes</h2>
          <div style={{ maxWidth: "68ch" }}>
            <details className="faq-item">
              <summary>Preciso instalar algo?</summary>
              <p>Não. O painel do NutriHub roda no navegador, sem instalação.</p>
            </details>
            <details className="faq-item">
              <summary>Meu paciente também precisa instalar um aplicativo?</summary>
              <p>
                O acesso do paciente é liberado por você, direto do cadastro dele — não
                é um cadastro público. O app do paciente ainda está em fase de testes e
                não está publicado nas lojas de aplicativo.
              </p>
            </details>
            <details className="faq-item">
              <summary>Os dados de cada consultório ficam isolados?</summary>
              <p>
                Sim. O NutriHub é multi-tenant: cada consultório só enxerga os próprios
                pacientes, agenda e financeiro.
              </p>
            </details>
          </div>
        </section>

        <section className="marketing marketing-section" style={{ textAlign: "center" }}>
          <h2>Pronto pra organizar o consultório?</h2>
          <div className="marketing-cta-row" style={{ justifyContent: "center" }}>
            <a href="/cadastro" className="btn-primary">
              Criar minha conta
            </a>
          </div>
          <p style={{ marginTop: "var(--space-6)", fontSize: 14, color: "var(--color-text-muted)" }}>
            É paciente e precisa acessar seu plano alimentar?{" "}
            <a href="/paciente">Veja como funciona</a> — o acesso é liberado pelo seu
            nutricionista.
          </p>
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
