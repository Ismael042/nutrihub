"use client";

import { useRouter } from "next/navigation";
import { clearSession, useRequireAuth } from "@/lib/auth";

const NAV_GROUPS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Atendimento",
    links: [
      { href: "/pacientes", label: "Pacientes" },
      { href: "/agenda", label: "Agenda" },
      { href: "/locais", label: "Locais de atendimento" },
      { href: "/financeiro", label: "Financeiro" }
    ]
  },
  {
    title: "Meu conteúdo",
    links: [
      { href: "/conteudo/planos", label: "Planos alimentares" },
      { href: "/conteudo/receitas", label: "Receitas" },
      { href: "/conteudo/alimentos", label: "Alimentos" },
      { href: "/conteudo/listas-substituicao", label: "Listas de substituição" },
      { href: "/conteudo/questionarios", label: "Anamnese / Questionário" }
    ]
  },
  {
    title: "Outros cadastros",
    links: [
      { href: "/prescricoes", label: "Prescrições" },
      { href: "/metas", label: "Metas" },
      { href: "/exames", label: "Solicitações de exames" },
      { href: "/farmacias", label: "Farmácias" },
      { href: "/tags", label: "Tags" }
    ]
  },
  {
    title: "Organização",
    links: [
      { href: "/nutriplan", label: "NutriPlan" },
      { href: "/equipe", label: "Equipe" },
      { href: "/configuracoes/pagina-publica", label: "Página pública" }
    ]
  }
];

export default function DashboardPage() {
  const router = useRouter();
  const professional = useRequireAuth();

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  if (!professional) return null;

  return (
    <>
      <header className="app-header">
        <span className="brand">
          Nutri<span className="brand-accent">Hub</span>
        </span>
        <div className="user-info">
          <span style={{ fontSize: 14, opacity: 0.85 }}>
            {professional.name} · {professional.email}
          </span>
          <button onClick={handleLogout}>Sair</button>
        </div>
      </header>

      <main className="page-container" style={{ fontFamily: "system-ui" }}>
        <h1>Olá, {professional.name.split(" ")[0]}</h1>

        <div className="dashboard-grid">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="card">
              <h3>{group.title}</h3>
              <ul>
                {group.links.map((link) => (
                  <li key={link.href}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
