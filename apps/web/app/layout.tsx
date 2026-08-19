import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { ConfirmDialogProvider } from "@/components/ConfirmDialog";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://nutrihub.isdev.online"),
  title: {
    default: "NutriHub",
    template: "%s"
  },
  description: "Painel de gestão para nutricionistas"
};

// viewportFit:"cover" é o que faz env(safe-area-inset-*) resolver de verdade no iOS
// Safari — sem isso a tab bar do app do paciente (PatientShell) fica com o padding
// de safe-area zerado, mesmo o código já estando lá.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <ToastProvider>
          <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
