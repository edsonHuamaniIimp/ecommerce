import "server-only";

import { prisma } from "@/lib/server/db";
import type { Prisma } from "@prisma/client";
import type {
  DdMatrizAdjuntoCreacion,
  DdMatrizAdjuntoEntity,
  DdMatrizBloque,
  DdMatrizExpedienteContexto,
  DdMatrizFilaEntity,
  DdMatrizListarParams,
  DdMatrizListarResult,
  DdMatrizListasValor,
  DdMatrizVinculoCambios,
  DdMatrizVinculoEntity,
  DdMatrizVinculoManual,
} from "@/domain/models/dd-matriz-evaluacion";
import type { IDdMatrizEvaluacionRepository } from "@/domain/ports/dd-matriz-evaluacion-repository";
import {
  DD_AUDITORIA_TIPO,
  DD_ESTADOS,
  DD_MATRIZ_ORIGENES,
  DD_MATRIZ_TIPOS_VINCULO,
  DD_MATRIZ_TIPO_VINCULO_LABELS,
  type DdMatrizAdjuntoCategoria,
  type DdMatrizAmbito,
  type DdMatrizOrigen,
  type DdMatrizTipoVinculo,
} from "@/lib/shared/constants";
import { derivarAmbito } from "@/lib/shared/utils/dd-matriz-evaluacion";

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
      empresa: { select: { razonSocial: true, ruc: true, direccionFiscal: true } },
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
  direccionLegal: string | null;
}

function mapContexto(row: VinculoRow["expediente"]): DdMatrizExpedienteContexto {
  return {
    expedienteId: row.id,
    codigo: row.codigo,
    estado: row.estado,
    empresaRazonSocial: row.empresa.razonSocial,
    empresaRuc: row.empresa.ruc,
    empresaDireccionFiscal: row.empresa.direccionFiscal ?? null,
    paisConstitucion: row.paisConstitucion ?? null,
    actividadEconomica: row.actividadEconomica ?? null,
    tipoRelacionComercial: row.tipoRelacionComercial ?? null,
    motivo: row.motivoImportacion ?? row.tipoRelacionComercial ?? null,
    eventoProyecto: row.eventoProyecto ?? null,
    fechaIngreso: row.fechaEnvio ?? row.createdAt,
    revisadoPor: row.revisadoPor ?? null,
    fechaRevision: row.fechaRevision ?? null,
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
    fechaInicioActividades: row.fechaInicioActividades,
    estadoContribuyente: row.estadoContribuyente,
    direccionLegal: row.direccionLegal,
    historialIimp: row.historialIimp,
    beneficioMutuo: row.beneficioMutuo,
    listas: (row.listas ?? {}) as DdMatrizListasValor,
    sig: bloque(row.sigFecha, row.sigResponsable, row.sigResultado, row.sigObservaciones, row.sigConclusion),
    reputacional: bloque(row.repFecha, row.repResponsable, row.repResultado, row.repObservaciones, row.repConclusion),
    compliance: bloque(row.cmpFecha, row.cmpResponsable, row.cmpResultado, row.cmpObservaciones, row.cmpConclusion),
    resultadoFinal: row.resultadoFinal,
    finalFecha: row.finalFecha,
    finalPor: row.finalPor,
    creadoPor: row.creadoPor,
    actualizadoPor: row.actualizadoPor,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    expediente: mapContexto(row.expediente),
  };
}

