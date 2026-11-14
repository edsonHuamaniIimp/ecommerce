import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/server/auth";
import { PERMISSIONS } from "@/lib/shared/constants";
import "../manual.css";
import {
  MANUAL_SUBSANACION_ASOCIADO_HTML,
  MANUAL_SUBSANACION_ASOCIADO_TOC,
} from "../content-subsanacion-asociado";
import { ManualShell } from "../manual-shell";

export const metadata: Metadata = {
  title: "Manual de subsanación SGC para Asociados | IIMP",
  description:
    "Guía interna para Asociados y soporte: diagnóstico de observaciones, documentos, contrato, firma y reenvío al SGC.",
};

export default async function ManualSubsanacionAsociadoPage() {
  const session = await getSession();
  const puedeVer =
    session !== null &&
    (session.permissions.includes(PERMISSIONS.ADMIN_FULL) ||
      session.permissions.includes(PERMISSIONS.SOLICITUDES_VIEW) ||
      session.permissions.includes(PERMISSIONS.SOLICITUDES_GESTION) ||
      session.permissions.includes(PERMISSIONS.SOLICITUDES_REVIEW_ASOCIADO) ||
      session.permissions.includes(PERMISSIONS.SOLICITUDES_REVIEW_LEGAL) ||
      session.permissions.includes(PERMISSIONS.SOLICITUDES_UPLOAD));

  if (!puedeVer) notFound();

  return (
    <ManualShell
      guia="subsanacionAsociado"
      titulo="Manual de subsanación SGC para Asociados"
      subtitulo="Revisión, documentos y reenvío"
      descripcion="Guía interna para diagnosticar observaciones del SGC, corregir documentos, regenerar el contrato y reenviar el expediente con trazabilidad."
      version="1.0"
      audiencia="Asociados y soporte IIMP"
      actualizado="2026"
      metadatos={[
        { label: "Incluye", value: "Diagnóstico y reenvío" },
        { label: "Contrato", value: "Regeneración y firma" },
        { label: "Auditoría", value: "Obligatoria" },
      ]}
      toc={MANUAL_SUBSANACION_ASOCIADO_TOC}
      html={MANUAL_SUBSANACION_ASOCIADO_HTML}
    />
  );
}
