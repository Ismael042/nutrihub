import type { ReactNode } from "react";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { ConfirmDialogProvider } from "@/components/ConfirmDialog";

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://nutrihub.isdev.online"),
  title: {
    default: "NutriHub",
    template: "%s"
  },
  description: "Painel de gestão para nutricionistas"
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
