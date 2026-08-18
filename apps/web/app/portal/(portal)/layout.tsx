"use client";

import { useRequirePatientAuth } from "@/lib/patientAuth";
import PatientShell from "@/components/PatientShell";

// Grupo de rota (portal) — mesmo padrão de apps/web/app/(app)/layout.tsx: envolve
// as páginas autenticadas com o shell persistente, sem mudar a URL. /portal/entrar
// fica fora deste grupo de propósito (não precisa do shell, o paciente ainda não
// está logado ali).
export default function PatientAuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const patient = useRequirePatientAuth();

  if (!patient) return null;

  return <PatientShell patient={patient}>{children}</PatientShell>;
}
