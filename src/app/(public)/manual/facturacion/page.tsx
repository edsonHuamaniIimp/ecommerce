import type { Metadata } from "next";
import "../manual.css";
import { MANUAL_FACTURACION_HTML, MANUAL_FACTURACION_TOC } from "../content-facturacion";
import { ManualShell } from "../manual-shell";

export const metadata: Metadata = {
  title: "Manual de Facturación | IIMP",
  description:
    "Guía para empresas exhibidoras: requisitos de facturación, solicitud de factura, documentos por cuota y descarga de facturas.",
};

export default function ManualFacturacionPage() {
  return (
    <ManualShell
      guia="facturacion"
      titulo="Manual de Facturación"
      subtitulo="Solicitud de factura y documentos"
      descripcion="Guía para declarar los requisitos de facturación de tu empresa, enviar la solicitud de factura, adjuntar documentos por cuota y descargar tus facturas."
      version="1.0"
      audiencia="Empresas exhibidoras"
      actualizado="2026"
      metadatos={[
        { label: "Incluye", value: "Requisitos y facturas" },
        { label: "Documentos", value: "Por cuota" },
        { label: "Idiomas", value: "ES / EN" },
      ]}
      toc={MANUAL_FACTURACION_TOC}
      html={MANUAL_FACTURACION_HTML}
    />
  );
}
