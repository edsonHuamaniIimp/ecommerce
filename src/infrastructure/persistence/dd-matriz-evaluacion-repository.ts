import "server-only";

import { prisma } from "@/lib/server/db";
import type { Prisma } from "@prisma/client";
import { normalizarTexto } from "@/lib/shared/utils/normalizar-texto";
import type {
  DdMatrizAdjuntoCreacion,
  DdMatrizAdjuntoEntity,
  DdMatrizBloque,
  DdMatrizExpedienteContexto,
  DdMatrizExportarParams,
  DdMatrizExportItem,
  DdMatrizFilaEntity,
  DdMatrizListarParams,
  DdMatrizConteo,
  DdMatrizListarResult,
  DdMatrizResumenEntity,
  DdMatrizListasValor,
  DdMatrizVinculoCambios,
  DdMatrizVinculoEntity,
  DdMatrizVinculoManual,
} from "@/domain/models/dd-matriz-evaluacion";
import type { IDdMatrizEvaluacionRepository } from "@/domain/ports/dd-matriz-evaluacion-repository";
import {
  DD_AUDITORIA_TIPO,
  DD_ESTADOS,
  DD_MATRIZ_CONCLUSIONES,
  DD_MATRIZ_ORIGENES,
  DD_MATRIZ_RESULTADOS_FINALES,
  DD_MATRIZ_TIPOS_VINCULO,
  DD_MATRIZ_TIPO_VINCULO_LABELS,
  DD_REPUTACION_ESTADOS,
  DD_TIPOS_DOCUMENTO_REPRESENTANTE,
  DD_TIPOS_DOCUMENTO_VINCULO,
  DD_TIPOS_VINCULO_PERSONA,
  DD_TIPO_VINCULO_PERSONA_LABELS,
  DD_VINCULO_LABELS,
  DD_VINCULOS_PERSONA_CON_PORCENTAJE,
  TIPOS_DOCUMENTO,
  TIPOS_EVENTO_LABELS,
  type DdMatrizAdjuntoCategoria,
  type DdMatrizAmbito,
  type DdMatrizOrigen,
  type DdMatrizTipoVinculo,
} from "@/lib/shared/constants";
import {
  derivarAmbito,
  estadoExpedienteDeResultadoFinal,
  resultadoFinalEfectivo,
  resolverPais,
} from "@/lib/shared/utils/dd-matriz-evaluacion";
import { esPaisNacional, paisDeTexto } from "@/lib/shared/utils/pais";
import { tipoDocumentoEmpresaVinculada } from "@/lib/shared/utils/debida-diligencia-v2";

/** Tamano de lote al crear filas automaticas. */
const LOTE_CREACION = 500;

const include = {
  expediente: {
    select: {
      id: true,
      codigo: true,
      estado: true,
      paisConstitucion: true,
      actividadEconomica: true,
      tipoRelacionComercial: true,
      motivoImportacion: true,
      eventoProyecto: true,
      fechaEnvio: true,
      createdAt: true,
      revisadoPor: true,
      fechaRevision: true,
      decisionLegal: true,
      evento: { select: { id: true, tipoEvento: true, codigoEvento: true, anio: true } },
      empresa: { select: { razonSocial: true, ruc: true, direccionFiscal: true, pais: true, actividadEconomica: true } },
    },
  },
} satisfies Prisma.DdMatrizVinculoInclude;

type VinculoRow = Prisma.DdMatrizVinculoGetPayload<{ include: typeof include }>;

interface FilaDeseada {
  expedienteId: string;
  tipo: DdMatrizTipoVinculo;
  refKey: string;
  nombre: string;
  tipoDocumento: string | null;
  documento: string | null;
  nacionalidad: string | null;
  cargo: string | null;
  ambito: DdMatrizAmbito;
  pais: string | null;
  direccionLegal: string | null;
  estadoContribuyente: string | null;
  actividadEconomica: string | null;
  motivo: string | null;
  eventoProyecto: string | null;
}

/** Tipo de documento declarado por el beneficiario, segun su numero. */
function tipoDocumentoBeneficiario(documento: string): string | null {
  const valor = documento.trim();
  if (/^\d{11}$/.test(valor)) return TIPOS_DOCUMENTO.RUC;
  if (/^\d{8}$/.test(valor)) return TIPOS_DOCUMENTO.DNI;
  if (/^CE/i.test(valor)) return DD_TIPOS_DOCUMENTO_REPRESENTANTE.CARNE_EXTRANJERIA;
  if (/^PAS/i.test(valor)) return DD_TIPOS_DOCUMENTO_REPRESENTANTE.PASAPORTE;
  return null;
}

function mapContexto(row: VinculoRow["expediente"]): DdMatrizExpedienteContexto {
  return {
    expedienteId: row.id,
    eventoId: row.evento.id,
    eventoLabel: `${TIPOS_EVENTO_LABELS[row.evento.tipoEvento] ?? "Evento"} ${row.evento.anio}`,
    codigo: row.codigo,
    estado: row.estado,
    empresaRazonSocial: row.empresa.razonSocial,
    empresaRuc: row.empresa.ruc,
    empresaDireccionFiscal: row.empresa.direccionFiscal ?? null,
    empresaPais: row.empresa.pais,
    paisConstitucion: row.paisConstitucion ?? null,
    actividadEconomica: row.actividadEconomica ?? row.empresa.actividadEconomica ?? null,
    tipoRelacionComercial: row.tipoRelacionComercial,
    motivo:
      row.motivoImportacion ??
      row.tipoRelacionComercial
        .map((vinculo) => DD_VINCULO_LABELS[vinculo] ?? vinculo)
        .join(", "),
    eventoProyecto: row.eventoProyecto ?? null,
    fechaIngreso: row.fechaEnvio ?? row.createdAt,
    revisadoPor: row.revisadoPor ?? null,
    fechaRevision: row.fechaRevision ?? null,
    decisionLegal: row.decisionLegal ?? null,
  };
}

