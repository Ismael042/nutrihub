"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/auth";

export interface PatientSession {
  id: string;
  name: string;
  email: string;
}

interface PatientAuthResponse {
  access_token: string;
  patient: PatientSession;
}

export async function patientLogin(email: string, password: string): Promise<PatientAuthResponse> {
  const res = await fetch(`${API_URL}/patient-auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail ?? "Não foi possível entrar");
  }
  return data as PatientAuthResponse;
}

// Chaves próprias — não reaproveita nutrihub_token/nutrihub_professional, senão um
// profissional testando o próprio app do paciente no mesmo navegador sobrescreveria
// a sessão um do outro.
export function getPatientToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("nutrihub_patient_token");
}

export function getStoredPatient(): PatientSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("nutrihub_patient_session");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PatientSession;
  } catch {
    clearPatientSession();
    return null;
  }
}

export function setPatientSession(token: string, patient: PatientSession) {
  localStorage.setItem("nutrihub_patient_token", token);
  localStorage.setItem("nutrihub_patient_session", JSON.stringify(patient));
}

export function clearPatientSession() {
  localStorage.removeItem("nutrihub_patient_token");
  localStorage.removeItem("nutrihub_patient_session");
}

export async function patientFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getPatientToken();
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return fetch(`${API_URL}${path}`, { ...init, headers });
}

/** Redireciona para /portal/entrar se não houver sessão; devolve o paciente logado. */
export function useRequirePatientAuth(): PatientSession | null {
  const router = useRouter();
  const [patient, setPatient] = useState<PatientSession | null>(null);

  useEffect(() => {
    const token = getPatientToken();
    const stored = getStoredPatient();
    if (!token || !stored) {
      router.push("/portal/entrar");
      return;
    }
    setPatient(stored);
  }, [router]);

  return patient;
}
