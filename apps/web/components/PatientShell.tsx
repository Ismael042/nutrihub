"use client";

import { usePathname, useRouter } from "next/navigation";
import { clearPatientSession, type PatientSession } from "@/lib/patientAuth";
import { IconBook, IconChat, IconClipboard, IconLogOut, IconUsers } from "./icons";

const TABS = [
  { href: "/portal/plano", label: "Plano", icon: IconClipboard },
  { href: "/portal/diario", label: "Diário", icon: IconBook },
  { href: "/portal/chat", label: "Chat", icon: IconChat },
  { href: "/portal/mais", label: "Mais", icon: IconUsers }
];

export default function PatientShell({
  patient,
  children
}: {
  patient: PatientSession;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  function handleLogout() {
    clearPatientSession();
    router.push("/portal/entrar");
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header className="app-topbar">
        <span style={{ fontWeight: 700, fontSize: 16 }}>
          Nutri<span style={{ color: "var(--color-primary)" }}>Hub</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-text-primary)" }}>
            {patient.name.split(" ")[0]}
          </span>
          <button
            type="button"
            className="btn-icon"
            onClick={handleLogout}
            aria-label="Sair"
            title="Sair"
          >
            <IconLogOut />
          </button>
        </div>
      </header>

      {/* padding-bottom extra só aqui via style — não mexe na regra .app-content
          compartilhada com o painel do profissional, que não tem barra fixa embaixo. */}
      <main className="app-content" style={{ paddingBottom: "calc(var(--space-6) + 64px)" }}>
        {children}
      </main>

      <nav className="patient-tabbar" aria-label="Navegação do app">
        {TABS.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <a
              key={tab.href}
              href={tab.href}
              className={`patient-tab${isActive(tab.href) ? " active" : ""}`}
              aria-current={isActive(tab.href) ? "page" : undefined}
            >
              <TabIcon />
              {tab.label}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
