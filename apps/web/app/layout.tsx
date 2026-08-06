import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "NutriHub",
  description: "Painel de gestão para nutricionistas"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