function mapFila(row: VinculoRow): DdMatrizFilaEntity {
  const ctx = mapContexto(row.expediente);
  return {
    id: row.id,
    tipo: row.tipo as DdMatrizTipoVinculo,
    origen: row.origen as DdMatrizOrigen,
    nombre: row.nombre,
    tipoDocumento: row.tipoDocumento,
    documento: row.documento,
    ambito: row.ambito as DdMatrizAmbito,
    cargo: row.cargo,
    sigResultado: row.sigResultado,
    sigConclusion: row.sigConclusion,
    repResultado: row.repResultado,
    repConclusion: row.repConclusion,
    cmpResultado: row.cmpResultado,
    cmpConclusion: row.cmpConclusion,
    resultadoFinal: row.resultadoFinal,
    updatedAt: row.updatedAt,
    expediente: {
      expedienteId: ctx.expedienteId,
      codigo: ctx.codigo,
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
        representanteNombre: true,
        representanteTipoDocumento: true,
        representanteDocumento: true,
        representanteNacionalidad: true,
        empresa: { select: { razonSocial: true, ruc: true, direccionFiscal: true } },
        beneficiarios: {
          select: { id: true, nombre: true, documento: true, nacionalidad: true, porcentaje: true },
          orderBy: { orden: "asc" },
        },
      },
    });
    if (expedientes.length === 0) return 0;

    const deseadas: FilaDeseada[] = [];
    for (const exp of expedientes) {
      deseadas.push({
        expedienteId: exp.id,
        tipo: DD_MATRIZ_TIPOS_VINCULO.EMPRESA,
        refKey: DD_MATRIZ_TIPOS_VINCULO.EMPRESA,
        nombre: exp.empresa.razonSocial,
        tipoDocumento: "RUC",
        documento: exp.empresa.ruc,
        nacionalidad: exp.paisConstitucion,
        cargo: null,
        ambito: derivarAmbito({ pais: exp.paisConstitucion, tipoDocumento: "RUC" }),
        direccionLegal: exp.empresa.direccionFiscal ?? null,
      });
      if (exp.representanteNombre?.trim()) {
        deseadas.push({
          expedienteId: exp.id,
          tipo: DD_MATRIZ_TIPOS_VINCULO.REPRESENTANTE,
          refKey: DD_MATRIZ_TIPOS_VINCULO.REPRESENTANTE,
          nombre: exp.representanteNombre.trim(),
          tipoDocumento: exp.representanteTipoDocumento,
          documento: exp.representanteDocumento,
          nacionalidad: exp.representanteNacionalidad,
          cargo: DD_MATRIZ_TIPO_VINCULO_LABELS[DD_MATRIZ_TIPOS_VINCULO.REPRESENTANTE],
          ambito: derivarAmbito({
            nacionalidad: exp.representanteNacionalidad,
            tipoDocumento: exp.representanteTipoDocumento,
          }),
          direccionLegal: null,
        });
      }
      for (const b of exp.beneficiarios) {
        deseadas.push({
          expedienteId: exp.id,
          tipo: DD_MATRIZ_TIPOS_VINCULO.BENEFICIARIO,
          refKey: b.id,
          nombre: b.nombre,
          tipoDocumento: null,
          documento: b.documento,
          nacionalidad: b.nacionalidad,
          cargo: `${DD_MATRIZ_TIPO_VINCULO_LABELS[DD_MATRIZ_TIPOS_VINCULO.BENEFICIARIO]} (${b.porcentaje.toString()}%)`,
          ambito: derivarAmbito({ nacionalidad: b.nacionalidad }),
          direccionLegal: null,
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
        sigResultado: true,
        repResultado: true,
        cmpResultado: true,
        resultadoFinal: true,
      },
    });
    const clave = (expedienteId: string, tipo: string, refKey: string) => `${expedienteId}|${tipo}|${refKey}`;
    const porClave = new Map(existentes.map((e) => [clave(e.expedienteId, e.tipo, e.refKey), e]));
    const clavesDeseadas = new Set(deseadas.map((d) => clave(d.expedienteId, d.tipo, d.refKey)));

    const nuevas = deseadas.filter((d) => !porClave.has(clave(d.expedienteId, d.tipo, d.refKey)));
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
          direccionLegal: d.direccionLegal,
          creadoPor: usuario,
          /* Escalonado para que la empresa salga antes que sus personas vinculadas. */
          createdAt: new Date(base + i + indice),
        })),
      });
      creadas += resultado.count;
    }

    const cambios = deseadas.flatMap((d) => {
      const actual = porClave.get(clave(d.expedienteId, d.tipo, d.refKey));
      if (!actual) return [];
      const ambito = actual.ambitoEditado ? actual.ambito : d.ambito;
      const igual =
        actual.nombre === d.nombre &&
        actual.tipoDocumento === d.tipoDocumento &&
        actual.documento === d.documento &&
        actual.nacionalidad === d.nacionalidad &&
        actual.cargo === d.cargo &&
        actual.ambito === ambito;
      return igual
        ? []
        : [
            prisma.ddMatrizVinculo.update({
              where: { id: actual.id },
              data: {
                nombre: d.nombre,
                tipoDocumento: d.tipoDocumento,
                documento: d.documento,
                nacionalidad: d.nacionalidad,
                cargo: d.cargo,
                ambito,
              },
            }),
          ];
    });
    if (cambios.length > 0) await prisma.$transaction(cambios);

    /* Filas automaticas cuyo origen desaparecio (p. ej. beneficiario retirado): se quitan
     * solo si nadie registro evaluacion en ellas. */
    const obsoletas = existentes
      .filter((e) => !clavesDeseadas.has(clave(e.expedienteId, e.tipo, e.refKey)))
      .filter((e) => !e.sigResultado && !e.repResultado && !e.cmpResultado && !e.resultadoFinal)
      .map((e) => e.id);
    if (obsoletas.length > 0) await prisma.ddMatrizVinculo.deleteMany({ where: { id: { in: obsoletas } } });

    return creadas;
  }

  async listar(params: DdMatrizListarParams): Promise<DdMatrizListarResult> {
    const and: Prisma.DdMatrizVinculoWhereInput[] = [
      { expediente: { eventoId: params.eventoId, estado: { not: DD_ESTADOS.BORRADOR } } },
    ];
    if (params.tipo) and.push({ tipo: params.tipo });
    if (params.ambito) and.push({ ambito: params.ambito });
    if (params.resultadoFinal) and.push({ resultadoFinal: params.resultadoFinal });
    if (params.sinEvaluar) and.push({ resultadoFinal: null });
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
    const where: Prisma.DdMatrizVinculoWhereInput = { AND: and };

    const [total, rows] = await Promise.all([
      prisma.ddMatrizVinculo.count({ where }),
      prisma.ddMatrizVinculo.findMany({
        where,
        include,
        orderBy: [{ expediente: { codigo: "desc" } }, { createdAt: "asc" }],
        skip: (params.page - 1) * params.perPage,
        take: params.perPage,
      }),
    ]);
    return { data: rows.map(mapFila), total };
  }

  async findVinculo(id: string): Promise<DdMatrizVinculoEntity | null> {
    const row = await prisma.ddMatrizVinculo.findUnique({ where: { id }, include });
    return row ? mapVinculo(row) : null;
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
    return row ? mapVinculo(row) : null;
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
    if (cambios.listas !== undefined) data.listas = cambios.listas as Prisma.InputJsonValue;
    if (cambios.generales) {
      const g = cambios.generales;
      if (g.fechaInicioActividades !== undefined) data.fechaInicioActividades = g.fechaInicioActividades;
      if (g.estadoContribuyente !== undefined) data.estadoContribuyente = g.estadoContribuyente;
      if (g.direccionLegal !== undefined) data.direccionLegal = g.direccionLegal;
      if (g.historialIimp !== undefined) data.historialIimp = g.historialIimp;
      if (g.beneficioMutuo !== undefined) data.beneficioMutuo = g.beneficioMutuo;
    }
    if (cambios.resultadoFinal !== undefined) data.resultadoFinal = cambios.resultadoFinal;
    if (cambios.finalFecha !== undefined) data.finalFecha = cambios.finalFecha;
    if (cambios.finalPor !== undefined) data.finalPor = cambios.finalPor;

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
