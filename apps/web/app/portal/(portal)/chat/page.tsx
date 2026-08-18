"use client";

import { patientFetch } from "@/lib/patientAuth";
import ChatThread from "@/components/ChatThread";

export default function PatientChatPage() {
  return (
    <div className="page-container">
      <h1>Chat com seu nutricionista</h1>

      <div style={{ marginTop: 12 }}>
        <ChatThread endpoint="/patient-portal/chat" mySender="patient" fetchFn={patientFetch} />
      </div>
    </div>
  );
}
