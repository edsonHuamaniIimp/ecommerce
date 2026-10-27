import type { Metadata } from "next";
import "../manual.css";
import { MANUAL_DD_HTML, MANUAL_DD_TOC } from "../content-dd";
import { ManualShell } from "../manual-shell";

export const metadata: Metadata = {
  title: "Manual de Debida Diligencia | IIMP",
  description:
    "Guía para empresas exhibidoras: formulario, documentos, vigencia y revalidación de la Debida Diligencia.",
};

export default function ManualDebidaDiligenciaPage() {
  return (
    <ManualShell
      guia="dd"
      titulo="Manual de Debida Diligencia"
      subtitulo="Cumplimiento y prevención LA/FT"
      descripcion="Guía para completar el formulario de Debida Diligencia, cargar tus documentos, consultar la vigencia y regularizar una evaluación de otro evento."
      version="1.0"
      audiencia="Empresas exhibidoras"
      actualizado="2026"
      metadatos={[
        { label: "Vigencia", value: "6 meses" },
        { label: "Incluye", value: "Formulario y vigencia" },
        { label: "Idiomas", value: "ES / EN" },
      ]}
      toc={MANUAL_DD_TOC}
      html={MANUAL_DD_HTML}
    />
  );
}