function bloque(
  fecha: Date | null,
  responsable: string | null,
  resultado: string | null,
  observaciones: string | null,
  conclusion: string | null,
): DdMatrizBloque {
  return { fecha, responsable, resultado, observaciones, conclusion };
}

function mapVinculo(row: VinculoRow): DdMatrizVinculoEntity {
  return {
    id: row.id,
    tipo: row.tipo as DdMatrizTipoVinculo,
    refKey: row.refKey,
    origen: row.origen as DdMatrizOrigen,
    nombre: row.nombre,
    tipoDocumento: row.tipoDocumento,
    documento: row.documento,
    nacionalidad: row.nacionalidad,
    cargo: row.cargo,
    ambito: row.ambito as DdMatrizAmbito,
    ambitoEditado: row.ambitoEditado,
    pais: row.pais,
    paisEditado: row.paisEditado,
    identidadEditada: row.identidadEditada,
    fechaInicioActividades: row.fechaInicioActividades,
    estadoContribuyente: row.estadoContribuyente,
    direccionLegal: row.direccionLegal,
    actividadEconomica: row.actividadEconomica,
    motivo: row.motivo,
    eventoProyecto: row.eventoProyecto,
    historialIimp: row.historialIimp,
    beneficioMutuo: row.beneficioMutuo,
    listas: (row.listas ?? {}) as DdMatrizListasValor,
    sig: bloque(row.sigFecha, row.sigResponsable, row.sigResultado, row.sigObservaciones, row.sigConclusion),
    reputacional: bloque(row.repFecha, row.repResponsable, row.repResultado, row.repObservaciones, row.repConclusion),
    compliance: bloque(row.cmpFecha, row.cmpResponsable, row.cmpResultado, row.cmpObservaciones, row.cmpConclusion),
    resultadoFinal: row.resultadoFinal,
    finalFecha: row.finalFecha,
    finalPor: row.finalPor,
    finalComentario: row.finalComentario,
    creadoPor: row.creadoPor,
    actualizadoPor: row.actualizadoPor,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    expediente: mapContexto(row.expediente),
  };
}

interface CasoReputacionLegacy {
  nombreARevisar: string;
  resultado: string | null;
  fechaCierre: Date | null;
}

async function casosReputacionLegacy(expedienteId: string): Promise<CasoReputacionLegacy[]> {
  return prisma.debidaDiligenciaReputacion.findMany({
    where: { expedienteId, vinculoId: null },
    select: { nombreARevisar: true, resultado: true, fechaCierre: true },
    orderBy: { updatedAt: "desc" },
  });
}

function aplicarReputacionLegacy(
  vinculo: DdMatrizVinculoEntity,
  casos: CasoReputacionLegacy[],
): DdMatrizVinculoEntity {
  if (vinculo.reputacional.resultado) return vinculo;
  const legacy = casos.find(
    (caso) =>
      caso.resultado && normalizarTexto(caso.nombreARevisar) === normalizarTexto(vinculo.nombre),
  );
  if (!legacy) return vinculo;
  return {
    ...vinculo,
    reputacional: {
      ...vinculo.reputacional,
      resultado: legacy.resultado,
      fecha: vinculo.reputacional.fecha ?? legacy.fechaCierre,
    },
  };
}

interface ReputacionConteo {
  casos: number;
  pendientes: number;
  enAnalisis: number;
  conHallazgos: number;
  resultado: string | null;
  fecha: Date | null;
}

const SIN_REPUTACION: ReputacionConteo = {
  casos: 0,
  pendientes: 0,
  enAnalisis: 0,
  conHallazgos: 0,
  resultado: null,
  fecha: null,
};

function sumarCaso(
  conteo: ReputacionConteo,
  estado: string,
  resultado: string | null,
  fecha: Date | null,
): void {
  conteo.casos += 1;
  if (
    estado === DD_REPUTACION_ESTADOS.POR_REVISAR ||
    estado === DD_REPUTACION_ESTADOS.EN_ANALISIS
  ) {
    conteo.pendientes += 1;
  }
  if (estado === DD_REPUTACION_ESTADOS.EN_ANALISIS) conteo.enAnalisis += 1;
  if (
    estado === DD_REPUTACION_ESTADOS.CON_HALLAZGOS ||
    estado === DD_REPUTACION_ESTADOS.REQUIERE_INFORMACION
  ) {
    conteo.conHallazgos += 1;
  }
  if (resultado) conteo.resultado = resultado;
  if (fecha && (!conteo.fecha || fecha > conteo.fecha)) conteo.fecha = fecha;
}

