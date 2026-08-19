"use client";

import { patientFetch } from "@/lib/patientAuth";
import ChatThread from "@/components/ChatThread";

export default function PatientChatPage() {
  return (
    <div className="page-container page-container-fill">
      <h1>Chat com seu nutricionista</h1>
      <ChatThread endpoint="/patient-portal/chat" mySender="patient" fetchFn={patientFetch} fill />
    </div>
  );
}
