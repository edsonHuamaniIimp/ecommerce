import type { Metadata } from "next";
import "./manual.css";
import { MANUAL_HTML, MANUAL_TOC } from "./content";
import { ManualShell } from "./manual-shell";

export const metadata: Metadata = {
  title: "Manual del Exhibidor | IIMP",
  description:
    "Guía del Portal del Cliente para reservar stands, firmar el contrato, hacer seguimiento y gestionar pagos.",
};

export default function ManualPage() {
  return (
    <ManualShell
      guia="reservas"
      titulo="Manual del Exhibidor"
      subtitulo="Reserva de stands"
      descripcion="Guía práctica para reservar stands, firmar el contrato de exhibición, hacer seguimiento de tu solicitud y gestionar tus pagos en los eventos del IIMP."
      version="1.0"
      audiencia="Empresas exhibidoras"
      actualizado="2026"
      metadatos={[
        { label: "Incluye", value: "Plano, contrato y pagos" },
        { label: "Modalidad", value: "Portal del Cliente" },
        { label: "Idiomas", value: "ES / EN" },
      ]}
      toc={MANUAL_TOC}
      html={MANUAL_HTML}
    />
  );
}
