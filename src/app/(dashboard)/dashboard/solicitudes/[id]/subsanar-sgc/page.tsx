"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Clock, FileText, Loader2, ShieldAlert } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@nrivera-iimp/ui-kit-iimp";
import { SgcDocumentoUpload } from "@/components/sgc/sgc-documento-upload";
import { SgcExpedientePanel } from "@/components/sgc/sgc-expediente-panel";
import { useSesion } from "@/hooks/use-sesion";
import { solicitudesService } from "@/lib/client/api/services/solicitudes-service";
import {
  BADGE_STYLES,
  ESTADOS_PAGO_SOLICITUD,
  PERMISSIONS,
  SGC_LIFECYCLE_STATUSES,
  SGC_SUBSANACION_MODOS,
  TIPOS_DOCUMENTO_SOLICITUD,
  TIPOS_SOLICITUD,
} from "@/lib/shared/constants";
import { anexosBloqueantesFaltantes, modoSubsanacionEfectivo } from "@/lib/shared/utils/solicitud-documentos";
import type { SolicitudDTO } from "@/types/dto/solicitudes/solicitudes-response.dto";

/**
 * Ruta alterna para una reserva de pabellón internacional observada por el SGC.
 * No cambia `estado` ni `estadoPago`: solo permite ver la observación, corregir
 * el contrato y reenviar la ronda al SGC.
 */
export default function SubsanarSgcPage() {
  const params = useParams<{ id: string }>();
  const solicitudId = params.id;
  const { session, cargando: cargandoSesion } = useSesion();
  const [row, setRow] = useState<SolicitudDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      setRow(await solicitudesService.detalle(solicitudId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la solicitud");
    } finally {
      setLoading(false);
    }
  }, [solicitudId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void cargar(); }, 0);
    return () => window.clearTimeout(timer);
  }, [cargar]);

  if (cargandoSesion || loading) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  const puedeSubsanar =
    session?.permissions?.includes(PERMISSIONS.ADMIN_FULL) ||
    session?.permissions?.includes(PERMISSIONS.SOLICITUDES_REVIEW_ASOCIADO);

  if (!puedeSubsanar) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">No tienes permisos para subsanar esta solicitud.</p>
      </main>
    );
  }

  if (error || !row) {
    return (
      <main className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <p className="text-sm text-destructive">{error ?? "Solicitud no encontrada"}</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/solicitudes">Volver a solicitudes</Link>
        </Button>
      </main>
    );
  }

  if (row.tipo !== TIPOS_SOLICITUD.RESERVA_EMPRESA) {
    return (
      <main className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">Esta ruta solo aplica a reservas de pabellón internacional.</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/solicitudes">Volver a solicitudes</Link>
        </Button>
      </main>
    );
  }

  const observado =
    row.sgcLifecycleStatus === SGC_LIFECYCLE_STATUSES.OBSERVED ||
    row.sgcLifecycleStatus === SGC_LIFECYCLE_STATUSES.REJECTED;
  const contratosAdmin = row.docsAdjuntos
    .filter((doc) => doc.userId === null && doc.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO)
    .map((doc) => ({ nombre: doc.nombre, url: doc.url }));
  const firmados = row.docsAdjuntos
    .filter((doc) => doc.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO)
    .map((doc) => ({ nombre: doc.nombre, url: doc.url }));
  const anexos = row.docsAdjuntos.some(
    (doc) => doc.userId !== null && doc.categoria !== TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <Link href="/dashboard/solicitudes">
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Subsanar contrato SGC</h1>
            <p className="text-xs text-muted-foreground">
              {row.empresa ?? "Empresa"} · {row.standCode}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.INDIGO}`}>
            <Clock className="mr-1 h-3 w-3" />
            {row.estadoPago === ESTADOS_PAGO_SOLICITUD.PAGADO ? "Pagado" : "Pendiente Pago · Pabellón Internacional"}
          </Badge>
          {observado && (
            <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.WARNING}`}>
              <ShieldAlert className="mr-1 h-3 w-3" />
              SGC {row.sgcLifecycleStatus}
            </Badge>
          )}
        </div>
      </div>

      {!observado ? (
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">
              Esta solicitud no tiene una observación abierta del SGC. La subsanación se habilita cuando el SGC
              devuelve el trámite.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4" />
                Expediente y corrección
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SgcExpedientePanel
                solicitudId={row.id}
                tieneContratoAdmin={contratosAdmin.length > 0}
                tieneContratoFirmado={firmados.length > 0}
                tieneAnexos={anexos}
                requisitosFaltantes={anexosBloqueantesFaltantes(row.docsAdjuntos)}
                motivo={row.sgcSubsanacionMotivo ?? row.sgcDevolucionMotivo ?? null}
                modo={modoSubsanacionEfectivo(row) ?? SGC_SUBSANACION_MODOS.NUEVO_CONTRATO}
                onSolicitudChanged={cargar}
              />

              <div className="border-t border-border pt-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Contrato para corregir
                </p>
                <SgcDocumentoUpload
                  solicitudId={row.id}
                  tipo={TIPOS_DOCUMENTO_SOLICITUD.CONTRATO}
                  titulo="Contrato corregido (v1)"
                  hint={["Sube la versión corregida del contrato del administrador."]}
                  archivos={contratosAdmin}
                  ctaVacio="Subir contrato corregido"
                  ctaConArchivos="Reemplazar contrato corregido"
                  vacioTexto="Aún no hay contrato corregido adjunto."
                  varios={false}
                  subirContratoAsociado
                  onAttached={cargar}
                />
                <SgcDocumentoUpload
                  solicitudId={row.id}
                  tipo={TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO}
                  titulo="Contrato firmado"
                  hint={["PDF firmado por el cliente o registrado por el Asociado."]}
                  archivos={firmados}
                  ctaVacio="Subir contrato firmado"
                  ctaConArchivos="Reemplazar contrato firmado"
                  vacioTexto="Aún no hay contrato firmado vigente."
                  varios={false}
                  subirFirmaAsociado
                  onAttached={cargar}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Observación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <p className="text-muted-foreground">
                Corrige el documento, firma la versión vigente y reenvía la ronda. El estado de pago no cambia en
                este proceso.
              </p>
              <div className="rounded-md border border-border bg-secondary/40 p-2.5">
                <p className="font-semibold text-foreground">Motivo</p>
                <p className="mt-1 text-muted-foreground">
                  {row.sgcSubsanacionMotivo ?? row.sgcDevolucionMotivo ?? "Sin motivo registrado."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
