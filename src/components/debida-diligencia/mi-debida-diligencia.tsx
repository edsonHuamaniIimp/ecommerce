"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Progress,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nrivera-iimp/ui-kit-iimp";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  History,
  Map,
  Mail,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { PaginaDashboard } from "@/components/dashboard/pagina-dashboard";
import { DdEstadoBadge, DdDocumentoBadge, DdVigenciaBadge } from "./dd-estado-badge";
import { DdDocumentoPreviewDialog } from "./dd-documento-preview-dialog";
import { DdHistorialDialog } from "./dd-historial-dialog";
import { useSesion } from "@/hooks/use-sesion";
import { debidaDiligenciaService } from "@/lib/client/api/services/debida-diligencia-service";
import { dateUtils } from "@/lib/shared/utils/date";
import { ddUtils } from "@/lib/shared/utils/debida-diligencia";
import {
  DD_DOCUMENTOS_REQUERIDOS,
  DD_ESTADOS,
  DD_OBSERVACION_AREA_LABELS,
  DD_DOCUMENTO_ESTADOS,
  DD_OBSERVACION_ESTADOS,
  DD_RUTAS,
  DD_VIGENCIA_MESES,
} from "@/lib/shared/constants";
import type { DdMiExpedienteDTO } from "@/types/dto/debida-diligencia";

interface Hito {
  titulo: string;
  fecha: string | null;
  estado: "completado" | "activo" | "pendiente" | "alerta";
  detalle: string;
}

