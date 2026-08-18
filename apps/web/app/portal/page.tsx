"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getPatientToken } from "@/lib/patientAuth";

export default function PortalIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getPatientToken() ? "/portal/plano" : "/portal/entrar");
  }, [router]);

  return null;
}