async function contarReputacion(
  filas: { id: string; expedienteId: string; nombre: string }[],
): Promise<Map<string, ReputacionConteo>> {
  const conteos = new Map<string, ReputacionConteo>();
  if (filas.length === 0) return conteos;
  const expedienteIds = [...new Set(filas.map((fila) => fila.expedienteId))];

  const casos = await prisma.debidaDiligenciaReputacion.findMany({
    where: { expedienteId: { in: expedienteIds } },
    select: {
      expedienteId: true,
      vinculoId: true,
      nombreARevisar: true,
      estado: true,
      resultado: true,
      fechaCierre: true,
    },
  });
  const porVinculo = new Map<string, ReputacionConteo>();
  const legacyPorNombre = new Map<string, ReputacionConteo>();

  for (const caso of casos) {
    const clave = caso.vinculoId
      ? `v:${caso.vinculoId}`
      : `l:${caso.expedienteId}:${normalizarTexto(caso.nombreARevisar)}`;
    const destino = caso.vinculoId ? porVinculo : legacyPorNombre;
    const actual = destino.get(clave) ?? { ...SIN_REPUTACION };
    sumarCaso(actual, caso.estado, caso.resultado, caso.fechaCierre);
    destino.set(clave, actual);
  }

  for (const fila of filas) {
    const directo = porVinculo.get(`v:${fila.id}`);
    const legacy = legacyPorNombre.get(
      `l:${fila.expedienteId}:${normalizarTexto(fila.nombre)}`,
    );
    const conteo =
      directo?.resultado
        ? directo
        : legacy?.resultado
          ? legacy
          : directo ?? legacy ?? { ...SIN_REPUTACION };
    conteos.set(fila.id, { ...conteo });
  }
  return conteos;
}

function mapFila(row: VinculoRow, reputacion: ReputacionConteo = SIN_REPUTACION): DdMatrizFilaEntity {
  const ctx = mapContexto(row.expediente);
  return {
    id: row.id,
    tipo: row.tipo as DdMatrizTipoVinculo,
    origen: row.origen as DdMatrizOrigen,
    nombre: row.nombre,
    tipoDocumento: row.tipoDocumento,
    documento: row.documento,
    ambito: row.ambito as DdMatrizAmbito,
    pais: row.pais,
    cargo: row.cargo,
    sigResultado: row.sigResultado,
    sigConclusion: row.sigConclusion,
    sigFecha: row.sigFecha,
    repResultado: row.repResultado ?? reputacion.resultado,
    repConclusion: row.repConclusion,
    repFecha: row.repFecha ?? reputacion.fecha,
    cmpResultado: row.cmpResultado,
    cmpConclusion: row.cmpConclusion,
    cmpFecha: row.cmpFecha,
    resultadoFinal: row.resultadoFinal,
    finalFecha: row.finalFecha,
    reputacionCasos: reputacion.casos,
    reputacionPendientes: reputacion.pendientes,
    reputacionEnAnalisis: reputacion.enAnalisis,
    reputacionConHallazgos: reputacion.conHallazgos,
    updatedAt: row.updatedAt,
    expediente: {
      expedienteId: ctx.expedienteId,
      eventoId: ctx.eventoId,
      eventoLabel: ctx.eventoLabel,
      codigo: ctx.codigo,
      estado: ctx.estado,
      empresaRazonSocial: ctx.empresaRazonSocial,
      empresaRuc: ctx.empresaRuc,
      motivo: ctx.motivo,
      eventoProyecto: ctx.eventoProyecto,
      fechaIngreso: ctx.fechaIngreso,
    },
  };
}

function mapAdjunto(row: Prisma.DdMatrizAdjuntoGetPayload<object>): DdMatrizAdjuntoEntity {
  return {
    id: row.id,
    vinculoId: row.vinculoId,
    categoria: row.categoria as DdMatrizAdjuntoCategoria,
    nombre: row.nombre,
    url: row.url,
    mimeType: row.mimeType,
    tamano: row.tamano,
    creadoPor: row.creadoPor,
    createdAt: row.createdAt,
  };
}

function valorBloque<T extends Partial<DdMatrizBloque> | undefined>(
  cambios: T,
  prefijo: "sig" | "rep" | "cmp",
): Prisma.DdMatrizVinculoUpdateInput {
  if (!cambios) return {};
  const data: Record<string, unknown> = {};
  if (cambios.fecha !== undefined) data[`${prefijo}Fecha`] = cambios.fecha;
  if (cambios.responsable !== undefined) data[`${prefijo}Responsable`] = cambios.responsable;
  if (cambios.resultado !== undefined) data[`${prefijo}Resultado`] = cambios.resultado;
  if (cambios.observaciones !== undefined) data[`${prefijo}Observaciones`] = cambios.observaciones;
  if (cambios.conclusion !== undefined) data[`${prefijo}Conclusion`] = cambios.conclusion;
  return data as Prisma.DdMatrizVinculoUpdateInput;
}