/** Vista "Mi debida diligencia" del Portal del Expositor. */
export function MiDebidaDiligencia() {
  const { session, cargando } = useSesion();
  const eventoId = session?.eventoId ?? "";
  const [data, setData] = useState<DdMiExpedienteDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [documentosOpen, setDocumentosOpen] = useState(false);
  const [previewDocumento, setPreviewDocumento] = useState<{ url: string; nombre: string } | null>(null);
  const [historialOpen, setHistorialOpen] = useState(false);

  useEffect(() => {
    if (!eventoId) return;
    let activo = true;
    debidaDiligenciaService
      .miExpediente()
      .then((r) => { if (activo) setData(r); })
      .catch(() => { if (activo) setData(null); })
      .finally(() => { if (activo) setLoading(false); });
    return () => { activo = false; };
  }, [eventoId]);

  const expediente = data?.expediente ?? null;
  const empresa = data?.empresa ?? null;
  const estadoExterno = data?.estadoExterno ?? null;
  const externoApto = estadoExterno?.aptoParaContratar === true;
  const editable = ddUtils.puedeEditar(expediente?.estado);
  const observacionesAbiertas = (expediente?.observaciones ?? []).filter((observacion) => {
    if (observacion.estado !== DD_OBSERVACION_ESTADOS.ABIERTA) return false;
    if (!observacion.documentoTipo) return true;
    const documento = expediente?.documentos.find((item) => item.tipo === observacion.documentoTipo);
    return documento?.estado !== DD_DOCUMENTO_ESTADOS.APROBADO;
  });
  const vigencia = useMemo(() => {
    if (!expediente || expediente.estado !== DD_ESTADOS.APROBADA) return null;
    const transcurridos = Math.max(0, Math.min(DD_VIGENCIA_MESES, dateUtils.monthsBetween(expediente.fechaAprobacion, dateUtils.now()) ?? 0));
    return {
      transcurridos,
      porcentaje: (transcurridos / DD_VIGENCIA_MESES) * 100,
    };
  }, [expediente]);

  const hitos: Hito[] = useMemo(() => {
    if (!expediente) return [];
    const enviado = Boolean(expediente.fechaEnvio);
    const revisado = Boolean(expediente.fechaRevision);
    const observado = expediente.estado === DD_ESTADOS.OBSERVADA || observacionesAbiertas.length > 0;
    const aprobado = expediente.estado === DD_ESTADOS.APROBADA;
    const rechazado = expediente.estado === DD_ESTADOS.RECHAZADA;
    return [
      {
        titulo: "Formulario enviado",
        fecha: expediente.fechaEnvio,
        estado: enviado ? "completado" : "pendiente",
        detalle: enviado ? "Recibimos tu información." : "Completa y envía el formulario.",
      },
      {
        titulo: "Revisión de Logística",
        fecha: expediente.fechaRevision,
        estado: revisado ? "completado" : enviado ? "activo" : "pendiente",
        detalle: revisado ? "Logística revisó los documentos." : "Pendiente de revisión.",
      },
      {
        titulo: observado ? "Observaciones" : "Sin observaciones",
        fecha: observado ? expediente.fechaRevision : null,
        estado: observado ? "alerta" : revisado ? "completado" : "pendiente",
        detalle: observado
          ? `${observacionesAbiertas.length} observación(es) por corregir.`
          : revisado
            ? "No se registraron observaciones."
            : "Se mostrarán aquí si las hubiera.",
      },
      {
        titulo: rechazado ? "Expediente rechazado" : "Aprobación final",
        fecha: aprobado ? expediente.fechaAprobacion : rechazado ? expediente.fechaRechazo : null,
        estado: aprobado ? "completado" : rechazado ? "alerta" : "pendiente",
        detalle: aprobado
          ? `Aprobada por ${expediente.revisadoPor ?? "Logística"}.`
          : rechazado
            ? expediente.motivoRechazo ?? "Consulta el informe legal."
            : "Pendiente de aprobación.",
      },
    ];
  }, [expediente, observacionesAbiertas.length]);

  const cargandoVista = cargando || (Boolean(eventoId) && loading && data === null);

  return (
    <PaginaDashboard
      titulo="Mi debida diligencia"
      descripcion="Consulta el estado, la vigencia y las observaciones de la evaluación de tu empresa."
      cargando={cargandoVista}
      tieneEvento={Boolean(eventoId)}
      accion={
        empresa ? (
          <Badge className="pointer-events-none gap-1 bg-primary/10 text-[11px] text-primary">
            <ShieldCheck className="h-3 w-3" />
            <span>{empresa.razonSocial}</span>
          </Badge>
        ) : undefined
      }
    >
      {!data && loading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : !expediente && externoApto ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div className="max-w-lg">
              <h2 className="text-base font-semibold text-foreground">Debida diligencia aprobada</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {empresa?.razonSocial ?? "Tu empresa"} ya cuenta con una evaluación APTA en el registro oficial.
                La documentación se completará en la siguiente etapa.
              </p>
              {estadoExterno?.fechaVencimiento ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Vigente hasta {dateUtils.format(estadoExterno.fechaVencimiento)}.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : !expediente ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div className="max-w-lg">
              <h2 className="text-base font-semibold text-foreground">Aún no has iniciado tu debida diligencia</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {empresa
                  ? "Completa el formulario de 4 pasos para que Logística y Comunicaciones evalúen a tu empresa. Puedes guardar borradores y continuar después."
                  : "Tu cuenta no está vinculada a una empresa. Actualiza tus datos en el perfil para iniciar la debida diligencia."}
              </p>
            </div>
            <Button asChild className="gap-2">
              <Link href={empresa ? DD_RUTAS.FORMULARIO : "/dashboard/perfil"}>
                <span>{empresa ? "Comenzar debida diligencia" : "Completar mi perfil"}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle><span className="text-base font-bold text-primary">Estado de la evaluación</span></CardTitle>
                    <DdEstadoBadge estado={expediente.estado} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Expediente {expediente.codigo} · {expediente.evento.nombre}
                  </p>
                </div>
                <DdVigenciaBadge estado={expediente.estado} fechaVencimiento={expediente.fechaVencimiento} />
              </CardHeader>
              <CardContent className="pt-5">
                <ol className="relative space-y-5">
                  <span aria-hidden="true" className="absolute top-2 bottom-2 left-[11px] w-px bg-border" />
                  {hitos.map((hito) => (
                    <li key={hito.titulo} className="relative flex gap-3">
                      <span
                        className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                          hito.estado === "completado"
                            ? "border-success bg-success text-success-foreground"
                            : hito.estado === "activo"
                              ? "border-primary bg-primary text-primary-foreground"
                              : hito.estado === "alerta"
                                ? "border-warning bg-warning/15 text-warning"
                                : "border-border bg-card text-muted-foreground"
                        }`}
                      >
                        {hito.estado === "completado" ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : hito.estado === "activo" ? (
                          <Clock className="h-3.5 w-3.5" />
                        ) : hito.estado === "alerta" ? (
                          <AlertCircle className="h-3.5 w-3.5" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <p className="text-xs font-semibold text-foreground">{hito.titulo}</p>
                          {hito.fecha ? (
                            <span className="text-[11px] text-muted-foreground">{dateUtils.format(hito.fecha)}</span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{hito.detalle}</p>
                      </div>
                    </li>
                  ))}
                </ol>

                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                  {editable ? (
                    <Button asChild size="sm" className="gap-1.5 text-xs">
                      <Link href={DD_RUTAS.FORMULARIO}>
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>{expediente.estado === DD_ESTADOS.OBSERVADA ? "Corregir y solicitar nueva evaluación" : "Continuar formulario"}</span>
                      </Link>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    disabled={expediente.documentos.length === 0}
                    onClick={() => setDocumentosOpen(true)}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Ver documentos enviados</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => setHistorialOpen(true)}
                  >
                    <History className="h-3.5 w-3.5" />
                    <span>Ver historial</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {observacionesAbiertas.length > 0 ? (
              <Card>
                <CardHeader className="border-b border-border pb-4">
                  <CardTitle>
                    <span className="text-base font-bold text-primary">Observaciones ({observacionesAbiertas.length})</span>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Corrige los documentos observados y vuelve a enviar tu expediente.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  {observacionesAbiertas.map((observacion) => (
                    <div key={observacion.id} className="rounded-lg border border-warning/40 border-l-[3px] border-l-warning bg-warning/5 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="font-semibold text-warning">{DD_OBSERVACION_AREA_LABELS[observacion.area] ?? observacion.area}</span>
                        <span>·</span>
                        <span>{dateUtils.format(observacion.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-xs text-foreground">{observacion.texto}</p>
                      {observacion.documentoTipo ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Documento: {DD_DOCUMENTOS_REQUERIDOS.find((d) => d.tipo === observacion.documentoTipo)?.titulo ?? observacion.documentoTipo}
                        </p>
                      ) : null}
                      <Button asChild variant="link" size="sm" className="mt-1 h-auto p-0 text-[11px] text-primary">
                        <Link href={DD_RUTAS.FORMULARIO}>Corregir documento</Link>
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {expediente.estado === DD_ESTADOS.RECHAZADA ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <span className="block text-xs font-semibold">Debida diligencia rechazada</span>
                  <span className="text-xs">{expediente.motivoRechazo ?? "El rechazo definitivo se comunica mediante informe legal."}</span>
                </AlertDescription>
              </Alert>
            ) : null}

            {expediente.informeLegalUrl ? (
              <Card>
                <CardHeader className="border-b border-border pb-4">
                  <CardTitle>
                    <span className="text-base font-bold text-primary">Informe legal</span>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Documento emitido por el área Legal.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <div className="flex items-start gap-2">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-foreground">
                        {expediente.informeLegalNombre ?? "Informe legal"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {expediente.legalRevisor ? `Revisado por ${expediente.legalRevisor}` : ""}
                        {expediente.fechaLegal ? ` · ${dateUtils.formatDateTime(expediente.fechaLegal)}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() =>
                        setPreviewDocumento({
                          url: expediente.informeLegalUrl as string,
                          nombre: expediente.informeLegalNombre ?? "Informe legal",
                        })
                      }
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Ver informe legal</span>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                      <a href={expediente.informeLegalUrl} download={expediente.informeLegalNombre ?? undefined}>
                        <span>Descargar</span>
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="border-b border-border pb-3">
                <CardTitle><span className="text-sm font-bold text-primary">Vigencia</span></CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-4">
                {expediente.estado === DD_ESTADOS.APROBADA ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Aprobada hasta <strong className="text-foreground">{dateUtils.format(expediente.fechaVencimiento)}</strong>
                    </p>
                    <DdVigenciaBadge estado={expediente.estado} fechaVencimiento={expediente.fechaVencimiento} />
                    <Progress className="mt-2 h-1.5" value={vigencia?.porcentaje ?? 0} />
                    <p className="text-[11px] text-muted-foreground">
                      {vigencia ? `${vigencia.transcurridos.toFixed(1)} de ${DD_VIGENCIA_MESES} meses transcurridos.` : `Debe renovarse cada ${DD_VIGENCIA_MESES} meses.`}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    La vigencia de {DD_VIGENCIA_MESES} meses se activa cuando Logística aprueba el expediente.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b border-border pb-3">
                <CardTitle><span className="text-sm font-bold text-primary">¿Puedo reservar?</span></CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Puede reservar un stand, pero no avanzará en las aprobaciones hasta que la debida diligencia quede aprobada.
                </p>
                <Button asChild variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                  <Link href="/mapa">
                    <Map className="h-3.5 w-3.5" />
                    <span>Ir al plano de stands</span>
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b border-border pb-3">
                <CardTitle><span className="text-sm font-bold text-primary">Contacto</span></CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="break-all">{expediente.emailRepresentante ?? empresa?.representanteCorreo ?? "No declarado"}</span>
                </p>
                <Button asChild variant="outline" size="sm" className="w-full text-xs">
                  <Link href="/dashboard/perfil">Actualizar correo</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <DdHistorialDialog
        expedienteId={expediente?.id ?? null}
        open={historialOpen}
        onOpenChange={setHistorialOpen}
      />

      <Dialog open={documentosOpen} onOpenChange={setDocumentosOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="text-left">
            <DialogTitle className="text-base font-semibold">Documentos enviados</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] uppercase tracking-wide">Documento</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wide">Estado</TableHead>
                  <TableHead className="text-right text-[10px] uppercase tracking-wide">Archivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expediente?.documentos.map((documento) => (
                  <TableRow key={documento.id}>
                    <TableCell className="max-w-[220px] text-xs">
                      <span className="block font-medium text-foreground">
                        {DD_DOCUMENTOS_REQUERIDOS.find((d) => d.tipo === documento.tipo)?.titulo ?? documento.tipo}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">{documento.nombre}</span>
                      {documento.versiones.length > 1 ? (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-[10px] font-semibold text-primary">
                            Versiones ({documento.versiones.length})
                          </summary>
                          <ul className="mt-1 space-y-0.5">
                            {documento.versiones.map((version) => (
                              <li key={version.id}>
                                <Button
                                  type="button"
                                  variant="link"
                                  size="sm"
                                  className="h-auto max-w-[190px] justify-start truncate p-0 text-[10px]"
                                  onClick={() =>
                                    setPreviewDocumento({
                                      url: version.url,
                                      nombre: version.nombre,
                                    })
                                  }
                                >
                                  v{version.version} · {version.nombre}
                                </Button>
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </TableCell>
                    <TableCell><DdDocumentoBadge estado={documento.estado} /></TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-[11px]"
                        onClick={() => {
                          setDocumentosOpen(false);
                          setPreviewDocumento(documento);
                        }}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>Ver</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <DdDocumentoPreviewDialog documento={previewDocumento} onClose={() => setPreviewDocumento(null)} />
    </PaginaDashboard>
  );
}
