"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { authFetch, useRequireAuth } from "@/lib/auth";
import ChatThread from "@/components/ChatThread";
import type { Patient } from "@nutrihub/shared";

export default function ChatPacientePage() {
  const professional = useRequireAuth();
  const params = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);

  useEffect(() => {
    if (!professional) return;
    authFetch(`/patients/${params.id}`).then(async (res) => {
      if (res.ok) setPatient(await res.json());
    });
  }, [professional, params.id]);

  if (!professional) return null;

  return (
    <div className="page-container">
      <a href={`/pacientes/${params.id}`} className="back-link">← {patient?.name ?? "Paciente"}</a>
      <h1>Chat</h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginBottom: 12 }}>
        Requer que o paciente tenha acesso ao app habilitado (ver perfil do paciente).
      </p>

      <ChatThread
        endpoint={`/patients/${params.id}/chat`}
        mySender="professional"
        fetchFn={authFetch}
        resetKey={params.id}
      />
    </div>
  );
}