/** Persistencia Prisma de la Matriz de evaluacion DD. */
export class DdMatrizEvaluacionPrismaRepository implements IDdMatrizEvaluacionRepository {
  async sincronizarEvento(eventoId: string, usuario: string): Promise<number> {
    const expedientes = await prisma.debidaDiligencia.findMany({
      where: { eventoId, estado: { not: DD_ESTADOS.BORRADOR } },
      select: {
        id: true,
        paisConstitucion: true,
        actividadEconomica: true,
        motivoImportacion: true,
        tipoRelacionComercial: true,
        eventoProyecto: true,
        representanteNombre: true,
        representanteTipoDocumento: true,
        representanteDocumento: true,
        representanteNacionalidad: true,
        empresa: {
          select: { razonSocial: true, ruc: true, direccionFiscal: true, pais: true, estadoContribuyente: true, actividadEconomica: true },
        },
        beneficiarios: {
          select: {
            id: true,
            nombre: true,
            documento: true,
            tipoDocumento: true,
            nacionalidad: true,
            porcentaje: true,
            tipoVinculoPersona: true,
          },
          orderBy: { orden: "asc" },
        },
      },
    });
    if (expedientes.length === 0) return 0;

    const deseadas: FilaDeseada[] = [];
    for (const exp of expedientes) {
      /* Una nacionalidad distinta de Peru gana: Empresa.pais nace en PE para todas las
       * empresas, mientras que el pais de constitucion del expediente lo declara el cliente. */
      const paisConstitucion = paisDeTexto(exp.paisConstitucion);
      const paisEmpresa =
        exp.empresa.pais && !esPaisNacional(exp.empresa.pais) ? exp.empresa.pais : (paisConstitucion ?? exp.empresa.pais);
      deseadas.push({
        expedienteId: exp.id,
        tipo: DD_MATRIZ_TIPOS_VINCULO.EMPRESA,
        refKey: DD_MATRIZ_TIPOS_VINCULO.EMPRESA,
        nombre: exp.empresa.razonSocial,
        tipoDocumento: "RUC",
        documento: exp.empresa.ruc,
        nacionalidad: exp.paisConstitucion,
        cargo: null,
        pais: paisEmpresa,
        ambito: derivarAmbito({ paisIso: paisEmpresa, tipoDocumento: "RUC" }),
        direccionLegal: exp.empresa.direccionFiscal ?? null,
        estadoContribuyente: exp.empresa.estadoContribuyente ?? null,
        actividadEconomica: exp.actividadEconomica ?? exp.empresa.actividadEconomica ?? null,
        motivo:
          exp.motivoImportacion ??
          exp.tipoRelacionComercial
            .map((vinculo) => DD_VINCULO_LABELS[vinculo] ?? vinculo)
            .join(", ") ??
          null,
        eventoProyecto: exp.eventoProyecto ?? null,
      });
      if (exp.representanteNombre?.trim()) {
        const pais = resolverPais({ nacionalidad: exp.representanteNacionalidad });
        deseadas.push({
          expedienteId: exp.id,
          tipo: DD_MATRIZ_TIPOS_VINCULO.REPRESENTANTE,
          refKey: DD_MATRIZ_TIPOS_VINCULO.REPRESENTANTE,
          nombre: exp.representanteNombre.trim(),
          tipoDocumento: exp.representanteTipoDocumento,
          documento: exp.representanteDocumento,
          nacionalidad: exp.representanteNacionalidad,
          cargo: DD_MATRIZ_TIPO_VINCULO_LABELS[DD_MATRIZ_TIPOS_VINCULO.REPRESENTANTE],
          pais,
          ambito: derivarAmbito({ paisIso: pais, tipoDocumento: exp.representanteTipoDocumento }),
          direccionLegal: null,
          estadoContribuyente: null,
          actividadEconomica: null,
          motivo: null,
          eventoProyecto: null,
        });
      }
      for (const b of exp.beneficiarios) {
        const pais = resolverPais({ nacionalidad: b.nacionalidad });
        const rol = b.tipoVinculoPersona ?? DD_TIPOS_VINCULO_PERSONA.BENEFICIARIO_FINAL;
        const empresaVinculada = rol === DD_TIPOS_VINCULO_PERSONA.EMPRESA_VINCULADA;
        const tipoDocumento = empresaVinculada
          ? tipoDocumentoEmpresaVinculada(b.nacionalidad)
          : b.tipoDocumento ?? tipoDocumentoBeneficiario(b.documento);
        const porcentajeAplica =
          DD_VINCULOS_PERSONA_CON_PORCENTAJE.includes(rol as (typeof DD_VINCULOS_PERSONA_CON_PORCENTAJE)[number]) &&
          Number(b.porcentaje) > 0;
        const cargoBase =
          DD_TIPO_VINCULO_PERSONA_LABELS[rol as keyof typeof DD_TIPO_VINCULO_PERSONA_LABELS] ??
          DD_MATRIZ_TIPO_VINCULO_LABELS[DD_MATRIZ_TIPOS_VINCULO.BENEFICIARIO];
        deseadas.push({
          expedienteId: exp.id,
          tipo: empresaVinculada
            ? DD_MATRIZ_TIPOS_VINCULO.VINCULADO
            : DD_MATRIZ_TIPOS_VINCULO.BENEFICIARIO,
          refKey: b.id,
          nombre: b.nombre,
          tipoDocumento,
          documento: b.documento,
          nacionalidad: b.nacionalidad,
          cargo: porcentajeAplica ? `${cargoBase} (${Number(b.porcentaje).toString()}%)` : cargoBase,
          pais,
          ambito: derivarAmbito({ paisIso: pais, tipoDocumento }),
          direccionLegal: null,
          estadoContribuyente: null,
          actividadEconomica: null,
          motivo: null,
          eventoProyecto: null,
        });
      }
    }

    const ids = expedientes.map((e) => e.id);
    const existentes = await prisma.ddMatrizVinculo.findMany({
      where: { expedienteId: { in: ids }, origen: DD_MATRIZ_ORIGENES.AUTOMATICO },
      select: {
        id: true,
        expedienteId: true,
        tipo: true,
        refKey: true,
        nombre: true,
        tipoDocumento: true,
        documento: true,
        nacionalidad: true,
        cargo: true,
        ambito: true,
        ambitoEditado: true,
        pais: true,
        paisEditado: true,
        direccionLegal: true,
        estadoContribuyente: true,
        actividadEconomica: true,
        motivo: true,
        eventoProyecto: true,
        identidadEditada: true,
        sigResultado: true,
        repResultado: true,
        cmpResultado: true,
        resultadoFinal: true,
      },
    });
    const clave = (expedienteId: string, tipo: string, refKey: string) => `${expedienteId}|${tipo}|${refKey}`;
    const claveRef = (expedienteId: string, refKey: string) => `${expedienteId}|${refKey}`;
    const porClave = new Map(existentes.map((e) => [clave(e.expedienteId, e.tipo, e.refKey), e]));
    const porRef = new Map(existentes.map((e) => [claveRef(e.expedienteId, e.refKey), e]));
    const clavesDeseadas = new Set(deseadas.map((d) => clave(d.expedienteId, d.tipo, d.refKey)));
    const refsDeseadas = new Set(deseadas.map((d) => claveRef(d.expedienteId, d.refKey)));

    const nuevas = deseadas.filter(
      (d) =>
        !porClave.has(clave(d.expedienteId, d.tipo, d.refKey)) &&
        !porRef.has(claveRef(d.expedienteId, d.refKey)),
    );
    const base = Date.now();
    let creadas = 0;
    for (let i = 0; i < nuevas.length; i += LOTE_CREACION) {
      const lote = nuevas.slice(i, i + LOTE_CREACION);
      const resultado = await prisma.ddMatrizVinculo.createMany({
        skipDuplicates: true,
        data: lote.map((d, indice) => ({
          expedienteId: d.expedienteId,
          tipo: d.tipo,
          refKey: d.refKey,
          origen: DD_MATRIZ_ORIGENES.AUTOMATICO,
          nombre: d.nombre,
          tipoDocumento: d.tipoDocumento,
          documento: d.documento,
          nacionalidad: d.nacionalidad,
          cargo: d.cargo,
          ambito: d.ambito,
          pais: d.pais,
          direccionLegal: d.direccionLegal,
          estadoContribuyente: d.estadoContribuyente,
          actividadEconomica: d.actividadEconomica,
          motivo: d.motivo,
          eventoProyecto: d.eventoProyecto,
          creadoPor: usuario,
          /* Escalonado para que la empresa salga antes que sus personas vinculadas. */
          createdAt: new Date(base + i + indice),
        })),
      });
      creadas += resultado.count;
    }

    /* Refresca las filas existentes. Lo corregido a mano por SIG (pais / ambito) se respeta;
     * direccion legal y estado de contribuyente solo se completan si siguen vacios. */
    const cambios = deseadas.flatMap((d) => {
      const actual =
        porClave.get(clave(d.expedienteId, d.tipo, d.refKey)) ??
        porRef.get(claveRef(d.expedienteId, d.refKey));
      if (!actual) return [];
      /* La identidad corregida por SIG se conserva; el resto se refresca desde el expediente. */
      const identidad = actual.identidadEditada
        ? {
            nombre: actual.nombre,
            tipoDocumento: actual.tipoDocumento,
            documento: actual.documento,
            nacionalidad: actual.nacionalidad,
            cargo: actual.cargo,
          }
        : {
            nombre: d.nombre,
            tipoDocumento: d.tipoDocumento,
            documento: d.documento,
            nacionalidad: d.nacionalidad,
            cargo: d.cargo,
          };
      const pais = actual.paisEditado ? actual.pais : d.pais;
      const ambito = actual.ambitoEditado
        ? (actual.ambito as DdMatrizAmbito)
        : actual.paisEditado
          ? derivarAmbito({ paisIso: actual.pais, tipoDocumento: identidad.tipoDocumento })
          : d.ambito;
      /* Datos generales: solo se completan si siguen vacios (lo escrito a mano manda). */
      const completados = {
        direccionLegal: actual.direccionLegal ?? d.direccionLegal,
        estadoContribuyente: actual.estadoContribuyente ?? d.estadoContribuyente,
        actividadEconomica: actual.actividadEconomica ?? d.actividadEconomica,
        motivo: actual.motivo ?? d.motivo,
        eventoProyecto: actual.eventoProyecto ?? d.eventoProyecto,
      };
      const igual =
        actual.tipo === d.tipo &&
        actual.nombre === identidad.nombre &&
        actual.tipoDocumento === identidad.tipoDocumento &&
        actual.documento === identidad.documento &&
        actual.nacionalidad === identidad.nacionalidad &&
        actual.cargo === identidad.cargo &&
        actual.ambito === ambito &&
        actual.pais === pais &&
        actual.direccionLegal === completados.direccionLegal &&
        actual.estadoContribuyente === completados.estadoContribuyente &&
        actual.actividadEconomica === completados.actividadEconomica &&
        actual.motivo === completados.motivo &&
        actual.eventoProyecto === completados.eventoProyecto;
      return igual
        ? []
        : [
            prisma.ddMatrizVinculo.update({
              where: { id: actual.id },
              data: {
                ...(actual.tipo !== d.tipo ? { tipo: d.tipo } : {}),
                ...identidad,
                ambito,
                pais,
                ...completados,
              },
            }),
          ];
    });
    if (cambios.length > 0) await prisma.$transaction(cambios);

    /* Filas automaticas cuyo origen desaparecio (p. ej. beneficiario retirado): se quitan
     * solo si nadie registro evaluacion en ellas. */
    const obsoletas = existentes
      .filter((e) => !clavesDeseadas.has(clave(e.expedienteId, e.tipo, e.refKey)))
      .filter((e) => !refsDeseadas.has(claveRef(e.expedienteId, e.refKey)))
      .filter((e) => !e.sigResultado && !e.repResultado && !e.cmpResultado && !e.resultadoFinal)
      .map((e) => e.id);
    if (obsoletas.length > 0) await prisma.ddMatrizVinculo.deleteMany({ where: { id: { in: obsoletas } } });

    return creadas;
  }

