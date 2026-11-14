import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/server/auth";
import { PERMISSIONS } from "@/lib/shared/constants";
import "../manual.css";
import { MANUAL_SUBSANACION_HTML, MANUAL_SUBSANACION_TOC } from "../content-subsanacion";
import { ManualShell } from "../manual-shell";

export const metadata: Metadata = {
  title: "Manual de subsanación SGC | IIMP",
  description:
    "Guía para corregir observaciones del SGC, subir versiones o archivos nuevos, firmar el contrato y solicitar una nueva revisión.",
};

export default async function ManualSubsanacionPage() {
  const session = await getSession();
  const puedeVer =
    session !== null &&
    (session.permissions.includes(PERMISSIONS.ADMIN_FULL) ||
      session.permissions.includes(PERMISSIONS.MIS_RESERVAS_VIEW) ||
      session.permissions.includes(PERMISSIONS.WRITE_RESERVAS));

  if (!puedeVer) notFound();

  return (
    <ManualShell
      guia="subsanacion"
      titulo="Manual de subsanación SGC"
      subtitulo="Observaciones, documentos y firma"
      descripcion="Guía práctica para corregir observaciones del SGC, distinguir una versión corregida de un archivo nuevo, firmar el contrato y solicitar una nueva revisión."
      version="1.0"
      audiencia="Exhibidores y soporte IIMP"
      actualizado="2026"
      metadatos={[
        { label: "Incluye", value: "Documentos y contrato" },
        { label: "Casos", value: "Individuales y agrupados" },
        { label: "Firma", value: "Cursor y sello" },
      ]}
      toc={MANUAL_SUBSANACION_TOC}
      html={MANUAL_SUBSANACION_HTML}
    />
  );
}
