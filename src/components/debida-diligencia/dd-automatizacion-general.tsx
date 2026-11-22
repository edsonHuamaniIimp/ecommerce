"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Progress,
} from "@nrivera-iimp/ui-kit-iimp";
import { AlertCircle, BellRing, CheckCircle2, Clock3, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useDdAutomatizacionEvents } from "@/hooks/use-dd-automatizacion-events";
import { ddMatrizEvaluacionService } from "@/lib/client/api/services/dd-matriz-evaluacion-service";
import {
  DD_AUTOMATIZACION_ESTADOS,
  DD_AUTOMATIZACION_POLL_MS,
} from "@/lib/shared/constants";
import type { DdMatrizAutomatizacionDTO } from "@/types/dto/debida-diligencia";

interface Props {
  vinculoId: string;
  /** Se invoca al terminar para que la pantalla recargue las evidencias del vinculo. */
  onTerminada: () => void;
}

/**
 * Boton "Automatizar todo": lanza en segundo plano la automatizacion de las evidencias de
 * todos los criterios del vinculo. Un modal informa el avance y permite cerrarlo para que
 * el sistema avise (toast + push) cuando termine.
 */
export function DdAutomatizacionGeneral({ vinculoId, onTerminada }: Props) {
  const [job, setJob] = useState<DdMatrizAutomatizacionDTO | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const avisadoRef = useRef<string | null>(null);
  const onTerminadaRef = useRef(onTerminada);

  useEffect(() => {
    onTerminadaRef.current = onTerminada;
  }, [onTerminada]);

  const enCurso = job?.estado === DD_AUTOMATIZACION_ESTADOS.EN_CURSO;

  /** Cierra el ciclo una sola vez por job (llega por Pusher y/o por polling). */
  const finalizar = useCallback((final: DdMatrizAutomatizacionDTO) => {
    if (final.estado === DD_AUTOMATIZACION_ESTADOS.EN_CURSO) return;
    if (avisadoRef.current === final.jobId) return;
    avisadoRef.current = final.jobId;
    setJob(final);
    onTerminadaRef.current();
    const errores = final.criterios.filter((criterio) => criterio.estado === "error").length;
    const mensaje =
      errores === 0
        ? `Evidencias de ${final.vinculoNombre} listas (${final.total}).`
        : `Automatización de ${final.vinculoNombre} terminada: ${final.total - errores} de ${final.total} evidencias.`;
    if (errores === 0) toast.success(mensaje);
    else toast.warning(mensaje);
  }, []);

  useDdAutomatizacionEvents(job?.canal ?? null, (final) => {
    if (final.jobId === job?.jobId) finalizar(final);
  });

  /* Respaldo sin Pusher: consulta el avance mientras haya un job en curso. */
  useEffect(() => {
    if (!job || !enCurso) return;
    const jobId = job.jobId;
    let activo = true;
    const intervalo = window.setInterval(() => {
      ddMatrizEvaluacionService
        .estadoAutomatizacion(jobId)
        .then((actual) => {
          if (!activo) return;
          if (actual.estado === DD_AUTOMATIZACION_ESTADOS.EN_CURSO) setJob(actual);
          else finalizar(actual);
        })
        .catch(() => {
          /* El proceso ya no conoce el job (reinicio / otra tarea): se recargan las evidencias. */
          if (!activo) return;
          window.clearInterval(intervalo);
          setJob(null);
          setAbierto(false);
          onTerminadaRef.current();
          toast.info("La automatización terminó. Revisa las evidencias del vínculo.");
        });
    }, DD_AUTOMATIZACION_POLL_MS);
    return () => {
      activo = false;
      window.clearInterval(intervalo);
    };
  }, [job, enCurso, finalizar]);

  const iniciar = async () => {
    if (enCurso) {
      setAbierto(true);
      return;
    }
    setIniciando(true);
    try {
      const nuevo = await ddMatrizEvaluacionService.automatizarTodo(vinculoId);
      avisadoRef.current = null;
      setJob(nuevo);
      setAbierto(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo iniciar la automatización");
    } finally {
      setIniciando(false);
    }
  };

  const cerrarYAvisar = () => {
    setAbierto(false);
    toast.info("Te avisaremos cuando las evidencias estén listas.");
  };

  const procesados = job?.procesados ?? 0;
  const total = job?.total ?? 0;
  const errores = job?.criterios.filter((criterio) => criterio.estado === "error").length ?? 0;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={iniciando}
        onClick={() => { void iniciar(); }}
        className="h-8 gap-1.5 text-xs"
        title="Automatiza las evidencias de todos los criterios de este vínculo"
      >
        {iniciando || enCurso ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        <span>{enCurso ? `Automatizando ${procesados}/${total}` : "Automatizar todo"}</span>
      </Button>

      <Dialog open={abierto} onOpenChange={(valor) => { if (!valor) { if (enCurso) cerrarYAvisar(); else setAbierto(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {enCurso ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : errores > 0 ? (
                <AlertCircle className="h-4 w-4 text-warning" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-success" />
              )}
              <span>{enCurso ? "Automatizando evidencias del vínculo" : "Automatización finalizada"}</span>
            </DialogTitle>
          </DialogHeader>

          {job ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {enCurso
                  ? `Estamos buscando y adjuntando la evidencia de todos los criterios de ${job.vinculoNombre}. Puede tardar unos minutos; puedes cerrar esta ventana y seguir trabajando.`
                  : errores === 0
                    ? `Se adjuntaron las ${job.total} evidencias de ${job.vinculoNombre}.`
                    : `Se adjuntaron ${job.total - errores} de ${job.total} evidencias. Los criterios con error puedes reintentarlos uno por uno.`}
              </p>
              <div className="space-y-1">
                <Progress value={total > 0 ? (procesados / total) * 100 : 0} className="h-2" />
                <p className="text-[11px] text-muted-foreground">
                  {procesados} de {total} criterios procesados
                </p>
              </div>
              <ul className="max-h-60 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {job.criterios.map((criterio, indice) => {
                  const actual = enCurso && criterio.estado === "pendiente" && indice === procesados;
                  return (
                    <li key={criterio.codigo} className="flex items-start gap-2 text-[11px]">
                      <span className="mt-0.5 shrink-0">
                        {criterio.estado === "ok" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        ) : criterio.estado === "error" ? (
                          <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                        ) : actual ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        ) : (
                          <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-foreground">{criterio.label}</span>
                        {criterio.mensaje ? (
                          <span className="block text-[10px] text-destructive">{criterio.mensaje}</span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-2">
            {enCurso ? (
              <Button type="button" size="sm" className="gap-1.5 text-xs" onClick={cerrarYAvisar}>
                <BellRing className="h-3.5 w-3.5" />
                <span>Avisarme cuando esté listo</span>
              </Button>
            ) : (
              <Button type="button" size="sm" className="text-xs" onClick={() => setAbierto(false)}>
                <span>Cerrar</span>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