  async sincronizarTodosEventos(usuario: string): Promise<number> {
    const eventos = await prisma.debidaDiligencia.findMany({
      where: { estado: { not: DD_ESTADOS.BORRADOR } },
      select: { eventoId: true },
      distinct: ["eventoId"],
    });
    let creadas = 0;
    for (const evento of eventos) {
      creadas += await this.sincronizarEvento(evento.eventoId, usuario);
    }
    return creadas;
  }

  /** Filtros compartidos por la lista y la exportacion. */
  private construirWhere(
    params: Omit<DdMatrizListarParams, "page" | "perPage">,
  ): Prisma.DdMatrizVinculoWhereInput {
    const expediente: Prisma.DebidaDiligenciaWhereInput = {
      estado: { not: DD_ESTADOS.BORRADOR },
    };
    if (params.eventoId) expediente.eventoId = params.eventoId;
    const and: Prisma.DdMatrizVinculoWhereInput[] = [{ expediente }];
    if (params.expedienteId) and.push({ expedienteId: params.expedienteId });
    if (params.tipo) and.push({ tipo: params.tipo });
    if (params.ambito) and.push({ ambito: params.ambito });
    if (params.pais) and.push({ pais: params.pais });
    if (params.sinPais) and.push({ pais: null });
    if (params.resultadoFinal) {
      const estadoLegacy = estadoExpedienteDeResultadoFinal(params.resultadoFinal);
      and.push({
        OR: [
          { resultadoFinal: params.resultadoFinal },
          ...(estadoLegacy
            ? [{ resultadoFinal: null, expediente: { ...expediente, estado: estadoLegacy } }]
            : []),
        ],
      });
    }
    if (params.sinEvaluar) {
      and.push({
        resultadoFinal: null,
        expediente: {
          ...expediente,
          estado: { notIn: [DD_ESTADOS.APROBADA, DD_ESTADOS.OBSERVADA, DD_ESTADOS.RECHAZADA] },
        },
      });
    }
    const texto = params.search?.trim();
    if (texto) {
      and.push({
        OR: [
          { nombre: { contains: texto, mode: "insensitive" } },
          { documento: { contains: texto, mode: "insensitive" } },
          { expediente: { codigo: { contains: texto, mode: "insensitive" } } },
          { expediente: { empresa: { razonSocial: { contains: texto, mode: "insensitive" } } } },
          { expediente: { empresa: { ruc: { contains: texto, mode: "insensitive" } } } },
        ],
      });
    }
    return { AND: and };
  }

