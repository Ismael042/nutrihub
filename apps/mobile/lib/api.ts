import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

// Em dev físico (Expo Go num celular), localhost aponta pro próprio celular, não pro
// computador rodando a API — por isso o fallback tenta o host do Metro bundler
// primeiro. Ainda assim, o caminho recomendado é setar EXPO_PUBLIC_API_URL no ambiente
// (ver README) apontando pro IP da máquina rodando `docker compose`.
function resolveDefaultApiUrl(): string {
  const hostUri = (Constants.expoConfig as { hostUri?: string } | undefined)?.hostUri;
  if (hostUri) {
    const host = hostUri.split(":")[0];
    return `http://${host}:8000`;
  }
  return "http://localhost:8000";
}

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? resolveDefaultApiUrl();

const TOKEN_KEY = "nutrihub_patient_token";
const PATIENT_KEY = "nutrihub_patient_profile";

export interface PatientSession {
  id: string;
  name: string;
  email: string;
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getStoredPatient(): Promise<PatientSession | null> {
  const raw = await AsyncStorage.getItem(PATIENT_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function setSession(token: string, patient: PatientSession): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
  await AsyncStorage.setItem(PATIENT_KEY, JSON.stringify(patient));
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(PATIENT_KEY);
}

export async function patientFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

export async function login(email: string, password: string): Promise<PatientSession> {
  const res = await fetch(`${API_URL}/patient-auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail ?? "E-mail ou senha inválidos");
  }
  const data = await res.json();
  await setSession(data.access_token, data.patient);
  return data.patient;
}
