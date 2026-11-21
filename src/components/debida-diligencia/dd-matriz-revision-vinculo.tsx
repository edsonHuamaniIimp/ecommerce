"use client";

import { useCallback, useEffect, useState } from "react";
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
  ArrowLeft,
  BriefcaseBusiness,
  ClipboardList,
  ExternalLink,
  FileText,
  Globe2,
  Pencil,

  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import type {
  DdMatrizBloqueDTO,
  DdMatrizEvaluacionDetalleDTO,
} from "@/types/dto/debida-diligencia";
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
  DD_MATRIZ_TIPO_VINCULO_LABELS,
  DD_MATRIZ_TIPOS_VINCULO,
  DD_RUTAS,
  type DdMatrizTipoVinculo,
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

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{etiqueta}</dt>
      <dd className="text-xs font-medium text-foreground">{children}</dd>
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
    <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border pb-3">
      <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">{icono}</span>
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
    <div className="rounded-lg border border-border bg-secondary/30 p-3">
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

  if (loading || !detalle) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const tipo = DD_MATRIZ_TIPO_VINCULO_LABELS[detalle.tipo as DdMatrizTipoVinculo] ?? detalle.tipo;
  const esEmpresa = detalle.tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Link href={DD_RUTAS.MATRIZ} className="hover:text-primary">Matriz de evaluación DD</Link>
        <span>/</span>
        <span>Detalle de vínculo</span>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <DdPaisBandera pais={detalle.pais} />
              <h1 className="truncate text-xl font-bold tracking-tight text-foreground">{detalle.nombre}</h1>
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
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setRevisionAbierta(true)}>
              <FileText className="h-3.5 w-3.5" /><span>Revisar expediente</span>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Link href={`${DD_RUTAS.INFORMES}/${detalle.expediente.expedienteId}`}>
                <FileText className="h-3.5 w-3.5" /><span>Ver informe</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Link href={DD_RUTAS.MATRIZ}><ArrowLeft className="h-3.5 w-3.5" /><span>Volver a Matriz</span></Link>
            </Button>
            {onEditar ? (
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onEditar}>
                <Pencil className="h-3.5 w-3.5" /><span>Editar evaluación</span>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <TituloSeccion icono={<BriefcaseBusiness className="h-4 w-4" />}>1. Datos generales de la empresa</TituloSeccion>
          <CardContent className="space-y-3 pt-4">
            <Dato etiqueta="Razón social">{valor(detalle.expediente.empresaRazonSocial)}</Dato>
            <Dato etiqueta="RUC">{valor(detalle.expediente.empresaRuc)}</Dato>
            <Dato etiqueta="País de constitución">{detalle.expediente.paisConstitucion ? nombrePais(detalle.expediente.paisConstitucion) : "Perú"}</Dato>
            <Dato etiqueta="Actividad económica">{valor(detalle.generales.actividadEconomica ?? detalle.expediente.actividadEconomica)}</Dato>
            <Dato etiqueta="Motivo de evaluación">{valor(detalle.generales.motivo ?? detalle.expediente.motivo)}</Dato>
            <Dato etiqueta="Evento / proyecto">{valor(detalle.generales.eventoProyecto ?? detalle.expediente.eventoProyecto)}</Dato>
            <Dato etiqueta="Estado del contribuyente">{valor(detalle.generales.estadoContribuyente)}</Dato>
            <Dato etiqueta="Dirección legal">{valor(detalle.generales.direccionLegal)}</Dato>
          </CardContent>
        </Card>

        {!esEmpresa ? (
          <Card>
            <TituloSeccion icono={<UserRound className="h-4 w-4" />}>2. Persona o entidad vinculada</TituloSeccion>
            <CardContent className="space-y-3 pt-4">
              <Dato etiqueta="Nombre completo">{valor(detalle.nombre)}</Dato>
              <Dato etiqueta="Tipo de documento">{valor(detalle.tipoDocumento)}</Dato>
              <Dato etiqueta="Número de documento">{valor(detalle.documento)}</Dato>
              <Dato etiqueta="Nacionalidad">{valor(detalle.nacionalidad)}</Dato>
              <Dato etiqueta="Cargo principal">{valor(detalle.cargo)}</Dato>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <TituloSeccion icono={<Globe2 className="h-4 w-4" />}>3. País y ámbito</TituloSeccion>
          <CardContent className="space-y-3 pt-4">
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
          extra="Evaluación cruzada automatizada"
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
                  <tr key={lista.codigo} className="hover:bg-secondary/20">
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
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${colorResultadoLista(lista.valor)}`}>
                        {lista.valor ? (SI_NO_NA_LABELS[lista.valor] ?? lista.valor) : lista.codigo === DD_MATRIZ_LISTA_OTROS ? "Opcional" : "Pendiente"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-muted-foreground">
                      {observacionLista(lista.valor)}
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
        />
      ) : null}

    </div>
  );
}