  async listar(params: DdMatrizListarParams): Promise<DdMatrizListarResult> {
    const where = this.construirWhere(params);
    const expedientePaises: Prisma.DebidaDiligenciaWhereInput = {
      estado: { not: DD_ESTADOS.BORRADOR },
    };
    if (params.eventoId) expedientePaises.eventoId = params.eventoId;
    const paisesPromise = prisma.ddMatrizVinculo.groupBy({
      by: ["pais"],
      where: {
        pais: { not: null },
        expediente: expedientePaises,
      },
      _count: { _all: true },
      orderBy: { _count: { pais: "desc" } },
    });

    if (params.porEmpresa) {
      /* La bandeja pagina por expediente/empresa, no por fila de vinculo. */
      const [rows, paises] = await Promise.all([
        prisma.ddMatrizVinculo.findMany({
          where,
          include,
          orderBy: [{ expediente: { codigo: "desc" } }, { createdAt: "asc" }],
        }),
        paisesPromise,
      ]);
      const grupos = new Map<string, VinculoRow[]>();
      for (const row of rows) {
        const actual = grupos.get(row.expedienteId);
        if (actual) actual.push(row);
        else grupos.set(row.expedienteId, [row]);
      }
      const empresas = [...grupos.values()];
      const inicio = (params.page - 1) * params.perPage;
      const pagina = empresas.slice(inicio, inicio + params.perPage).flat();
      const reputacion = await contarReputacion(pagina);
      return {
        data: pagina.map((row) => mapFila(row, reputacion.get(row.id))),
        total: empresas.length,
        paises: paises.flatMap((p) => (p.pais ? [{ pais: p.pais, total: p._count._all }] : [])),
      };
    }

    const [total, rows, paises] = await Promise.all([
      prisma.ddMatrizVinculo.count({ where }),
      prisma.ddMatrizVinculo.findMany({
        where,
        include,
        orderBy: [{ expediente: { codigo: "desc" } }, { createdAt: "asc" }],
        skip: (params.page - 1) * params.perPage,
        take: params.perPage,
      }),
      paisesPromise,
    ]);
    const reputacion = await contarReputacion(rows);
    return {
      data: rows.map((row) => mapFila(row, reputacion.get(row.id))),
      total,
      paises: paises.flatMap((p) => (p.pais ? [{ pais: p.pais, total: p._count._all }] : [])),
    };
  }

