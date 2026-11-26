"use client";

import { etiquetaTipoVinculo } from "@/lib/shared/utils/dd-matriz-vinculo-vista";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Progress,
} from "@nrivera-iimp/ui-kit-iimp";
import {
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  Globe2,
  MinusCircle,
  Pencil,
  Clock3,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import type {
  DdMatrizBloqueDTO,
  DdMatrizEvaluacionDetalleDTO,
} from "@/types/dto/debida-diligencia";
import { DdVinculoResumen } from "./dd-vinculo-resumen";
import { DdVinculoSkeleton } from "./dd-vinculo-skeleton";
import { DdVinculoSwitcher } from "./dd-vinculo-switcher";
import { DdPaisBandera } from "./dd-pais-bandera";
import { DdRevisionModal } from "./dd-revision-modal";
import { ddMatrizEvaluacionService } from "@/lib/client/api/services/dd-matriz-evaluacion-service";
import {
  DD_MATRIZ_AMBITO_LABELS,
  DD_MATRIZ_CONCLUSION_COMPLIANCE_LABELS,
  DD_MATRIZ_CONCLUSION_LABELS,
  DD_MATRIZ_ORIGENES,
  DD_MATRIZ_RESULTADO_LABELS,
  DD_MATRIZ_SI_NO_NA_LABELS,
  DD_MATRIZ_TIPOS_VINCULO,
  DD_RUTAS,
  DD_MATRIZ_LISTA_DESCRIPCIONES,
  DD_MATRIZ_LISTA_OTROS,
} from "@/lib/shared/constants";
import { urlFuenteLista } from "@/lib/shared/utils/dd-matriz-evaluacion";
import { nombrePais } from "@/lib/shared/utils/pais";

interface Props {
  id: string;
  onEditar?: () => void;
}

const AMBITO_LABELS: Record<string, string> = DD_MATRIZ_AMBITO_LABELS;
const SI_NO_NA_LABELS: Record<string, string> = DD_MATRIZ_SI_NO_NA_LABELS;

const valor = (texto: string | null | undefined, reemplazo = "No registrado") =>
  texto?.trim() || reemplazo;

function Dato({ etiqueta, children, ancho }: { etiqueta: string; children: React.ReactNode; ancho?: boolean }) {
  return (
    <div className={`space-y-0.5 ${ancho ? "sm:col-span-2" : ""}`}>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{etiqueta}</dt>
      <dd className="break-words text-xs font-medium text-foreground">{children}</dd>
    </div>
  );
}

function TituloSeccion({
  icono,
  children,
  extra,
}: {
  icono: React.ReactNode;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <CardHeader className="flex flex-row items-center justify-between gap-2 rounded-t-xl border-b border-border bg-secondary/30 pb-3">
      <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">{icono}</span>
        <span>{children}</span>
      </CardTitle>
      {extra ? <div className="text-[10px] text-muted-foreground">{extra}</div> : null}
    </CardHeader>
  );
}

function colorResultadoLista(resultado: string | null): string {
  if (resultado === "si") return "border-red-200 bg-red-50 text-red-800";
  if (resultado === "no") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function PildoraLista({ valor, vacio }: { valor: string | null; vacio: string }) {
  const Icono = valor === "si" ? AlertTriangle : valor === "no" ? CheckCircle2 : valor === "na" ? MinusCircle : Clock3;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${colorResultadoLista(valor)}`}>
      <Icono className="h-3 w-3" />
      <span>{valor ? (SI_NO_NA_LABELS[valor] ?? valor) : vacio}</span>
    </span>
  );
}

function observacionLista(resultado: string | null): string {
  if (resultado === "na") return "No aplica para el ámbito.";
  if (resultado === "si") return "Coincidencia registrada; requiere revisión y sustento.";
  if (resultado === "no") return "Sin antecedentes registrados en la fuente consultada.";
  return "Pendiente de evaluación.";
}

function etiquetaConclusion(
  bloque: DdMatrizBloqueDTO,
  catalogo: Record<string, string>,
  reemplazo: string,
): string {
  const conclusion = bloque.conclusion ? (catalogo[bloque.conclusion] ?? bloque.conclusion) : null;
  return bloque.observaciones?.trim() || conclusion || reemplazo;
}

function cajaConclusion(
  titulo: string,
  bloque: DdMatrizBloqueDTO,
  catalogo: Record<string, string>,
): React.ReactNode {
  const resultado = bloque.resultado
    ? ((DD_MATRIZ_RESULTADO_LABELS as Record<string, string>)[bloque.resultado] ?? bloque.resultado)
    : null;
  return (
    <div className={`rounded-lg border border-l-4 border-border bg-secondary/30 p-3 ${bloque.resultado === "observado" ? "border-l-amber-400" : bloque.resultado ? "border-l-emerald-400" : "border-l-slate-300"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">{titulo}</p>
        {resultado ? (
          <Badge className={`pointer-events-none text-[9px] ${bloque.resultado === "observado" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
            <span>{resultado}</span>
          </Badge>
        ) : null}
      </div>
      <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
        {etiquetaConclusion(bloque, catalogo, "Pendiente de evaluación.")}
      </p>
      {bloque.responsable ? (
        <p className="mt-1 text-[9px] text-muted-foreground">Responsable: {bloque.responsable}</p>
      ) : null}
    </div>
  );
}

/** Revisión de un vínculo con la estructura de la pantalla "Detalle de vínculo NACIONAL" del Stitch. */
export function DdMatrizRevisionVinculo({ id, onEditar }: Props) {
  const [detalle, setDetalle] = useState<DdMatrizEvaluacionDetalleDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [revisionAbierta, setRevisionAbierta] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const actualizado = await ddMatrizEvaluacionService.detalle(id);
      setDetalle(actualizado);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar el vínculo");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, [cargar]);

  if (loading || !detalle || detalle.id !== id) return <DdVinculoSkeleton modo="lectura" />;

  const tipo = etiquetaTipoVinculo(detalle);
  const esEmpresa = detalle.tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA;
  const criterios = detalle.listas.filter((lista) => lista.codigo !== DD_MATRIZ_LISTA_OTROS);
  const aplicables = criterios.length;
  const evaluadas = criterios.filter((lista) => Boolean(lista.valor)).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Link href={DD_RUTAS.MATRIZ} className="hover:text-primary">Matriz de evaluación DD</Link>
        <span>/</span>
        <span>Detalle de vínculo</span>
      </div>

      <Card className="border-l-4 border-l-primary">
        <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0 flex-1 basis-72">
            <div className="flex items-center gap-3">
              <DdPaisBandera pais={detalle.pais} />
              <h1 className="min-w-0 truncate text-xl font-bold tracking-tight text-foreground">{detalle.nombre}</h1>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge className="pointer-events-none border-primary/20 bg-primary/10 text-[9px] text-primary"><span>{tipo}</span></Badge>
              <Badge className="pointer-events-none text-[9px]"><span>{AMBITO_LABELS[detalle.ambito] ?? detalle.ambito}</span></Badge>
              <Badge className="pointer-events-none text-[9px]">
                <span>{detalle.origen === DD_MATRIZ_ORIGENES.MANUAL ? "Manual" : "Automático"}</span>
              </Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {detalle.expediente.empresaRazonSocial} · {detalle.expediente.codigo}
            </p>
            <DdVinculoResumen detalle={detalle} />
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" title="Revisar expediente" onClick={() => setRevisionAbierta(true)}>
              <FileText className="h-3.5 w-3.5" /><span>Expediente</span>
            </Button>
            <DdVinculoSwitcher expedienteId={detalle.expediente.expedienteId} actualId={detalle.id} />
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs" title="Ver informe">
              <Link href={`${DD_RUTAS.INFORMES}/${detalle.expediente.expedienteId}`}>
                <FileText className="h-3.5 w-3.5" /><span>Informe</span>
              </Link>
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" title="Revisar debida diligencia del expediente" onClick={() => setRevisionAbierta(true)}>
              <ArrowLeft className="h-3.5 w-3.5" /><span>Matriz</span>
            </Button>
            {onEditar ? (
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" title="Editar evaluación" onClick={onEditar}>
                <Pencil className="h-3.5 w-3.5" /><span>Editar</span>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <TituloSeccion icono={<BriefcaseBusiness className="h-4 w-4" />}>1. Datos generales de la empresa</TituloSeccion>
          <CardContent className="grid gap-x-4 gap-y-3 pt-4 sm:grid-cols-2">
            <Dato etiqueta="Razón social" ancho>{valor(detalle.expediente.empresaRazonSocial)}</Dato>
            <Dato etiqueta="RUC">{valor(detalle.expediente.empresaRuc)}</Dato>
            <Dato etiqueta="País de constitución">{detalle.expediente.paisConstitucion ? nombrePais(detalle.expediente.paisConstitucion) : "Perú"}</Dato>
            <Dato etiqueta="Actividad económica" ancho>{valor(detalle.generales.actividadEconomica ?? detalle.expediente.actividadEconomica)}</Dato>
            <Dato etiqueta="Motivo de evaluación" ancho>{valor(detalle.generales.motivo ?? detalle.expediente.motivo)}</Dato>
            <Dato etiqueta="Evento / proyecto" ancho>{valor(detalle.generales.eventoProyecto ?? detalle.expediente.eventoProyecto)}</Dato>
            <Dato etiqueta="Estado del contribuyente">{valor(detalle.generales.estadoContribuyente)}</Dato>
            <Dato etiqueta="Dirección legal" ancho>{valor(detalle.generales.direccionLegal)}</Dato>
          </CardContent>
        </Card>

        {!esEmpresa ? (
          <Card>
            <TituloSeccion icono={<UserRound className="h-4 w-4" />}>2. Persona o entidad vinculada</TituloSeccion>
            <CardContent className="grid gap-x-4 gap-y-3 pt-4 sm:grid-cols-2">
              <Dato etiqueta="Nombre completo" ancho>{valor(detalle.nombre)}</Dato>
              <Dato etiqueta="Tipo de documento">{valor(detalle.tipoDocumento)}</Dato>
              <Dato etiqueta="Número de documento">{valor(detalle.documento)}</Dato>
              <Dato etiqueta="Nacionalidad">{valor(detalle.nacionalidad)}</Dato>
              <Dato etiqueta="Cargo principal">{valor(detalle.cargo)}</Dato>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <TituloSeccion icono={<Globe2 className="h-4 w-4" />}>3. País y ámbito</TituloSeccion>
          <CardContent className="grid gap-x-4 gap-y-3 pt-4 sm:grid-cols-2">
            <Dato etiqueta="País de origen">{detalle.pais ? nombrePais(detalle.pais) : "Sin registrar"}</Dato>
            <Dato etiqueta="Ámbito geográfico">{AMBITO_LABELS[detalle.ambito] ?? detalle.ambito}</Dato>
            <Dato etiqueta="Origen del dato">
              {detalle.paisEditado || detalle.ambitoEditado ? "Corregido manualmente" : "Derivado automáticamente"}
            </Dato>
            <Dato etiqueta="Clasificación de riesgo">No registrada</Dato>
          </CardContent>
        </Card>
      </div>

      <Card>
        <TituloSeccion
          icono={<ClipboardList className="h-4 w-4" />}
          extra={
            <span className="flex items-center gap-2">
              <span>{evaluadas} de {aplicables} evaluados</span>
              <Progress value={aplicables > 0 ? (evaluadas / aplicables) * 100 : 0} className="h-1.5 w-24" />
            </span>
          }
        >
          4. Listas restrictivas — criterios aplicables para ámbito {AMBITO_LABELS[detalle.ambito] ?? detalle.ambito}
        </TituloSeccion>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-secondary/50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Criterio de evaluación</th>
                  <th className="w-36 px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Resultado</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Observaciones / evidencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {detalle.listas.map((lista) => (
                  <tr key={lista.codigo} className={`transition-colors hover:bg-secondary/30 ${lista.valor === "si" ? "bg-red-50/40" : "even:bg-secondary/10"}`}>
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      <span>{lista.label}</span>
                      {DD_MATRIZ_LISTA_DESCRIPCIONES[lista.codigo] ? (
                        <span className="mt-0.5 block text-[10px] font-normal leading-snug text-muted-foreground">
                          {DD_MATRIZ_LISTA_DESCRIPCIONES[lista.codigo]}
                        </span>
                      ) : null}
                      {(() => {
                        const fuenteUrl = urlFuenteLista(lista.codigo, detalle.nombre, detalle.documento);
                        return fuenteUrl ? (
                          <a
                            href={fuenteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>Consultar fuente</span>
                          </a>
                        ) : null;
                      })()}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <PildoraLista valor={lista.valor} vacio={lista.codigo === DD_MATRIZ_LISTA_OTROS ? "Opcional" : "Pendiente"} />
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-muted-foreground">
                      {lista.observacion?.trim() ? (
                        /* Observacion del criterio registrada por SIG (sustento de un SI). */
                        <span className="block max-h-40 overflow-y-auto whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]">
                          {lista.observacion}
                        </span>
                      ) : (
                        observacionLista(lista.valor)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <TituloSeccion icono={<FileText className="h-4 w-4" />}>5. Conclusiones y dictamen</TituloSeccion>
        <CardContent className="space-y-4 pt-4">
          <div className="grid gap-3 md:grid-cols-2">
            {cajaConclusion("Conclusiones SIG (Logística)", detalle.sig, DD_MATRIZ_CONCLUSION_LABELS)}
            {cajaConclusion("Conclusiones reputacional (Comunicaciones)", detalle.reputacional, DD_MATRIZ_CONCLUSION_LABELS)}
            {cajaConclusion("Conclusiones Compliance (Legal)", detalle.compliance, DD_MATRIZ_CONCLUSION_COMPLIANCE_LABELS)}
          </div>

        </CardContent>
      </Card>

      {revisionAbierta ? (
        <DdRevisionModal
          fila={{
            id: detalle.expediente.expedienteId,
            codigo: detalle.expediente.codigo,
            estado: detalle.expediente.estado,
            empresa: {
              razonSocial: detalle.expediente.empresaRazonSocial,
              ruc: detalle.expediente.empresaRuc,
            },
          }}
          puedeMatriz
          onClose={() => setRevisionAbierta(false)}
          onDone={() => { void cargar(); }}
          onResultadoFinal={(resultado, comentario, cierre) =>
            ddMatrizEvaluacionService.registrarResultadoFinal(detalle.expediente.expedienteId, resultado, comentario, cierre)
          }
        />
      ) : null}

    </div>
  );
}




