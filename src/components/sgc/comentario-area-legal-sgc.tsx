import { comentarioDevolucionSgc } from "@/lib/shared/utils/sgc";

interface Props {
  /** `sgcDevolucionMotivo` de la solicitud (reason del webhook o detalle del historial SGC). */
  motivo: string | null | undefined;
  className?: string;
}

/** Comentario escrito por el revisor del SGC al devolver el trámite (no el texto automático). */
export function ComentarioAreaLegalSgc({ motivo, className }: Props) {
  const comentario = comentarioDevolucionSgc(motivo);
  if (!comentario) return null;
  return (
    <p className={`whitespace-pre-line rounded-md border border-warning/30 bg-background/60 px-2 py-1.5 text-[11px] leading-relaxed text-foreground ${className ?? ""}`}>
      <span className="font-semibold">Comentario del área legal: </span>
      {comentario}
    </p>
  );
}
