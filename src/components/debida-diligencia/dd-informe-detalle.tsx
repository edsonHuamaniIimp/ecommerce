"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Progress,
  Skeleton,
} from "@nrivera-iimp/ui-kit-iimp";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  FileDown,
  Globe2,
  ListChecks,
  Paperclip,
  Scale,
  Users,
} from "lucide-react";
import {
  DdMatrizConclusionBadge,
  DdMatrizResultadoBadge,
  DdMatrizResultadoFinalBadge,
} from "./dd-matriz-badges";
import { ddMatrizEvaluacionService } from "@/lib/client/api/services/dd-matriz-evaluacion-service";
import { debidaDiligenciaService } from "@/lib/client/api/services/debida-diligencia-service";
import { empresasService } from "@/lib/client/api/services/empresas-service";
import { sunatService } from "@/lib/client/api/services/sunat-service";
import {
  DD_MATRIZ_ADJUNTO_CATEGORIA_LABELS,
  DD_INFORME_GRUPOS_OBSERVACION,
  DD_MATRIZ_EVAL_PER_PAGE_MAX,
  DD_MATRIZ_RESULTADO_FINAL_LABELS,
  DD_MATRIZ_RESULTADOS,
  DD_MATRIZ_RESULTADOS_FINALES,
  DD_MATRIZ_SI_NO_NA,
  DD_MATRIZ_SI_NO_NA_LABELS,
  DD_MATRIZ_TIPO_VINCULO_LABELS,
  DD_REPUTACION_ESTADO_LABELS,
  DD_REPUTACION_RESULTADO_LABELS,
  DD_RUTAS,
  DD_VINCULO_LABELS,
  type DdMatrizAdjuntoCategoria,
  type DdInformeGrupoObservacion,
  type DdMatrizResultadoFinal,
  type DdMatrizTipoVinculo,
  DD_MATRIZ_LISTA_OTROS,
} from "@/lib/shared/constants";
import {
  casosReputacionConObservacion,
  detalleTieneObservacion,
  esConclusionFinal,
  evidenciasConHallazgo,
  evidenciasInforme,
  observacionesInforme,
  notasPorCriterios,
  type DdInformeNotaCriterio,
  vinculosConObservaciones,
  resumenInforme,
} from "@/lib/shared/utils/dd-informe";
import { resultadoFinalEfectivo } from "@/lib/shared/utils/dd-matriz-evaluacion";
import { dateUtils } from "@/lib/shared/utils/date";
import { nombrePais } from "@/lib/shared/utils/pais";
import type {
  DdExpedienteDTO,
  DdMatrizEvaluacionDetalleDTO,
  DdMatrizEvaluacionFilaDTO,
} from "@/types/dto/debida-diligencia";

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

/** Observaciones de criterios dentro del informe; no desborda con textos largos. */
function NotasEvidencia({ notas }: { notas: DdInformeNotaCriterio[] }) {
  if (notas.length === 0) return null;
  return (
    <ol className="list-decimal space-y-1 pl-4">
      {notas.map((nota) => (
        <li key={nota.id} className="whitespace-pre-wrap break-words">
          {nota.esTitular ? null : <strong>{nota.vinculo}: </strong>}
          {nota.texto}
        </li>
      ))}
    </ol>
  );
}

function valorSiNo(valor: string | null): string | null {
  const texto = (valor ?? "").trim().toLowerCase();
  if (!texto) return null;
  if (texto === "sí" || texto === "si" || texto === "s") return DD_MATRIZ_SI_NO_NA.SI;
  if (texto === "no" || texto === "n") return DD_MATRIZ_SI_NO_NA.NO;
  return texto;
}

function renderCheckbox(valor: string | null, opcion: "SI" | "NO") {
  const normalizado = valorSiNo(valor);
  const checked = normalizado === (opcion === "SI" ? DD_MATRIZ_SI_NO_NA.SI : DD_MATRIZ_SI_NO_NA.NO);
  return <span>[{checked ? "X" : " "}] {opcion}</span>;
}

function renderOpcion(checked: boolean, label: string) {
  return <span>[{checked ? "X" : " "}] {label}</span>;
}

