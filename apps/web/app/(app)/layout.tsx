"use client";

import { useRequireAuth } from "@/lib/auth";
import AppShell from "@/components/AppShell";

// Grupo de rota (app) — envolve toda página autenticada com sidebar + topbar
// persistentes (ver components/AppShell.tsx), sem mudar nenhuma URL (route groups
// do Next.js não entram no path). Cada página continua chamando useRequireAuth()
// e tratando professional===null por conta própria — isso aqui só cuida do chrome
// ao redor, não substitui a checagem de auth de cada página.
export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const professional = useRequireAuth();

  if (!professional) return null;

  return <AppShell professional={professional}>{children}</AppShell>;
}
