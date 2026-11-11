"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@nrivera-iimp/ui-kit-iimp";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Globe2,
  Paperclip,
  Printer,
  Scale,
  ShieldCheck,
  Users,
} from "lucide-react";
import { DdMatrizResultadoBadge, DdMatrizResultadoFinalBadge } from "./dd-matriz-badges";
import { ddMatrizEvaluacionService } from "@/lib/client/api/services/dd-matriz-evaluacion-service";
import {
  DD_MATRIZ_ADJUNTO_CATEGORIA_LABELS,
  DD_MATRIZ_EVAL_PER_PAGE_MAX,
  DD_MATRIZ_RESULTADO_FINAL_LABELS,
  DD_MATRIZ_RESULTADOS,
  DD_MATRIZ_RESULTADOS_FINALES,
  DD_MATRIZ_TIPO_VINCULO_LABELS,
  DD_RUTAS,
  DD_VINCULO_LABELS,
  type DdMatrizAdjuntoCategoria,
  type DdMatrizResultadoFinal,
  type DdMatrizTipoVinculo,
} from "@/lib/shared/constants";
import {
  evidenciasInforme,
  observacionesInforme,
  resumenInforme,
} from "@/lib/shared/utils/dd-informe";
import { dateUtils } from "@/lib/shared/utils/date";
import { nombrePais } from "@/lib/shared/utils/pais";
import type { DdMatrizEvaluacionDetalleDTO } from "@/types/dto/debida-diligencia";

interface Props {
  expedienteId: string;
}

const AREA_LABELS = {
  sig: "SIG / Logística",
  reputacional: "Comunicaciones",
  compliance: "Legal / Compliance",
} as const;

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-xs font-medium text-foreground">{children}</dd>
    </div>
  );
}