export function DdInformeDetalle({ expedienteId }: Props) {
  const [empresa, setEmpresa] = useState<DdMatrizEvaluacionDetalleDTO | null>(null);
  const [expediente, setExpediente] = useState<DdExpedienteDTO | null>(null);
  const [estadoSunat, setEstadoSunat] = useState<string | null>(null);
  const [vinculos, setVinculos] = useState<DdMatrizEvaluacionDetalleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [soloObservados, setSoloObservados] = useState(false);
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const abierto = await ddMatrizEvaluacionService.abrir(expedienteId);
        const [detalleEmpresa, detalleExpediente] = await Promise.all([
          ddMatrizEvaluacionService.detalle(abierto.id),
          debidaDiligenciaService.detalle(expedienteId),
        ]);
        const filas: DdMatrizEvaluacionFilaDTO[] = [];
        for (let page = 1; ; page += 1) {
          const listado = await ddMatrizEvaluacionService.listar({
            expedienteId,
            page,
            perPage: DD_MATRIZ_EVAL_PER_PAGE_MAX,
          });
          filas.push(...listado.data);
          if (page >= listado.totalPages) break;
        }
        const detalles = await Promise.all(filas.map((fila) => ddMatrizEvaluacionService.detalle(fila.id)));
        if (!activo) return;
        setEmpresa(detalleEmpresa);
        setExpediente(detalleExpediente);
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

  useEffect(() => {
    if (!empresa) return;
    if (empresa.generales.estadoContribuyente?.trim()) return;
    const ruc = empresa.expediente.empresaRuc;
    const esPeruano =
      /^\d{11}$/.test(ruc) &&
      (!empresa.expediente.paisConstitucion || empresa.expediente.paisConstitucion === "PE");
    if (!esPeruano) return;
    let activo = true;
    sunatService.consultarRuc(ruc).then((respuesta) => {
      if (!activo || respuesta.error) return;
      const estado = [respuesta.estado, respuesta.condicion].filter(Boolean).join(" - ");
      if (estado) {
        setEstadoSunat(estado);
        const actualizaciones = [
          ddMatrizEvaluacionService.guardar({
            id: empresa.id,
            generales: { estadoContribuyente: estado },
          }),
          ...(expediente?.empresaId
            ? [
                empresasService.actualizar({
                  id: expediente.empresaId,
                  estadoContribuyente: estado,
                }),
              ]
            : []),
        ];
        void Promise.allSettled(actualizaciones);
      }
    });
    return () => {
      activo = false;
    };
  }, [empresa, expediente]);

  const resumen = useMemo(() => resumenInforme(vinculos), [vinculos]);
  const observaciones = useMemo(() => observacionesInforme(vinculos), [vinculos]);
  /* Sustento de SIG: la observacion de cada criterio marcado SI (todos los vinculos). */
  const notasCriterios = useMemo(() => notasPorCriterios(vinculos, null), [vinculos]);
  const totalObservaciones = notasCriterios.length + observaciones.length;
  const anexos = useMemo(() => evidenciasInforme(vinculos), [vinculos]);
  /* El PDF solo incluye los vinculos con observaciones (la vista en pantalla muestra todos). */
  const vinculosPdf = useMemo(() => vinculosConObservaciones(vinculos), [vinculos]);
  const anexosPdf = useMemo(() => evidenciasConHallazgo(vinculosPdf), [vinculosPdf]);
  const vinculosVista = soloObservados ? vinculosPdf : vinculos;
  const notasPor = (grupo: DdInformeGrupoObservacion) =>
    notasPorCriterios(vinculosPdf, DD_INFORME_GRUPOS_OBSERVACION[grupo]);

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
  /* Efectivo: sin resultado guardado se deriva del estado (DOCUMENTACION RECIBIDA, EN REVISION, APTO legacy...). */
  const finalEfectivo = resultadoFinalEfectivo(empresa.resultadoFinal, exp.estado);
  /* Conclusion registrada: la recomendacion y el texto de cierre solo se llenan con una conclusion real. */
  const final = esConclusionFinal(finalEfectivo) ? finalEfectivo : null;
  const recibida = finalEfectivo === DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_RECIBIDA;
  const finalLabel = DD_MATRIZ_RESULTADO_FINAL_LABELS[(finalEfectivo ?? DD_MATRIZ_RESULTADOS_FINALES.EN_REVISION) as DdMatrizResultadoFinal];
  const tiposRelacion = exp.tipoRelacionComercial.map((tipo) => DD_VINCULO_LABELS[tipo] ?? tipo);
  const pais = exp.paisConstitucion ? nombrePais(exp.paisConstitucion) : "Perú";
  const reportDate = empresa.finalFecha ?? empresa.updatedAt;
  const representanteVinculo = vinculos.find((vinculo) => vinculo.tipo === "representante") ?? null;
  const documentosBase = expediente?.documentos ?? [];
  const reputacion = expediente?.reputacion ?? [];
  const casosReputacion = [...reputacion].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.nombreARevisar.localeCompare(b.nombreARevisar),
  );
  const casosReputacionPdf = casosReputacionConObservacion(casosReputacion, vinculos);
  const tieneLegal = Boolean(expediente?.decisionLegal || expediente?.motivoLegal);
  const listasEvaluables = vinculos
    .flatMap((vinculo) => vinculo.listas)
    .filter((lista) => lista.codigo !== DD_MATRIZ_LISTA_OTROS);
  const totalListas = listasEvaluables.length;
  const listasConResultado = listasEvaluables.filter((lista) => Boolean(lista.valor)).length;
  const datosEmpresa = empresa.generales;
  const esEmpresaPeruana =
    /^\d{11}$/.test(exp.empresaRuc) &&
    (!exp.paisConstitucion || exp.paisConstitucion === "PE");
  const estadoContribuyente =
    datosEmpresa.estadoContribuyente?.trim() ||
    estadoSunat ||
    (esEmpresaPeruana ? "No registrado" : "No aplica");
  const listaValor = (codigo: string): string | null => {
    for (const vinculo of vinculos) {
      const valor = vinculo.listas.find((lista) => lista.codigo === codigo)?.valor;
      if (valor) return valor;
    }
    return null;
  };
  const detalleRiesgo =
    vinculos
      .map((vinculo) => vinculo.reputacional.observaciones?.trim())
      .filter((texto): texto is string => Boolean(texto))
      .join(" ") || "--";
  const handlePrint = () => {
    const tituloAnterior = document.title;
    document.title = `Informe DD - ${exp.empresaRazonSocial}`;
    window.print();
    window.setTimeout(() => {
      document.title = tituloAnterior;
    }, 0);
  };

  return (
    <div className="print-report space-y-4">
      <div className="flex flex-wrap items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground print:hidden">
        <Link href={DD_RUTAS.INFORMES} className="hover:text-primary">Informes DD</Link>
        <ChevronRight className="h-3 w-3" />
        <span>Vista previa</span>
      </div>

      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center print:hidden">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Evaluación Debida Diligencia</h1>
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
          <Button type="button" size="sm" className="h-8 gap-1.5 text-xs" onClick={handlePrint}>
            <FileDown className="h-3.5 w-3.5" />
            <span>Generar PDF</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px] print:hidden">
        <div className="min-w-0 space-y-4">
          <Card className="overflow-hidden">
            <div className="h-1 bg-primary" />
            <CardContent className="space-y-5 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Image src="/iimp-logo.png" alt="IIMP" width={202} height={65} className="h-9 w-auto" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      IIMP — {exp.eventoProyecto ?? "Evento institucional"}
                    </p>
                    <h2 className="mt-0.5 text-lg font-bold leading-tight text-foreground">{exp.empresaRazonSocial}</h2>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      RUC {exp.empresaRuc || "—"} · {exp.codigo} · FRM-LOG-104 v01
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <DdMatrizResultadoFinalBadge valor={finalEfectivo} />
                  <p className="mt-1.5 text-[10px] text-muted-foreground">Fecha: {dateUtils.format(reportDate)}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi etiqueta="Vínculos evaluados" valor={vinculos.length} icono={<Users className="h-4 w-4" />} />
                <Kpi
                  etiqueta="Con observaciones"
                  valor={vinculosPdf.length}
                  alerta={vinculosPdf.length > 0}
                  icono={<AlertTriangle className="h-4 w-4" />}
                />
                <Kpi etiqueta="Evidencias" valor={resumen.totalEvidencias} icono={<Paperclip className="h-4 w-4" />} />
                <Kpi
                  etiqueta="Controles de listas"
                  valor={`${listasConResultado}/${totalListas}`}
                  avance={totalListas > 0 ? (listasConResultado / totalListas) * 100 : 0}
                  icono={<ListChecks className="h-4 w-4" />}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="scroll-mt-4" id="datos">
            <CardContent className="space-y-3 p-5">
              <SectionTitle icon={<Building2 className="h-3.5 w-3.5" />}>1. Datos generales de la empresa</SectionTitle>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                <Dato label="Razón social">{exp.empresaRazonSocial}</Dato>
                <Dato label="RUC / Tax ID">{exp.empresaRuc || "No registrado"}</Dato>
                <Dato label="Estado del contribuyente">{estadoContribuyente}</Dato>
                <Dato label="Dirección legal">{datosEmpresa.direccionLegal ?? "No registrada"}</Dato>
                <Dato label="Actividad económica">
                  {exp.actividadEconomica ?? datosEmpresa.actividadEconomica ?? "No registrada"}
                </Dato>
                <Dato label="Inicio de actividades">{datosEmpresa.fechaInicioActividades ?? "No registrada"}</Dato>
                <Dato label="País de constitución">{pais}</Dato>
                <Dato label="Relación comercial">
                  {tiposRelacion.length > 0 ? tiposRelacion.join(", ") : "Sin registrar"}
                </Dato>
                <Dato label="Motivo de evaluación">{datosEmpresa.motivo ?? exp.motivo ?? "No registrado"}</Dato>
                <Dato label="Historial con el IIMP">{datosEmpresa.historialIimp ?? "No registrado"}</Dato>
                <Dato label="Beneficio mutuo">{datosEmpresa.beneficioMutuo ?? "No registrado"}</Dato>
              </dl>
              <div className="rounded-lg bg-secondary/40 p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Representante legal
                </p>
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Dato label="Nombre">
                    {expediente?.representanteNombre ?? representanteVinculo?.nombre ?? "No registrado"}
                  </Dato>
                  <Dato label="Documento">
                    {expediente?.representanteDocumento
                      ? `${expediente.representanteTipoDocumento ?? "Documento"} ${expediente.representanteDocumento}`
                      : representanteVinculo?.documento ?? "No registrado"}
                  </Dato>
                  <Dato label="Cargo">{representanteVinculo?.cargo ?? "No registrado"}</Dato>
                  <Dato label="Correo">{expediente?.emailRepresentante ?? "No registrado"}</Dato>
                </dl>
              </div>
            </CardContent>
          </Card>

          <Card className="scroll-mt-4" id="vinculos">
            <CardContent className="space-y-3 p-5">
              <SectionTitle icon={<Users className="h-3.5 w-3.5" />} extra={`${vinculosVista.length} de ${vinculos.length}`}>
                2. Vínculos evaluados
              </SectionTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-md border border-border p-0.5 text-[11px]" role="group" aria-label="Filtrar vínculos">
                  <button
                    type="button"
                    onClick={() => setSoloObservados(false)}
                    aria-pressed={!soloObservados}
                    className={`rounded px-2.5 py-1 font-medium transition ${!soloObservados ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Todos ({vinculos.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSoloObservados(true)}
                    aria-pressed={soloObservados}
                    className={`rounded px-2.5 py-1 font-medium transition ${soloObservados ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Con observaciones ({vinculosPdf.length})
                  </button>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  El PDF incluye solo los vínculos con observaciones.
                </span>
              </div>

              {vinculosVista.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border bg-secondary/20 p-4 text-xs text-muted-foreground">
                  Ningún vínculo tiene observaciones.
                </p>
              ) : (
                <div className="space-y-2">
                  {vinculosVista.map((vinculo) => {
                    const conObservacion = detalleTieneObservacion(vinculo);
                    const abierto = abiertos[vinculo.id] ?? conObservacion;
                    return (
                      <div
                        key={vinculo.id}
                        className={`rounded-lg border ${conObservacion ? "border-warning/40" : "border-border"}`}
                      >
                        <div className="flex flex-wrap items-center gap-2 p-3">
                          <button
                            type="button"
                            aria-expanded={abierto}
                            onClick={() => setAbiertos((previo) => ({ ...previo, [vinculo.id]: !abierto }))}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <ChevronDown
                              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${abierto ? "" : "-rotate-90"}`}
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-bold text-foreground">{vinculo.nombre}</span>
                              <span className="block truncate text-[10px] text-muted-foreground">
                                {DD_MATRIZ_TIPO_VINCULO_LABELS[vinculo.tipo as DdMatrizTipoVinculo] ?? vinculo.tipo}
                                {vinculo.documento ? ` · ${vinculo.tipoDocumento ?? "Doc."} ${vinculo.documento}` : ""}
                                {vinculo.pais ? ` · ${nombrePais(vinculo.pais)}` : ""}
                                {vinculo.cargo ? ` · ${vinculo.cargo}` : ""}
                              </span>
                            </span>
                          </button>
                          {conObservacion ? (
                            <Badge className="pointer-events-none border-warning/30 bg-warning/10 text-[10px] text-warning">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              <span>Con observaciones</span>
                            </Badge>
                          ) : null}
                          <DdMatrizResultadoFinalBadge valor={vinculo.resultadoFinal} estadoExpediente={exp.estado} />
                        </div>

                        {abierto ? (
                          <div className="space-y-3 border-t border-border p-3">
                            <div className="grid gap-2 md:grid-cols-3">
                              {(["sig", "reputacional", "compliance"] as const).map((area) => (
                                <div key={area} className="min-w-0 space-y-1.5 rounded-md border border-border/70 bg-secondary/20 p-2.5">
                                  <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                                    {AREA_LABELS[area]}
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    <DdMatrizResultadoBadge valor={vinculo[area].resultado} />
                                    <DdMatrizConclusionBadge valor={vinculo[area].conclusion} />
                                  </div>
                                  <p className="text-[9px] text-muted-foreground">
                                    {vinculo[area].fecha ? dateUtils.format(vinculo[area].fecha) : "Sin fecha"}
                                    {vinculo[area].responsable ? ` · ${vinculo[area].responsable}` : ""}
                                  </p>
                                  {vinculo[area].observaciones ? (
                                    <p className="whitespace-pre-wrap rounded border border-warning/30 bg-warning/5 p-2 text-[10px] leading-relaxed text-foreground [overflow-wrap:anywhere]">
                                      {vinculo[area].observaciones}
                                    </p>
                                  ) : null}
                                </div>
                              ))}
                            </div>

                            <div>
                              <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                                Controles de listas
                              </p>
                              {vinculo.listas.length === 0 ? (
                                <p className="text-[11px] text-muted-foreground">Sin controles registrados.</p>
                              ) : (
                                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                                  {vinculo.listas.map((lista) => (
                                    <div
                                      key={`${vinculo.id}-${lista.codigo}`}
                                      className="rounded border border-border/70 px-2 py-1.5 text-[10px]"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="truncate text-muted-foreground">{lista.label}</span>
                                        <span
                                          className={`shrink-0 font-semibold ${
                                            lista.valor === DD_MATRIZ_SI_NO_NA.SI
                                              ? "text-warning"
                                              : lista.valor
                                                ? "text-foreground"
                                                : "italic text-muted-foreground"
                                          }`}
                                        >
                                          {lista.valor
                                            ? DD_MATRIZ_SI_NO_NA_LABELS[lista.valor as keyof typeof DD_MATRIZ_SI_NO_NA_LABELS] ?? lista.valor
                                            : "Pendiente"}
                                        </span>
                                      </div>
                                      {lista.valor === DD_MATRIZ_SI_NO_NA.SI && lista.observacion?.trim() ? (
                                        <p className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]">
                                          {lista.observacion}
                                        </p>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {vinculo.adjuntos.length > 0 ? (
                              <div>
                                <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                                  Evidencias ({vinculo.adjuntos.length})
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {vinculo.adjuntos.map((adjunto) => (
                                    <a
                                      key={adjunto.id}
                                      href={adjunto.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex max-w-full items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/5"
                                    >
                                      <Paperclip className="h-3 w-3 shrink-0" />
                                      <span className="truncate">{adjunto.nombre}</span>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="scroll-mt-4" id="resultados">
            <CardContent className="space-y-3 p-5">
              <SectionTitle icon={<Globe2 className="h-3.5 w-3.5" />}>3. Resultados por área</SectionTitle>
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
            </CardContent>
          </Card>

          <Card className="scroll-mt-4" id="observaciones">
            <CardContent className="space-y-3 p-5">
              <SectionTitle icon={<AlertTriangle className="h-3.5 w-3.5" />} extra={`${totalObservaciones} observación(es)`}>
                4. Observaciones y sustento
              </SectionTitle>
              {totalObservaciones === 0 ? (
                <p className="rounded-lg border border-dashed border-border bg-secondary/20 p-4 text-xs text-muted-foreground">
                  No se registraron observaciones en los criterios ni por área en los vínculos evaluados.
                </p>
              ) : (
                <div className="space-y-2">
                  {notasCriterios.map((nota) => (
                    <div key={nota.id} className="rounded-lg border-l-4 border-l-warning border-y border-r border-border bg-warning/5 p-3">
                      <p className="text-[11px] font-bold text-foreground">
                        {nota.vinculo}
                        <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted-foreground">
                          Observación del criterio · {nota.criterio}
                        </span>
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-foreground/80 [overflow-wrap:anywhere]">{nota.texto}</p>
                    </div>
                  ))}
                  {observaciones.map((observacion) => (
                    <div key={observacion.id} className="rounded-lg border-l-4 border-l-warning border-y border-r border-border bg-warning/5 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] font-bold text-foreground">
                          {observacion.vinculo}
                          <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted-foreground">
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
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="scroll-mt-4" id="comunicaciones">
              <CardContent className="space-y-3 p-5">
                <SectionTitle icon={<Users className="h-3.5 w-3.5" />} extra={`${reputacion.length} caso(s)`}>
                  5. Comunicaciones
                </SectionTitle>
                {reputacion.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border bg-secondary/20 p-4 text-xs text-muted-foreground">
                    Sin casos reputacionales registrados.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {casosReputacion.map((caso) => (
                      <div key={caso.id} className="rounded-lg border border-border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold text-foreground">{caso.nombreARevisar}</p>
                          <span className="text-[10px] text-muted-foreground">
                            {DD_REPUTACION_ESTADO_LABELS[caso.estado] ?? caso.estado}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Resultado:{" "}
                          {caso.resultado ? DD_REPUTACION_RESULTADO_LABELS[caso.resultado] ?? caso.resultado : "Pendiente"}
                          {caso.revisor ? ` · Revisor: ${caso.revisor}` : ""}
                          {caso.fechaCierre ? ` · Cierre: ${dateUtils.format(caso.fechaCierre)}` : ""}
                        </p>
                        {caso.comentario ? <p className="mt-1 whitespace-pre-wrap text-[11px] text-foreground [overflow-wrap:anywhere]">{caso.comentario}</p> : null}
                        {caso.linkHallazgos ? (
                          <a
                            href={caso.linkHallazgos}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-[10px] font-medium text-primary underline underline-offset-2"
                          >
                            Ver fuente
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="scroll-mt-4" id="legal">
              <CardContent className="space-y-3 p-5">
                <SectionTitle icon={<Scale className="h-3.5 w-3.5" />}>6. Revisión legal</SectionTitle>
                {!tieneLegal ? (
                  <p className="rounded-lg border border-dashed border-border bg-secondary/20 p-4 text-xs text-muted-foreground">
                    Sin revisión legal registrada.
                  </p>
                ) : (
                  <div className="space-y-2 rounded-lg border border-border p-3 text-[11px]">
                    <p>
                      <strong className="text-foreground">Decisión legal:</strong> {expediente?.decisionLegal ?? "Pendiente"}
                    </p>
                    <p>
                      <strong className="text-foreground">Motivo:</strong> {expediente?.motivoLegal ?? "Sin motivo registrado"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {expediente?.legalRevisor ? `Revisor: ${expediente.legalRevisor}` : ""}
                      {expediente?.fechaLegal ? ` · ${dateUtils.formatDateTime(expediente.fechaLegal)}` : ""}
                    </p>
                    {expediente?.informeLegalUrl ? (
                      <a
                        href={expediente.informeLegalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block font-medium text-primary underline underline-offset-2"
                      >
                        Ver informe legal
                      </a>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="scroll-mt-4" id="anexos">
            <CardContent className="space-y-3 p-5">
              <SectionTitle icon={<Paperclip className="h-3.5 w-3.5" />} extra={`${anexos.length} archivo(s)`}>
                7. Anexos y evidencias
              </SectionTitle>
              {documentosBase.length > 0 ? (
                <div className="space-y-1 rounded-lg border border-border p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Documentos del expediente
                  </p>
                  {documentosBase.map((documento, indice) => (
                    <div key={documento.id} className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="min-w-0 truncate text-foreground">
                        {indice + 1}. {documento.nombre}
                      </span>
                      <span className="shrink-0 text-muted-foreground">{documento.estado}</span>
                    </div>
                  ))}
                </div>
              ) : null}
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
            </CardContent>
          </Card>

          <Card className="scroll-mt-4" id="conclusiones">
            <CardContent className="space-y-3 p-5">
              <SectionTitle icon={<CheckCircle2 className="h-3.5 w-3.5" />}>8. Conclusión final del expediente</SectionTitle>
              <div
                className={`rounded-lg border p-4 ${
                  final === DD_MATRIZ_RESULTADOS_FINALES.APTO
                    ? "border-emerald-200 bg-emerald-50/60"
                    : final === DD_MATRIZ_RESULTADOS_FINALES.NO_APTO
                      ? "border-red-200 bg-red-50/60"
                      : "border-primary/20 bg-primary/5"
                }`}
              >
                <p className="text-sm font-bold text-foreground">
                  {final ? finalLabel : recibida ? finalLabel : "El expediente aún no tiene conclusión final."}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {final
                    ? `La empresa ${exp.empresaRazonSocial} tiene resultado ${finalLabel} en la evaluación consolidada${tiposRelacion.length > 0 ? ` de la relación ${tiposRelacion.join(", ")}` : ""}.`
                    : recibida
                      ? "El cliente envió su documentación y SIG aún no inició la revisión. El informe podrá consolidarse cuando SIG registre la decisión final."
                      : "Los resultados por vínculo se muestran arriba y el informe podrá consolidarse cuando SIG registre la decisión final."}
                </p>
                {empresa.finalComentario ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-foreground">{empresa.finalComentario}</p>
                ) : null}
                {empresa.finalPor || empresa.finalFecha ? (
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    {empresa.finalPor ? `Registrado por ${empresa.finalPor}` : "Registrado"}
                    {empresa.finalFecha ? ` · ${dateUtils.formatDateTime(empresa.finalFecha)}` : ""}
                    {expediente?.fechaVencimiento ? ` · Vigencia hasta ${dateUtils.format(expediente.fechaVencimiento)}` : ""}
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Card>
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-sm font-bold text-primary">Contenido</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <nav aria-label="Secciones del informe" className="flex flex-col">
                {[
                  { id: "datos", label: "Datos generales" },
                  { id: "vinculos", label: "Vínculos evaluados", cuenta: vinculos.length },
                  { id: "resultados", label: "Resultados por área" },
                  { id: "observaciones", label: "Observaciones", cuenta: totalObservaciones, alerta: totalObservaciones > 0 },
                  { id: "comunicaciones", label: "Comunicaciones", cuenta: reputacion.length },
                  { id: "legal", label: "Revisión legal" },
                  { id: "anexos", label: "Anexos y evidencias", cuenta: anexos.length },
                  { id: "conclusiones", label: "Conclusión final" },
                ].map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="flex items-center justify-between gap-2 rounded px-2.5 py-1.5 text-[11px] text-muted-foreground transition hover:bg-secondary/60 hover:text-foreground"
                  >
                    <span>{item.label}</span>
                    {item.cuenta !== undefined ? (
                      <span
                        className={`rounded-full px-1.5 text-[10px] font-semibold ${item.alerta ? "bg-warning/15 text-warning" : "bg-secondary text-muted-foreground"}`}
                      >
                        {item.cuenta}
                      </span>
                    ) : null}
                  </a>
                ))}
              </nav>
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
              <Button type="button" size="sm" className="w-full justify-start gap-1.5 text-xs" onClick={handlePrint}>
                <FileDown className="h-3.5 w-3.5" />
                <span>Generar PDF</span>
              </Button>
              <Button asChild variant="outline" size="sm" className="w-full justify-start gap-1.5 text-xs">
                <Link href={`${DD_RUTAS.MATRIZ}/${empresa.id}`}>
                  <Scale className="h-3.5 w-3.5" />
                  <span>Revisar matriz</span>
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="w-full justify-start gap-1.5 text-xs">
                <Link href={DD_RUTAS.INFORMES}>
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Volver a informes</span>
                </Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="informe-pdf hidden print:block">
        <div className="border border-slate-800 p-4">
          <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <Image src="/iimp-logo.png" alt="IIMP" width={202} height={65} className="h-10 w-auto" />
            </div>
            <h1 className="flex-1 self-center text-center text-sm font-bold uppercase tracking-wide">
              Evaluación Debida Diligencia
            </h1>
            <table className="w-40 border-collapse text-[8px]">
              <tbody>
                <tr><td className="border border-slate-800 px-1 py-0.5 font-semibold">Código</td><td className="border border-slate-800 px-1 py-0.5">FRM-LOG-104</td></tr>
                <tr><td className="border border-slate-800 px-1 py-0.5 font-semibold">Fecha</td><td className="border border-slate-800 px-1 py-0.5">{dateUtils.format(reportDate)}</td></tr>
                <tr><td className="border border-slate-800 px-1 py-0.5 font-semibold">Versión</td><td className="border border-slate-800 px-1 py-0.5">01</td></tr>
                <tr><td className="border border-slate-800 px-1 py-0.5 font-semibold">Página</td><td className="border border-slate-800 px-1 py-0.5">1 de 2</td></tr>
              </tbody>
            </table>
          </div>

          <h2 className="pdf-section border border-slate-800 mt-3 px-2 py-1 text-[11px] font-bold">01. Datos Generales</h2>
          <table className="mt-1 w-full border-collapse text-[9px]">
            <tbody>
              <tr><td className="w-40 border border-slate-800 px-2 py-1 font-semibold">Nombre de la empresa</td><td className="border border-slate-800 px-2 py-1">{exp.empresaRazonSocial}</td></tr>
              <tr><td className="border border-slate-800 px-2 py-1 font-semibold">RUC</td><td className="border border-slate-800 px-2 py-1">{exp.empresaRuc || "No registrado"}</td></tr>
              <tr><td className="border border-slate-800 px-2 py-1 font-semibold">Dirección legal</td><td className="border border-slate-800 px-2 py-1">{datosEmpresa.direccionLegal ?? "No registrada"}</td></tr>
              <tr><td className="border border-slate-800 px-2 py-1 font-semibold">Actividad económica</td><td className="border border-slate-800 px-2 py-1">{exp.actividadEconomica ?? datosEmpresa.actividadEconomica ?? "No registrada"}</td></tr>
              <tr><td className="border border-slate-800 px-2 py-1 font-semibold">Fecha de inicio de actividades</td><td className="border border-slate-800 px-2 py-1">{datosEmpresa.fechaInicioActividades ?? "No registrada"}</td></tr>
              <tr><td className="border border-slate-800 px-2 py-1 font-semibold">Representante legal</td><td className="border border-slate-800 px-2 py-1">{expediente?.representanteNombre ?? representanteVinculo?.nombre ?? "No registrado"}</td></tr>
              <tr><td className="border border-slate-800 px-2 py-1 font-semibold">DNI</td><td className="border border-slate-800 px-2 py-1">{expediente?.representanteDocumento ?? representanteVinculo?.documento ?? "No registrado"}</td></tr>
              <tr><td className="border border-slate-800 px-2 py-1 font-semibold">Cargo</td><td className="border border-slate-800 px-2 py-1">{representanteVinculo?.cargo ?? "No registrado"}</td></tr>
            </tbody>
          </table>

          <h2 className="pdf-section border border-slate-800 mt-4 px-2 py-1 text-[11px] font-bold">2. Cumplimiento Legal</h2>
          <table className="mt-1 w-full border-collapse text-[9px]">
            <tbody>
              <tr>
                <td className="w-56 border border-slate-800 px-2 py-1 font-semibold">SUNAT</td>
                <td className="border border-slate-800 px-2 py-1">
                  [{estadoContribuyente.toUpperCase().includes("ACTIVO") ? "X" : " "}] ACTIVO{" "}
                  [{estadoContribuyente.toUpperCase().includes("HABIDO") ? "X" : " "}] HABIDO
                </td>
              </tr>
              <tr>
                <td className="border border-slate-800 px-2 py-1 font-semibold">Sanciones o multas de INDECOPI</td>
                <td className="border border-slate-800 px-2 py-1">
                  {renderCheckbox(listaValor("indecopi"), "SI")} {renderCheckbox(listaValor("indecopi"), "NO")}
                </td>
              </tr>
            </tbody>
          </table>

          <h2 className="pdf-section border border-slate-800 mt-4 px-2 py-1 text-[11px] font-bold">3. Reputación y Ética</h2>
          <table className="mt-1 w-full border-collapse text-[9px]">
            <tbody>
              <tr>
                <td className="w-56 border border-slate-800 px-2 py-1 font-semibold">Registros de corrupción, soborno o lavado de activos</td>
                <td className="border border-slate-800 px-2 py-1">{renderCheckbox(listaValor("corrupcion_empresa"), "SI")} {renderCheckbox(listaValor("corrupcion_empresa"), "NO")}</td>
              </tr>
              <tr>
                <td className="border border-slate-800 px-2 py-1 font-semibold">Registros de PEP</td>
                <td className="border border-slate-800 px-2 py-1">{renderCheckbox(listaValor("peps_prp_empresa"), "SI")} {renderCheckbox(listaValor("peps_prp_empresa"), "NO")}</td>
              </tr>
              <tr>
                <td className="border border-slate-800 px-2 py-1 font-semibold">Registros de OSCE</td>
                <td className="border border-slate-800 px-2 py-1">{renderCheckbox(listaValor("osce"), "SI")} {renderCheckbox(listaValor("osce"), "NO")}</td>
              </tr>
              <tr>
                <td className="border border-slate-800 px-2 py-1 font-semibold">Registros de OEFA</td>
                <td className="border border-slate-800 px-2 py-1">{renderCheckbox(listaValor("oefa"), "SI")} {renderCheckbox(listaValor("oefa"), "NO")}</td>
              </tr>
              <tr>
                <td className="border border-slate-800 px-2 py-1 font-semibold">Conflictos de interés con IIMP</td>
                <td className="border border-slate-800 px-2 py-1">
                  {renderCheckbox(listaValor("conflicto_interes"), "SI")} {renderCheckbox(listaValor("conflicto_interes"), "NO")}
                  <span className="ml-4">Detallar: {datosEmpresa.beneficioMutuo ?? "--"}</span>
                </td>
              </tr>
            </tbody>
          </table>

          <h3 className="pdf-section border border-slate-800 mt-3 px-2 py-1 text-[10px] font-bold">3.1 Detalle de Hallazgo</h3>
          <div className="mt-1 border border-slate-800 p-2 text-[9px]">
            <p className="pdf-detail border border-slate-800 px-2 py-1 font-semibold">Registros de corrupción, soborno o lavado de activos u otros</p>
            <NotasEvidencia notas={notasPor("LAVADO")} />
            {observaciones.length > 0 ? (
              <ol className="mt-1 list-decimal space-y-1 pl-4">
                {observaciones.map((observacion) => (
                  <li key={`pdf-hallazgo-${observacion.id}`}>
                    <strong>{observacion.vinculo} · {observacion.area}:</strong> {observacion.texto}
                  </li>
                ))}
              </ol>
            ) : notasPor("LAVADO").length > 0 ? null : (
              <p className="mt-1">No se registran hallazgos en las listas restrictivas consultadas.</p>
            )}
          </div>

          <h3 className="pdf-section border border-slate-800 mt-3 px-2 py-1 text-[10px] font-bold">3.2 Reporte Tributario - Sentinell</h3>
          <table className="mt-1 w-full border-collapse text-[9px]">
            <tbody>
              <tr>
                <td className="w-56 border border-slate-800 px-2 py-1 font-semibold">Reporte en centrales de riesgo</td>
                <td className="border border-slate-800 px-2 py-1">
                  {renderCheckbox(listaValor("central_riesgo_empresa"), "SI")} {renderCheckbox(listaValor("central_riesgo_empresa"), "NO")}
                  <span className="ml-4">Detallar: {detalleRiesgo}</span>
                </td>
              </tr>
              <tr>
                <td className="border border-slate-800 px-2 py-1 font-semibold">Beneficio mutuo</td>
                <td className="border border-slate-800 px-2 py-1">{renderCheckbox(datosEmpresa.beneficioMutuo, "SI")} {renderCheckbox(datosEmpresa.beneficioMutuo, "NO")}</td>
              </tr>
              <tr>
                <td className="border border-slate-800 px-2 py-1 font-semibold">Motivo de beneficio / evento</td>
                <td className="border border-slate-800 px-2 py-1">{datosEmpresa.eventoProyecto ?? exp.eventoProyecto ?? datosEmpresa.motivo ?? exp.motivo ?? "--"}</td>
              </tr>
              <tr>
                <td className="border border-slate-800 px-2 py-1 font-semibold">Solicitado de por</td>
                <td className="border border-slate-800 px-2 py-1">--</td>
              </tr>
            </tbody>
          </table>

          <div className="pdf-keep mt-4 break-before-page">
            <div className="border-b border-slate-800 pb-2">
              <p className="text-[9px] font-bold uppercase">EVALUACIÓN DEBIDA DILIGENCIA · {exp.empresaRazonSocial}</p>
              <p className="text-[8px] text-slate-600">FRM-LOG-104 · Versión 01 · Página 2</p>
            </div>
            <h2 className="pdf-section border border-slate-800 mt-3 px-2 py-1 text-[11px] font-bold">5. Evaluación Final</h2>
            <div className="mt-1 border border-slate-800 p-2 text-[9px]">
              <p><strong>Recomendación:</strong></p>
              <p className="mt-1">
                {renderOpcion(final === DD_MATRIZ_RESULTADOS_FINALES.APTO, "Aceptar")}{" "}
                {renderOpcion(final === DD_MATRIZ_RESULTADOS_FINALES.NO_APTO, "Rechazar")}{" "}
                {renderOpcion(final !== null && final !== DD_MATRIZ_RESULTADOS_FINALES.APTO && final !== DD_MATRIZ_RESULTADOS_FINALES.NO_APTO, "Requiere reforzar la revisión")}
              </p>
              {empresa.finalComentario ? <p className="mt-2"><strong>Sustento:</strong> {empresa.finalComentario}</p> : null}
              {empresa.finalPor || empresa.finalFecha ? (
                <p className="mt-1 text-[8px]">
                  {empresa.finalPor ?? "Registrado"} {empresa.finalFecha ? `· ${dateUtils.formatDateTime(empresa.finalFecha)}` : ""}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-4">
            <h2 className="pdf-section border border-slate-800 mt-3 px-2 py-1 text-[11px] font-bold">6. Observaciones y Conclusiones:</h2>
            <table className="mt-1 w-full border-collapse text-[9px]">
              <tbody>
                <tr><td className="pdf-subsection border border-slate-800 px-2 py-1 font-bold">Registros de PEP</td></tr>
                <tr><td className="border border-slate-800 px-2 py-1">
                  {notasPor("PEP").length > 0 ? (
                    <NotasEvidencia notas={notasPor("PEP")} />
                  ) : listaValor("peps_prp_empresa") === "si" ? "Registra antecedentes" : "No hay antecedentes"}
                </td></tr>
                <tr><td className="pdf-subsection border border-slate-800 px-2 py-1 font-bold">OEFA</td></tr>
                <tr><td className="border border-slate-800 px-2 py-1">
                  {notasPor("OEFA").length > 0 ? (
                    <NotasEvidencia notas={notasPor("OEFA")} />
                  ) : listaValor("oefa") === "si" ? "Registra antecedentes" : "No hay antecedentes"}
                </td></tr>
                <tr><td className="pdf-subsection border border-slate-800 px-2 py-1 font-bold">OSCE</td></tr>
                <tr><td className="border border-slate-800 px-2 py-1">
                  {notasPor("OSCE").length > 0 ? (
                    <NotasEvidencia notas={notasPor("OSCE")} />
                  ) : listaValor("osce") === "si" ? "Registra antecedentes" : "No hay antecedentes"}
                </td></tr>
                <tr><td className="pdf-subsection border border-slate-800 px-2 py-1 font-bold">INDECOPI</td></tr>
                <tr><td className="border border-slate-800 px-2 py-1">
                  {notasPor("INDECOPI").length > 0 ? <NotasEvidencia notas={notasPor("INDECOPI")} /> : null}
                  {casosReputacionPdf.length > 0 ? (
                    <ol className="list-decimal space-y-1 pl-4">
                      {casosReputacionPdf.map((caso) => {
                        const resultado = caso.resultado
                          ? DD_REPUTACION_RESULTADO_LABELS[caso.resultado] ?? caso.resultado
                          : "Pendiente";
                        return (
                          <li key={`pdf-indecopi-${caso.id}`}>
                            <p className="font-semibold">{caso.nombreARevisar}: {resultado}</p>
                            {caso.comentario ? <p>{caso.comentario}</p> : null}
                          </li>
                        );
                      })}
                    </ol>
                  ) : listaValor("indecopi") === "si" ? (
                    "Registra antecedentes"
                  ) : (
                    "No hay antecedentes"
                  )}
                </td></tr>
                <tr><td className="pdf-subsection border border-slate-800 px-2 py-1 font-bold">OTROS</td></tr>
                <tr><td className="border border-slate-800 px-2 py-1">
                  <NotasEvidencia notas={notasPor("OTROS")} />
                  {tieneLegal
                    ? `${expediente?.decisionLegal ?? "Pendiente"}${expediente?.motivoLegal ? ` · ${expediente.motivoLegal}` : ""}`
                    : notasPor("OTROS").length > 0 ? null : "No hay antecedentes"}
                </td></tr>
              </tbody>
            </table>
          </div>

          <div className="pdf-keep mt-3">
            <h2 className="pdf-section border border-slate-800 mt-3 px-2 py-1 text-[11px] font-bold">Conclusiones</h2>
            <div className="border border-slate-800 p-3 text-[9px]">
              <p>
                {empresa.finalComentario ??
                  (final
                    ? `La evaluación consolidada de ${exp.empresaRazonSocial} concluye con resultado ${finalLabel}.`
                    : recibida
                      ? "Documentación recibida: el expediente aún no inicia la revisión de SIG."
                      : "El expediente se encuentra pendiente de conclusión final.")}
              </p>
            </div>
          </div>

          <div className="pdf-keep mt-4">
            <h2 className="pdf-section border border-slate-800 mt-4 px-2 py-1 text-[11px] font-bold">Anexos</h2>
            <div className="mt-1 border border-slate-800 p-2 text-[9px]">
              <p className="font-semibold">SENTINELL</p>
              {documentosBase.map((documento, indice) => (
                <p key={`pdf-doc-${documento.id}`}>{indice + 1}. {documento.nombre}</p>
              ))}
              {anexosPdf.map((anexo, indice) => (
                <p key={`pdf-anexo-${anexo.id}`}>{documentosBase.length + indice + 1}. {anexo.nombre}</p>
              ))}
              {documentosBase.length === 0 && anexosPdf.length === 0 ? <p>Sin documentos ni evidencias registradas.</p> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  etiqueta,
  valor,
  icono,
  avance,
  alerta,
}: {
  etiqueta: string;
  valor: React.ReactNode;
  icono: React.ReactNode;
  avance?: number;
  alerta?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 ${alerta ? "border-warning/40 bg-warning/5" : "border-border bg-secondary/20"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
        <span className={alerta ? "text-warning" : "text-primary"}>{icono}</span>
      </div>
      <p className="mt-1 text-2xl font-bold leading-none text-foreground">{valor}</p>
      {avance !== undefined ? <Progress value={avance} className="mt-2 h-1.5" /> : null}
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
