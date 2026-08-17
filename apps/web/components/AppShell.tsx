"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, type Professional } from "@/lib/auth";
import { initials } from "@/lib/initials";
import {
  IconApple,
  IconBook,
  IconCalendar,
  IconCheckSquare,
  IconClipboard,
  IconFileText,
  IconFlask,
  IconGlobe,
  IconLogOut,
  IconMapPin,
  IconMenu,
  IconPill,
  IconRepeat,
  IconStore,
  IconTag,
  IconTarget,
  IconTeam,
  IconUsers,
  IconWallet,
  IconX
} from "./icons";

interface NavItem {
  href: string;
  label: string;
  icon: (props: { className?: string }) => JSX.Element;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Atendimento",
    items: [
      { href: "/pacientes", label: "Pacientes", icon: IconUsers },
      { href: "/agenda", label: "Agenda", icon: IconCalendar },
      { href: "/locais", label: "Locais", icon: IconMapPin },
      { href: "/financeiro", label: "Financeiro", icon: IconWallet }
    ]
  },
  {
    label: "Meu conteúdo",
    items: [
      { href: "/conteudo/planos", label: "Planos alimentares", icon: IconClipboard },
      { href: "/conteudo/receitas", label: "Receitas", icon: IconBook },
      { href: "/conteudo/alimentos", label: "Alimentos", icon: IconApple },
      { href: "/conteudo/listas-substituicao", label: "Listas de substituição", icon: IconRepeat },
      { href: "/conteudo/questionarios", label: "Anamnese / Questionário", icon: IconFileText }
    ]
  },
  {
    label: "Outros cadastros",
    items: [
      { href: "/prescricoes", label: "Prescrições", icon: IconPill },
      { href: "/metas", label: "Metas", icon: IconTarget },
      { href: "/exames", label: "Exames", icon: IconFlask },
      { href: "/farmacias", label: "Farmácias", icon: IconStore },
      { href: "/tags", label: "Tags", icon: IconTag }
    ]
  },
  {
    label: "Organização",
    items: [
      { href: "/nutriplan", label: "NutriPlan", icon: IconCheckSquare },
      { href: "/equipe", label: "Equipe", icon: IconTeam },
      { href: "/configuracoes/pagina-publica", label: "Página pública", icon: IconGlobe },
      { href: "/configuracoes/consultorio", label: "Consultório", icon: IconStore }
    ]
  }
];

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  nutritionist: "Nutricionista",
  assistant: "Assistente"
};

export default function AppShell({
  professional,
  children
}: {
  professional: Professional;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    function handlePointer(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [userMenuOpen]);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  return (
    <div className="app-shell">
      {mobileOpen && <div className="app-shell-overlay" onClick={() => setMobileOpen(false)} />}

      <aside className={`app-sidebar${mobileOpen ? " open" : ""}`} aria-label="Navegação principal">
        <div className="app-sidebar-brand">
          <span>
            Nutri<span className="brand-accent">Hub</span>
          </span>
          <button
            type="button"
            className="btn-icon app-topbar-menu-btn"
            style={{ marginLeft: "auto", color: "white", borderColor: "rgba(255,255,255,.3)" }}
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          >
            <IconX />
          </button>
        </div>

        <nav className="app-sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="app-sidebar-group-label">{group.label}</div>
              {group.items.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`app-sidebar-link${isActive(item.href) ? " active" : ""}`}
                    aria-current={isActive(item.href) ? "page" : undefined}
                  >
                    <span className="icon">
                      <ItemIcon />
                    </span>
                    {item.label}
                  </a>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="app-sidebar-footer">
          <button
            type="button"
            onClick={handleLogout}
            style={{
              background: "transparent",
              color: "rgba(255,255,255,.78)",
              borderColor: "rgba(255,255,255,.25)",
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8
            }}
          >
            <IconLogOut />
            Sair
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <button
            type="button"
            className="btn-icon app-topbar-menu-btn"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <IconMenu />
          </button>

          <span />

          <div className="app-user-menu" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "none",
                border: "none",
                padding: "4px 6px"
              }}
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
            >
              <span className="avatar">{initials(professional.name)}</span>
              <span style={{ textAlign: "left" }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--color-text-primary)" }}>
                  {professional.name.split(" ")[0]}
                </span>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--color-text-muted)" }}>
                  {ROLE_LABEL[professional.role ?? "admin"] ?? professional.role}
                </span>
              </span>
            </button>

            {userMenuOpen && (
              <div
                role="menu"
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  background: "var(--color-surface-elevated)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-md)",
                  minWidth: 200,
                  padding: 8,
                  zIndex: 110
                }}
              >
                <div style={{ padding: "6px 10px 10px", borderBottom: "1px solid var(--color-border)", marginBottom: 6 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{professional.name}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{professional.email}</div>
                </div>
                <a href="/equipe" className="app-sidebar-link" style={{ color: "var(--color-text-primary)" }}>
                  <span className="icon">
                    <IconTeam />
                  </span>
                  Equipe
                </a>
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    width: "100%",
                    justifyContent: "flex-start",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "none",
                    border: "none",
                    padding: "9px 10px",
                    color: "var(--color-error)"
                  }}
                >
                  <IconLogOut />
                  Sair
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
