"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Professional {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role?: "admin" | "nutritionist" | "assistant";
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("nutrihub_token");
}

export function getStoredProfessional(): Professional | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("nutrihub_professional");
  return raw ? JSON.parse(raw) : null;
}

export function setSession(token: string, professional: Professional) {
  localStorage.setItem("nutrihub_token", token);
  localStorage.setItem("nutrihub_professional", JSON.stringify(professional));
}

export function clearSession() {
  localStorage.removeItem("nutrihub_token");
  localStorage.removeItem("nutrihub_professional");
}

export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return fetch(`${API_URL}${path}`, { ...init, headers });
}

/** Redireciona para /login se não houver sessão; devolve o profissional logado. */
export function useRequireAuth(): Professional | null {
  const router = useRouter();
  const [professional, setProfessional] = useState<Professional | null>(null);

  useEffect(() => {
    const token = getToken();
    const stored = getStoredProfessional();
    if (!token || !stored) {
      router.push("/login");
      return;
    }
    setProfessional(stored);
  }, [router]);

  return professional;
}
