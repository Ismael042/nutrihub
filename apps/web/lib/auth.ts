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
  cpf?: string | null;
  email_verified?: boolean;
  google_id?: string | null;
}

interface AuthResponse {
  access_token: string;
  professional: Professional;
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = res.status === 204 ? {} : await res.json();
  if (!res.ok) {
    throw new Error(data.detail ?? "Erro inesperado");
  }
  return data as T;
}

export function signup(input: { name: string; email: string; password: string; cpf: string }) {
  return postJSON<{ professional_id: string; email: string }>("/auth/signup", input);
}

export function verifyEmailCode(input: { professional_id: string; code: string }) {
  return postJSON<AuthResponse>("/auth/verify-email", input);
}

export function resendCode(input: { professional_id: string }) {
  return postJSON<Record<string, never>>("/auth/resend-code", input);
}

export function signInWithGoogle(input: { id_token: string; cpf?: string }) {
  return postJSON<AuthResponse>("/auth/google", input);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("nutrihub_token");
}

export function getStoredProfessional(): Professional | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("nutrihub_professional");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Professional;
  } catch {
    // Sessão local corrompida (ex: extensão de terceiros mexeu no storage, formato antigo) —
    // trata como sessão inválida em vez de derrubar a página com exceção não tratada.
    clearSession();
    return null;
  }
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
  // FormData: o boundary do multipart só existe no Content-Type que o browser monta
  // sozinho. Forçar application/json aqui faria o FastAPI recusar todo upload.
  if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
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
