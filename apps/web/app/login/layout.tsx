import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Entrar — NutriHub",
  description: "Acesse o painel do NutriHub."
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