  async resumen(eventoId?: string): Promise<DdMatrizResumenEntity> {
    const expediente: Prisma.DebidaDiligenciaWhereInput = {
      estado: { not: DD_ESTADOS.BORRADOR },
    };
    if (eventoId) expediente.eventoId = eventoId;
    const enEvento: Prisma.DdMatrizVinculoWhereInput = { expediente };
    const agrupar = async (
      campo: "resultadoFinal" | "ambito" | "tipo" | "sigResultado" | "repResultado" | "cmpResultado",
    ): Promise<DdMatrizConteo[]> => {
      const filas = await prisma.ddMatrizVinculo.groupBy({
        by: [campo],
        where: enEvento,
        _count: { _all: true },
      });
      return filas.map((f) => ({ valor: (f as Record<string, unknown>)[campo] as string | null, total: f._count._all }));
    };

    const contarResultadoFinalEfectivo = async (): Promise<DdMatrizConteo[]> => {
      const filas = await prisma.ddMatrizVinculo.findMany({
        where: enEvento,
        select: {
          resultadoFinal: true,
          expediente: { select: { estado: true } },
        },
      });
      const conteo = new Map<string | null, number>();
      for (const fila of filas) {
        const valor = resultadoFinalEfectivo(fila.resultadoFinal, fila.expediente.estado);
        conteo.set(valor, (conteo.get(valor) ?? 0) + 1);
      }
      return [...conteo.entries()].map(([valor, total]) => ({ valor, total }));
    };

    /* Resultado de DD por empresa: el del vinculo titular (tipo empresa) de cada expediente. */
    const contarResultadoFinalEmpresas = async (): Promise<DdMatrizConteo[]> => {
      const filas = await prisma.ddMatrizVinculo.findMany({
        where: { ...enEvento, tipo: DD_MATRIZ_TIPOS_VINCULO.EMPRESA },
        select: {
          expedienteId: true,
          resultadoFinal: true,
          expediente: { select: { estado: true } },
        },
      });
      const porExpediente = new Map<string, string | null>();
      for (const fila of filas) {
        porExpediente.set(fila.expedienteId, resultadoFinalEfectivo(fila.resultadoFinal, fila.expediente.estado));
      }
      const conteo = new Map<string | null, number>();
      for (const valor of porExpediente.values()) conteo.set(valor, (conteo.get(valor) ?? 0) + 1);
      return [...conteo.entries()].map(([valor, total]) => ({ valor, total }));
    };

    const [empresas, total, resultadoFinal, resultadoFinalEmpresas, ambito, tipo, sig, reputacional, compliance, paises, requierenReforzada, pendientesCompliance, enRevision] =
      await Promise.all([
        prisma.ddMatrizVinculo.groupBy({
          by: ["expedienteId"],
          where: enEvento,
          _count: { _all: true },
        }),
        prisma.ddMatrizVinculo.count({ where: enEvento }),
        contarResultadoFinalEfectivo(),
        contarResultadoFinalEmpresas(),
        agrupar("ambito"),
        agrupar("tipo"),
        agrupar("sigResultado"),
        agrupar("repResultado"),
        agrupar("cmpResultado"),
        prisma.ddMatrizVinculo.groupBy({
          by: ["pais"],
          where: { ...enEvento, pais: { not: null } },
          _count: { _all: true },
          orderBy: { _count: { pais: "desc" } },
        }),
        prisma.ddMatrizVinculo.count({
          where: { ...enEvento, sigConclusion: DD_MATRIZ_CONCLUSIONES.REQUIERE_DD_REFORZADA },
        }),
        prisma.ddMatrizVinculo.count({
          where: { ...enEvento, sigConclusion: DD_MATRIZ_CONCLUSIONES.REQUIERE_DD_REFORZADA, cmpResultado: null },
        }),
        prisma.ddMatrizVinculo.count({
          where: {
            ...enEvento,
            OR: [
              { resultadoFinal: DD_MATRIZ_RESULTADOS_FINALES.EN_REVISION },
              { sigConclusion: DD_MATRIZ_CONCLUSIONES.EN_REVISION },
              { repConclusion: DD_MATRIZ_CONCLUSIONES.EN_REVISION },
            ],
          },
        }),
      ]);

    return {
      empresas: empresas.length,
      total,
      resultadoFinal,
      resultadoFinalEmpresas,
      ambito,
      tipo,
      paises: paises.flatMap((p) => (p.pais ? [{ pais: p.pais, total: p._count._all }] : [])),
      sig,
      reputacional,
      compliance,
      requierenReforzada,
      pendientesCompliance,
      enRevision,
    };
  }

  async listarParaExportar(params: DdMatrizExportarParams): Promise<DdMatrizExportItem[]> {
    const where: Prisma.DdMatrizVinculoWhereInput = params.ids
      ? {
          id: { in: params.ids },
          expediente: {
            estado: { not: DD_ESTADOS.BORRADOR },
            ...(params.eventoId ? { eventoId: params.eventoId } : {}),
          },
        }
      : this.construirWhere(params);
    const rows = await prisma.ddMatrizVinculo.findMany({
      where,
      include,
      orderBy: [{ expediente: { codigo: "asc" } }, { createdAt: "asc" }],
    });
    const expedienteIds = [...new Set(rows.map((r) => r.expedienteId))];
    const empresas = await prisma.ddMatrizVinculo.findMany({
      where: { expedienteId: { in: expedienteIds }, tipo: DD_MATRIZ_TIPOS_VINCULO.EMPRESA },
      include,
    });
    const empresaPorExpediente = new Map(empresas.map((e) => [e.expedienteId, mapVinculo(e)]));
    return rows.map((row) => ({ vinculo: mapVinculo(row), empresa: empresaPorExpediente.get(row.expedienteId) ?? null }));
  }

  async findVinculo(id: string): Promise<DdMatrizVinculoEntity | null> {
    const row = await prisma.ddMatrizVinculo.findUnique({ where: { id }, include });
    if (!row) return null;
    return aplicarReputacionLegacy(mapVinculo(row), await casosReputacionLegacy(row.expedienteId));
  }

  async findVinculoEmpresa(expedienteId: string): Promise<DdMatrizVinculoEntity | null> {
    const row = await prisma.ddMatrizVinculo.findUnique({
      where: {
        expedienteId_tipo_refKey: {
          expedienteId,
          tipo: DD_MATRIZ_TIPOS_VINCULO.EMPRESA,
          refKey: DD_MATRIZ_TIPOS_VINCULO.EMPRESA,
        },
      },
      include,
    });
    if (!row) return null;
    return aplicarReputacionLegacy(mapVinculo(row), await casosReputacionLegacy(expedienteId));
  }

  async listarVinculosExpediente(expedienteId: string): Promise<DdMatrizVinculoEntity[]> {
    const [rows, legacy] = await Promise.all([
      prisma.ddMatrizVinculo.findMany({
        where: { expedienteId },
        include,
        orderBy: { createdAt: "asc" },
      }),
      casosReputacionLegacy(expedienteId),
    ]);
    return rows.map((row) => aplicarReputacionLegacy(mapVinculo(row), legacy));
  }

