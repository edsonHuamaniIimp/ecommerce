"use client";

import { useState } from "react";
import { Button, Checkbox, Textarea } from "@nrivera-iimp/ui-kit-iimp";
import { AlertTriangle, Loader2, ScanText, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ddMatrizEvaluacionService } from "@/lib/client/api/services/dd-matriz-evaluacion-service";
import {
  DD_ASISTENTE,
  DD_ASISTENTE_MENSAJES,
  DD_ASISTENTE_METODO_TEXTO_LABELS,
  DD_ASISTENTE_MODO_AYUDAS,
  DD_ASISTENTE_MODO_LABELS,
  DD_ASISTENTE_MODOS,
  DD_ASISTENTE_SUGERENCIAS,
  type DdAsistenteModo,
} from "@/lib/shared/constants";
import type { DdMatrizAdjuntoDTO, DdMatrizAsistenteResponseDTO } from "@/types/dto/debida-diligencia";

interface Props {
  vinculoId: string;
  codigo: string;
  evidencias: DdMatrizAdjuntoDTO[];
  disabled?: boolean;
  /** Texto generado: el padre lo agrega a la observacion del criterio (no se guarda solo). */
  onTexto: (texto: string) => void;
}

const MODOS: { modo: DdAsistenteModo; icono: typeof Sparkles }[] = [
  { modo: DD_ASISTENTE_MODOS.IA, icono: Sparkles },
  { modo: DD_ASISTENTE_MODOS.OCR, icono: ScanText },
];

/** Detalle de como se leyo cada evidencia (OCR, texto del PDF o archivo completo). */
function lecturaEvidencias(resultado: DdMatrizAsistenteResponseDTO): string {
  return resultado.evidencias
    .map((evidencia) => {
      if (!evidencia.metodo) return `${evidencia.nombre}: archivo completo`;
      const paginas = evidencia.paginas ? `, ${evidencia.paginas} pág.` : "";
      return `${evidencia.nombre}: ${DD_ASISTENTE_METODO_TEXTO_LABELS[evidencia.metodo]}${paginas}`;
    })
    .join(" · ");
}

/**
 * Asistente de la observacion del criterio (OEFA, OSCE, INDECOPI, lavado/corrupcion y Otros):
 * el usuario escribe una indicacion y la IA responde sobre la evidencia del criterio,
 * leyendo el archivo completo (IA) o solo el texto extraido en el servidor (OCR + prompt).
 */
