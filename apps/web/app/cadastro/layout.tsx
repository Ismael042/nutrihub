import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Criar conta — NutriHub",
  description: "Cadastre seu consultório no NutriHub."
};

export default function CadastroLayout({ children }: { children: React.ReactNode }) {
  return children;
}