  async findEventoIdDeExpediente(expedienteId: string): Promise<string | null> {
    const row = await prisma.debidaDiligencia.findUnique({
      where: { id: expedienteId },
      select: { eventoId: true, estado: true },
    });
    if (!row || row.estado === DD_ESTADOS.BORRADOR) return null;
    return row.eventoId;
  }

  async existeExpedienteEnEvento(expedienteId: string, eventoId: string): Promise<boolean> {
    const total = await prisma.debidaDiligencia.count({
      where: { id: expedienteId, eventoId, estado: { not: DD_ESTADOS.BORRADOR } },
    });
    return total > 0;
  }

  async actualizarVinculo(id: string, cambios: DdMatrizVinculoCambios): Promise<DdMatrizVinculoEntity> {
    const data: Prisma.DdMatrizVinculoUpdateInput = {
      actualizadoPor: cambios.actualizadoPor,
      ...valorBloque(cambios.sig, "sig"),
      ...valorBloque(cambios.reputacional, "rep"),
      ...valorBloque(cambios.compliance, "cmp"),
    };
    if (cambios.nombre !== undefined) data.nombre = cambios.nombre;
    if (cambios.tipoDocumento !== undefined) data.tipoDocumento = cambios.tipoDocumento;
    if (cambios.documento !== undefined) data.documento = cambios.documento;
    if (cambios.nacionalidad !== undefined) data.nacionalidad = cambios.nacionalidad;
    if (cambios.cargo !== undefined) data.cargo = cambios.cargo;
    if (cambios.ambito !== undefined) data.ambito = cambios.ambito;
    if (cambios.ambitoEditado !== undefined) data.ambitoEditado = cambios.ambitoEditado;
    if (cambios.pais !== undefined) data.pais = cambios.pais;
    if (cambios.paisEditado !== undefined) data.paisEditado = cambios.paisEditado;
    if (cambios.identidadEditada !== undefined) data.identidadEditada = cambios.identidadEditada;
    if (cambios.listas !== undefined) data.listas = cambios.listas as Prisma.InputJsonValue;
    if (cambios.generales) {
      const g = cambios.generales;
      if (g.fechaInicioActividades !== undefined) data.fechaInicioActividades = g.fechaInicioActividades;
      if (g.estadoContribuyente !== undefined) data.estadoContribuyente = g.estadoContribuyente;
      if (g.direccionLegal !== undefined) data.direccionLegal = g.direccionLegal;
      if (g.actividadEconomica !== undefined) data.actividadEconomica = g.actividadEconomica;
      if (g.motivo !== undefined) data.motivo = g.motivo;
      if (g.eventoProyecto !== undefined) data.eventoProyecto = g.eventoProyecto;
      if (g.historialIimp !== undefined) data.historialIimp = g.historialIimp;
      if (g.beneficioMutuo !== undefined) data.beneficioMutuo = g.beneficioMutuo;
    }
    if (cambios.resultadoFinal !== undefined) data.resultadoFinal = cambios.resultadoFinal;
    if (cambios.finalFecha !== undefined) data.finalFecha = cambios.finalFecha;
    if (cambios.finalPor !== undefined) data.finalPor = cambios.finalPor;
    if (cambios.finalComentario !== undefined) data.finalComentario = cambios.finalComentario;

    const row = await prisma.ddMatrizVinculo.update({ where: { id }, data, include });
    return mapVinculo(row);
  }

  async crearVinculoManual(data: DdMatrizVinculoManual): Promise<DdMatrizVinculoEntity> {
    const row = await prisma.ddMatrizVinculo.create({
      data: {
        expedienteId: data.expedienteId,
        tipo: data.tipo,
        refKey: crypto.randomUUID(),
        origen: DD_MATRIZ_ORIGENES.MANUAL,
        nombre: data.nombre,
        tipoDocumento: data.tipoDocumento,
        documento: data.documento,
        nacionalidad: data.nacionalidad,
        cargo: data.cargo,
        ambito: data.ambito,
        ambitoEditado: true,
        pais: data.pais,
        paisEditado: data.paisEditado,
        creadoPor: data.creadoPor,
      },
      include,
    });
    return mapVinculo(row);
  }

  async eliminarVinculoManual(id: string): Promise<void> {
    await prisma.ddMatrizVinculo.deleteMany({ where: { id, origen: DD_MATRIZ_ORIGENES.MANUAL } });
  }

  async listarAdjuntos(vinculoId: string): Promise<DdMatrizAdjuntoEntity[]> {
    const rows = await prisma.ddMatrizAdjunto.findMany({ where: { vinculoId }, orderBy: { createdAt: "asc" } });
    return rows.map(mapAdjunto);
  }

  async findAdjunto(id: string): Promise<DdMatrizAdjuntoEntity | null> {
    const row = await prisma.ddMatrizAdjunto.findUnique({ where: { id } });
    return row ? mapAdjunto(row) : null;
  }

  async crearAdjunto(data: DdMatrizAdjuntoCreacion): Promise<DdMatrizAdjuntoEntity> {
    const row = await prisma.ddMatrizAdjunto.create({ data });
    return mapAdjunto(row);
  }

  async eliminarAdjunto(id: string): Promise<void> {
    await prisma.ddMatrizAdjunto.deleteMany({ where: { id } });
  }

  async registrarAuditoria(accion: string, entidad: string, actor: string, mensaje: string): Promise<void> {
    await prisma.auditLog.create({
      data: { tipo: DD_AUDITORIA_TIPO, entidad, actor, mensaje, metadata: { accion } },
    });
  }
}