export function DdMatrizAsistenteCriterio({ vinculoId, codigo, evidencias, disabled = false, onTexto }: Props) {
  const [modo, setModo] = useState<DdAsistenteModo | null>(null);
  const [seleccion, setSeleccion] = useState<string[]>(() =>
    evidencias.slice(0, DD_ASISTENTE.ARCHIVOS_MAX).map((evidencia) => evidencia.id),
  );
  const [prompt, setPrompt] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<DdMatrizAsistenteResponseDTO | null>(null);

  /* Solo cuentan las evidencias que siguen en el criterio (una pudo eliminarse). */
  const elegidas = seleccion.filter((id) => evidencias.some((evidencia) => evidencia.id === id));
  const puedeEnviar =
    !disabled && !enviando && elegidas.length > 0 && prompt.trim().length >= DD_ASISTENTE.PROMPT_MIN;

  const alternar = (id: string, marcado: boolean) => {
    setSeleccion((previa) => {
      if (!marcado) return previa.filter((valor) => valor !== id);
      if (previa.length >= DD_ASISTENTE.ARCHIVOS_MAX) {
        toast.error(`Elige hasta ${DD_ASISTENTE.ARCHIVOS_MAX} evidencias.`);
        return previa;
      }
      return [...previa, id];
    });
  };

  const enviar = async () => {
    if (!modo || !puedeEnviar) return;
    setEnviando(true);
    setResultado(null);
    try {
      const respuesta = await ddMatrizEvaluacionService.asistente({
        vinculoId,
        codigo,
        modo,
        prompt: prompt.trim(),
        adjuntoIds: elegidas,
      });
      onTexto(respuesta.texto);
      setResultado(respuesta);
      toast.success(DD_ASISTENTE_MENSAJES.REVISAR);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : DD_ASISTENTE_MENSAJES.SIN_RESPUESTA);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-dashed border-primary/30 bg-primary/5 p-2">
      <div className="flex flex-wrap gap-1.5">
        {MODOS.map(({ modo: opcion, icono: Icono }) => (
          <Button
            key={opcion}
            type="button"
            size="sm"
            variant={modo === opcion ? "default" : "outline"}
            className="h-7 gap-1.5 text-[11px]"
            disabled={disabled || enviando}
            aria-pressed={modo === opcion}
            onClick={() => {
              setModo((actual) => (actual === opcion ? null : opcion));
              setResultado(null);
            }}
          >
            <Icono className="h-3 w-3" />
            <span>{DD_ASISTENTE_MODO_LABELS[opcion]}</span>
          </Button>
        ))}
      </div>

      {modo ? (
        <div className="space-y-2">
          <p className="text-[10px] leading-snug text-muted-foreground">{DD_ASISTENTE_MODO_AYUDAS[modo]}</p>

          {evidencias.length === 0 ? (
            <p className="flex items-start gap-1.5 text-[11px] text-warning">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{DD_ASISTENTE_MENSAJES.SIN_EVIDENCIA}</span>
            </p>
          ) : (
            <>
              <fieldset className="space-y-1" disabled={enviando}>
                <legend className="text-[10px] font-semibold uppercase text-muted-foreground">Evidencias</legend>
                {evidencias.map((evidencia) => (
                  <label key={evidencia.id} className="flex cursor-pointer items-center gap-2 text-[11px]">
                    <Checkbox
                      checked={elegidas.includes(evidencia.id)}
                      onCheckedChange={(valor) => alternar(evidencia.id, valor === true)}
                      aria-label={`Usar ${evidencia.nombre}`}
                    />
                    <span className="min-w-0 truncate" title={evidencia.nombre}>{evidencia.nombre}</span>
                  </label>
                ))}
              </fieldset>

              <div className="flex flex-wrap gap-1">
                {DD_ASISTENTE_SUGERENCIAS.map((sugerencia) => (
                  <button
                    key={sugerencia}
                    type="button"
                    disabled={enviando}
                    onClick={() => setPrompt(sugerencia)}
                    className="rounded-full border border-border bg-card px-2 py-0.5 text-left text-[10px] text-muted-foreground hover:bg-secondary disabled:opacity-50"
                  >
                    {sugerencia}
                  </button>
                ))}
              </div>

              <Textarea
                value={prompt}
                onChange={(evento) => setPrompt(evento.target.value.slice(0, DD_ASISTENTE.PROMPT_MAX))}
                onKeyDown={(evento) => {
                  if (evento.key === "Enter" && (evento.ctrlKey || evento.metaKey)) {
                    evento.preventDefault();
                    void enviar();
                  }
                }}
                maxLength={DD_ASISTENTE.PROMPT_MAX}
                disabled={enviando}
                placeholder="Ej.: Lee el documento y dame un resumen."
                aria-label="Indicación para el asistente"
                className="min-h-16 bg-card text-xs"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground">
                  {prompt.length}/{DD_ASISTENTE.PROMPT_MAX}
                </span>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 gap-1.5 text-[11px]"
                  disabled={!puedeEnviar}
                  onClick={() => { void enviar(); }}
                >
                  {enviando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  <span>{enviando ? "Procesando..." : "Enviar"}</span>
                </Button>
              </div>

              {enviando ? (
                <p className="text-[10px] text-muted-foreground" aria-live="polite">
                  {modo === DD_ASISTENTE_MODOS.OCR
                    ? "Extrayendo el texto con OCR y consultando a la IA. Puede tardar hasta un minuto."
                    : "La IA está leyendo la evidencia. Puede tardar hasta un minuto."}
                </p>
              ) : null}

              {resultado ? (
                <div className="space-y-0.5 text-[10px] text-muted-foreground" aria-live="polite">
                  <p>{lecturaEvidencias(resultado)}</p>
                  {resultado.textoTruncado ? (
                    <p className="text-warning">El texto extraído era muy largo: la IA solo leyó la primera parte.</p>
                  ) : null}
                  {resultado.recortado ? (
                    <p className="text-warning">La respuesta superó el límite de la observación y se recortó.</p>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
