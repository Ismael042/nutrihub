"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

// Substitui window.confirm(...) por um modal na identidade visual do produto —
// mesmo contrato assíncrono (`if (!(await confirm("..."))) return;`), então a troca
// em cada página é mecânica, sem mudar a lógica de quando/por que confirmar.
export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(value: boolean) => void>();

  const confirmFn = useCallback<ConfirmFn>((opts) => {
    const normalized = typeof opts === "string" ? { title: opts } : opts;
    setOptions(normalized);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function handle(result: boolean) {
    setOptions(null);
    resolver.current?.(result);
  }

  return (
    <ConfirmContext.Provider value={confirmFn}>
      {children}
      {options && (
        <div className="modal-backdrop" onClick={() => handle(false)}>
          <div
            className="modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="confirm-dialog-title">{options.title}</h3>
            {options.description && <p style={{ color: "var(--color-text-secondary)" }}>{options.description}</p>}
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => handle(false)}>
                {options.cancelLabel ?? "Cancelar"}
              </button>
              <button
                type="button"
                autoFocus
                className={options.danger ? "btn-danger btn-danger-solid" : "btn-primary"}
                onClick={() => handle(true)}
              >
                {options.confirmLabel ?? "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm precisa estar dentro de <ConfirmDialogProvider>");
  }
  return ctx;
}