function SectionTitle({
  id,
  icon,
  children,
  extra,
}: {
  id?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <div id={id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-primary">
        <span className="grid h-6 w-6 place-items-center rounded bg-primary/10 text-primary">{icon}</span>
        <span>{children}</span>
      </h3>
      {extra ? <span className="text-[10px] text-muted-foreground">{extra}</span> : null}
    </div>
  );
}

function resultadoArea(
  detalles: DdMatrizEvaluacionDetalleDTO[],
  campo: "sig" | "reputacional" | "compliance",
): string | null {
  const valores = detalles
    .map((detalle) => detalle[campo].resultado)
    .filter((valor): valor is string => Boolean(valor));
  if (valores.includes(DD_MATRIZ_RESULTADOS.OBSERVADO)) return DD_MATRIZ_RESULTADOS.OBSERVADO;
  if (valores.includes(DD_MATRIZ_RESULTADOS.NO_APLICA)) return DD_MATRIZ_RESULTADOS.NO_APLICA;
  if (valores.includes(DD_MATRIZ_RESULTADOS.ACEPTADO)) return DD_MATRIZ_RESULTADOS.ACEPTADO;
  return null;
}

function responsableArea(
  detalles: DdMatrizEvaluacionDetalleDTO[],
  campo: "sig" | "reputacional" | "compliance",
): string | null {
  const responsables = detalles
    .map((detalle) => detalle[campo].responsable)
    .filter((valor): valor is string => Boolean(valor));
  return responsables.length > 0 ? [...new Set(responsables)].join(", ") : null;
}

export function DdInformeDetalle({ expedienteId }: Props) {
  const [empresa, setEmpresa] = useState<DdMatrizEvaluacionDetalleDTO | null>(null);
  const [vinculos, setVinculos] = useState<DdMatrizEvaluacionDetalleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const abierto = await ddMatrizEvaluacionService.abrir(expedienteId);
        const detalleEmpresa = await ddMatrizEvaluacionService.detalle(abierto.id);
        const listado = await ddMatrizEvaluacionService.listar({
          search: detalleEmpresa.expediente.codigo,
          perPage: DD_MATRIZ_EVAL_PER_PAGE_MAX,
        });
        const filas = listado.data.filter((fila) => fila.expedienteId === expedienteId);
        const detalles = await Promise.all(filas.map((fila) => ddMatrizEvaluacionService.detalle(fila.id)));
        if (!activo) return;
        setEmpresa(detalleEmpresa);
        setVinculos(detalles.length > 0 ? detalles : [detalleEmpresa]);
      } catch (err) {
        if (activo) {
          setError(err instanceof Error ? err.message : "No se pudo generar la vista previa del informe");
        }
      } finally {
        if (activo) setLoading(false);
      }
    })();
    return () => {
      activo = false;
    };
  }, [expedienteId]);

  const resumen = useMemo(() => resumenInforme(vinculos), [vinculos]);
  const observaciones = useMemo(() => observacionesInforme(vinculos), [vinculos]);
  const anexos = useMemo(() => evidenciasInforme(vinculos), [vinculos]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 rounded-xl" />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Skeleton className="h-[720px] rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!empresa || error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <AlertTriangle className="h-8 w-8 text-warning" />
          <p className="text-sm font-semibold text-foreground">No se pudo abrir el informe</p>
          <p className="max-w-md text-xs text-muted-foreground">{error ?? "El expediente no tiene matriz asociada."}</p>
          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
            <Link href={DD_RUTAS.INFORMES}>
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Volver a informes</span>
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const exp = empresa.expediente;
  const final = empresa.resultadoFinal as DdMatrizResultadoFinal | null;
  const finalLabel = final ? (DD_MATRIZ_RESULTADO_FINAL_LABELS[final] ?? final) : "EN REVISIÓN";
  const tiposRelacion = exp.tipoRelacionComercial.map((tipo) => DD_VINCULO_LABELS[tipo] ?? tipo);
  const pais = exp.paisConstitucion ? nombrePais(exp.paisConstitucion) : "Perú";
  const reportDate = empresa.finalFecha ?? empresa.updatedAt;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground print:hidden">
        <Link href={DD_RUTAS.INFORMES} className="hover:text-primary">Informes DD</Link>
        <ChevronRight className="h-3 w-3" />
        <span>Vista previa</span>
      </div>

      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center print:hidden">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Informe de Debida Diligencia</h1>
            <Badge className="pointer-events-none border-primary/20 bg-primary/10 text-[10px] text-primary">
              <FileText className="mr-1 h-3 w-3" />
              <span>Vista previa</span>
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Consolidado desde la matriz y las evidencias de {exp.empresaRazonSocial}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <Link href={`${DD_RUTAS.MATRIZ}/${empresa.id}`}>
              <Building2 className="h-3.5 w-3.5" />
              <span>Abrir matriz</span>
            </Link>
          </Button>
          <Button type="button" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" />
            <span>Imprimir / PDF</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                    <ShieldCheck className="h-4 w-4" />
                    <span>IIMP — {exp.eventoProyecto ?? "Evento institucional"}</span>
                  </div>
                  <h2 className="mt-1 text-lg font-bold text-foreground">INFORME DE DEBIDA DILIGENCIA CORPORATIVA</h2>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">Expediente: {exp.codigo}</p>
                </div>
                <div className="text-right">
                  <DdMatrizResultadoFinalBadge valor={final} />
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Fecha: {dateUtils.format(reportDate)}
                  </p>
                </div>
              </div>

              <section className="space-y-3">
                <SectionTitle id="datos" icon={<Building2 className="h-3.5 w-3.5" />}>
                  1. Datos generales de la empresa
                </SectionTitle>
                <dl className="grid gap-3 rounded-lg bg-secondary/40 p-4 sm:grid-cols-2">
                  <Dato label="Razón social">{exp.empresaRazonSocial}</Dato>
                  <Dato label="RUC">{exp.empresaRuc}</Dato>
                  <Dato label="Relación comercial">{tiposRelacion.length > 0 ? tiposRelacion.join(", ") : "Sin registrar"}</Dato>
                  <Dato label="País de constitución">{pais}</Dato>
                  <Dato label="Actividad económica">{exp.actividadEconomica ?? empresa.generales.actividadEconomica ?? "No registrada"}</Dato>
                  <Dato label="Motivo de evaluación">{empresa.generales.motivo ?? exp.motivo ?? "No registrado"}</Dato>
                </dl>
              </section>

              <section className="space-y-3">
                <SectionTitle id="vinculos" icon={<Users className="h-3.5 w-3.5" />} extra={`${vinculos.length} vínculo(s)`}>
                  2. Vínculos evaluados
                </SectionTitle>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="bg-secondary/70 text-[9px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Vínculo</th>
                        <th className="px-3 py-2 font-semibold">Tipo</th>
                        <th className="px-3 py-2 font-semibold">SIG</th>
                        <th className="px-3 py-2 font-semibold">Reputacional</th>
                        <th className="px-3 py-2 font-semibold">Compliance</th>
                        <th className="px-3 py-2 font-semibold">Final</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {vinculos.map((vinculo) => (
                        <tr key={vinculo.id} className="align-top">
                          <td className="px-3 py-2.5">
                            <p className="font-semibold text-foreground">{vinculo.nombre}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {vinculo.documento ?? "Sin documento"}
                              {vinculo.ambito ? ` · ${vinculo.ambito}` : ""}
                            </p>
                          </td>
                          <td className="px-3 py-2.5 text-[11px] text-muted-foreground">
                            <p>{DD_MATRIZ_TIPO_VINCULO_LABELS[vinculo.tipo as DdMatrizTipoVinculo] ?? vinculo.tipo}</p>
                            {vinculo.cargo ? <p className="mt-0.5 text-[10px]">{vinculo.cargo}</p> : null}
                          </td>
                          <td className="px-3 py-2.5">
                            <DdMatrizResultadoBadge valor={vinculo.sig.resultado} />
                          </td>
                          <td className="px-3 py-2.5">
                            <DdMatrizResultadoBadge valor={vinculo.reputacional.resultado} />
                          </td>
                          <td className="px-3 py-2.5">
                            <DdMatrizResultadoBadge valor={vinculo.compliance.resultado} />
                          </td>
                          <td className="px-3 py-2.5">
                            <DdMatrizResultadoFinalBadge valor={vinculo.resultadoFinal} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="space-y-3">
                <SectionTitle id="resultados" icon={<Globe2 className="h-3.5 w-3.5" />}>
                  3. Resultados por área
                </SectionTitle>
                <div className="grid gap-2 md:grid-cols-3">
                  {(["sig", "reputacional", "compliance"] as const).map((area) => {
                    const resultado = resultadoArea(vinculos, area);
                    const responsable = responsableArea(vinculos, area);
                    return (
                      <div key={area} className="rounded-lg border border-border bg-secondary/20 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          {AREA_LABELS[area]}
                        </p>
                        <div className="mt-1.5">
                          <DdMatrizResultadoBadge valor={resultado} />
                        </div>
                        <p className="mt-2 text-[10px] text-muted-foreground">
                          {responsable ? `Responsable: ${responsable}` : "Sin responsable registrado"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3">
                <SectionTitle id="observaciones" icon={<AlertTriangle className="h-3.5 w-3.5" />} extra={`${observaciones.length} observación(es)`}>
                  4. Observaciones y sustento
                </SectionTitle>
                {observaciones.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border bg-secondary/20 p-4 text-xs text-muted-foreground">
                    No se registraron observaciones por área en los vínculos evaluados.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {observaciones.map((observacion) => (
                      <div key={observacion.id} className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] font-bold text-foreground">
                            {observacion.vinculo}
                            <span className="ml-2 font-normal text-muted-foreground">
                              {observacion.area}
                            </span>
                          </p>
                          {observacion.responsable ? (
                            <span className="text-[10px] text-muted-foreground">{observacion.responsable}</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-foreground/80">{observacion.texto}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <SectionTitle id="anexos" icon={<Paperclip className="h-3.5 w-3.5" />} extra={`${anexos.length} archivo(s)`}>
                  5. Anexos y evidencias
                </SectionTitle>
                {anexos.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border bg-secondary/20 p-4 text-xs text-muted-foreground">
                    No hay evidencias adjuntas en la matriz.
                  </p>
                ) : (
                  <div className="divide-y divide-border rounded-lg border border-border">
                    {anexos.map((anexo) => (
                      <div key={anexo.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-primary/10 text-primary">
                            <Paperclip className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-semibold text-foreground">{anexo.nombre}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {DD_MATRIZ_ADJUNTO_CATEGORIA_LABELS[anexo.categoria as DdMatrizAdjuntoCategoria] ?? anexo.categoria}
                              {" · "}
                              {dateUtils.format(anexo.createdAt)}
                            </p>
                          </div>
                        </div>
                        <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-[10px]">
                          <a href={anexo.url} target="_blank" rel="noreferrer">
                            <FileText className="h-3.5 w-3.5" />
                            <span>Abrir</span>
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3 border-t border-border pt-4">
                <SectionTitle id="conclusiones" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
                  6. Conclusión final del expediente
                </SectionTitle>
                <div className={`rounded-lg border p-4 ${final === DD_MATRIZ_RESULTADOS_FINALES.APTO
                  ? "border-emerald-200 bg-emerald-50/60"
                  : final === DD_MATRIZ_RESULTADOS_FINALES.NO_APTO
                    ? "border-red-200 bg-red-50/60"
                    : "border-primary/20 bg-primary/5"}`}>
                  <p className="text-sm font-bold text-foreground">
                    {final
                      ? finalLabel
                      : "El expediente aún no tiene conclusión final."}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {final
                      ? `La empresa ${exp.empresaRazonSocial} tiene resultado ${finalLabel} en la evaluación consolidada${tiposRelacion.length > 0 ? ` de la relación ${tiposRelacion.join(", ")}` : ""}.`
                      : "Los resultados por vínculo se muestran arriba y el informe podrá consolidarse cuando SIG registre la decisión final."}
                  </p>
                  {empresa.finalPor || empresa.finalFecha ? (
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      {empresa.finalPor ? `Registrado por ${empresa.finalPor}` : "Registrado"}
                      {empresa.finalFecha ? ` · ${dateUtils.formatDateTime(empresa.finalFecha)}` : ""}
                    </p>
                  ) : null}
                </div>
              </section>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4 print:hidden">
          <Card>
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-primary">
                <ShieldCheck className="h-4 w-4" />
                <span>Estado del informe</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">Resultado final</span>
                <DdMatrizResultadoFinalBadge valor={final} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">Vínculos</span>
                <span className="text-xs font-semibold text-foreground">{resumen.totalVinculos}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">Evidencias</span>
                <span className="text-xs font-semibold text-foreground">{resumen.totalEvidencias}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">Observaciones</span>
                <span className="text-xs font-semibold text-warning">{observaciones.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-sm font-bold text-primary">Verificación de criterios</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-4">
              <Criterio completado={resumen.sigCompleto} label="Consolidación SIG" />
              <Criterio completado={resumen.reputacionalCompleto} label="Validación de Comunicaciones" />
              <Criterio completado={resumen.complianceCompleto} label="Revisión de Legal / Compliance" />
              <Criterio completado={resumen.totalEvidencias > 0} label="Evidencias adjuntas" />
              <Criterio completado={resumen.pendientes === 0} label="Todos los vínculos con resultado" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 p-4">
              <Button asChild variant="outline" size="sm" className="w-full justify-start gap-1.5 text-xs">
                <Link href={DD_RUTAS.INFORMES}>
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Volver a informes</span>
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="w-full justify-start gap-1.5 text-xs">
                <Link href={`${DD_RUTAS.MATRIZ}/${empresa.id}`}>
                  <Scale className="h-3.5 w-3.5" />
                  <span>Revisar matriz</span>
                </Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Criterio({ completado, label }: { completado: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-foreground">
      {completado ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
      ) : (
        <Clock3 className="h-3.5 w-3.5 shrink-0 text-warning" />
      )}
      <span>{label}</span>
    </div>
  );
}
