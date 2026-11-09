import 'server-only';

import { prisma } from "@/lib/server/db";
import { usuariosDeEmpresa } from "@/infrastructure/persistence/empresa-usuarios";
import { ACCIONES_FACTURACION, AUTORES_SISTEMA, ESTADOS_FACTURACION, ESTADOS_CUOTA, ESTADOS_PAGO_EXTERNO, ESTADOS_SOLICITUD, REQUERIMIENTOS_FACTURACION } from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import type {
  IFacturacionRepository,
  FacturacionRow,
  FacturacionListParams,
  FacturacionListResult,
  FacturacionClienteParams,
  ClienteIdent,
  CuotaUpdate,
  DatosComprobanteFiscal,
  RecordatorioCandidatoRow,
} from "@/domain/ports/facturacion-repository";

/** Forma cruda (Prisma) de una facturacion con cuotas + solicitud. */
interface FacturacionRaw {
  id: string;
  solicitudId: string;
  tipo: string;
  estado: string;
  montoTotal: unknown;
  moneda: string;
  modoPago: string;
  createdAt: Date;
  cuotas: Array<{
    id: string;
    numero: number;
    monto: unknown;
    fechaVencimiento: Date | null;
    estado: string;
    comprobante: string | null;
    comprobanteFiscal: string | null;
    comprobanteFiscalTipo: string | null;
    comprobanteFiscalNumero: string | null;
    comprobanteFiscalAt: Date | null;
    comprobanteFiscalBy: string | null;
    documentoSieFechaEmision: Date | null;
    iimpDocumento: unknown | null;
    iimpJustificacion: string | null;
  iimpEmitidaAt: Date | null;
    createdAt: Date;
  }>;
  solicitud: {
    email: string | null;
    userId: string | null;
    /** Plan de cuotas definido por el cliente al reservar (null = no aplica). */
    planCuotas: unknown | null;
    iimpContrato: string | null;
    iimpCuentaCorriente: string | null;
    datosFacturacion: unknown | null;
    requisitosFacturacion: unknown | null;
    gessStand: { standCode: string; empresa: string | null } | null;
    stands: Array<{ gessStand: { standCode: string; empresa: string | null } | null }>;
  };
}

const SOLICITUD_SELECT = {
  email: true,
  userId: true,
  planCuotas: true,
  iimpContrato: true,
  iimpCuentaCorriente: true,
  datosFacturacion: true,
  requisitosFacturacion: true,
  gessStand: { select: { standCode: true, empresa: true } },
  stands: { include: { gessStand: { select: { standCode: true, empresa: true } } } },
};

const INCLUDE = {
  cuotas: { orderBy: { numero: "asc" as const } },
  solicitud: { select: SOLICITUD_SELECT },
};

function empresaDeSolicitud(
  r: FacturacionRaw,
  empresasPorUsuario: ReadonlyMap<string, string>,
): string | null {
  const snapshot = (r.solicitud.datosFacturacion as { razonSocial?: string | null } | null)?.razonSocial?.trim();
  if (snapshot) return snapshot;
  if (r.solicitud.userId) {
    const deEmpresa = empresasPorUsuario.get(r.solicitud.userId)?.trim();
    if (deEmpresa) return deEmpresa;
  }
  return (
    r.solicitud.gessStand?.empresa?.trim()
    ?? r.solicitud.stands.map((s) => s.gessStand?.empresa?.trim()).find((empresa): empresa is string => Boolean(empresa))
    ?? null
  );
}

function toRow(r: FacturacionRaw, empresasPorUsuario: ReadonlyMap<string, string> = new Map()): FacturacionRow {
  return {
    id: r.id,
    solicitudId: r.solicitudId,
    tipo: r.tipo,
    estado: r.estado,
    montoTotal: Number(r.montoTotal),
    moneda: r.moneda,
    modoPago: r.modoPago,
    planCliente: r.solicitud.planCuotas !== null && r.solicitud.planCuotas !== undefined,
    standCode: r.solicitud.gessStand?.standCode ?? (r.solicitud.stands.map((s) => s.gessStand?.standCode).filter((c): c is string => Boolean(c)).join(", ") || "—"),
    correoSolicitante: r.solicitud.email,
    empresaFacturacion: empresaDeSolicitud(r, empresasPorUsuario),
    requisitos: (r.solicitud.requisitosFacturacion as FacturacionRow["requisitos"]) ?? null,
    iimpContrato: r.solicitud.iimpContrato ?? null,
    iimpCuentaCorriente: r.solicitud.iimpCuentaCorriente ?? null,
    createdAt: r.createdAt.toISOString(),
    cuotas: r.cuotas.map((c) => ({
      id: c.id, numero: c.numero, monto: Number(c.monto),
      fechaVencimiento: c.fechaVencimiento?.toISOString() ?? null, estado: c.estado,
      comprobante: c.comprobante,
      comprobanteFiscal: c.comprobanteFiscal && c.comprobanteFiscalTipo && c.comprobanteFiscalNumero
        ? {
            tipo: c.comprobanteFiscalTipo,
            numero: c.comprobanteFiscalNumero,
            url: c.comprobanteFiscal,
            at: (c.comprobanteFiscalAt ?? c.createdAt).toISOString(),
            by: c.comprobanteFiscalBy,
          }
        : null,
      documentoSie: c.comprobanteFiscal && !(c.comprobanteFiscalTipo && c.comprobanteFiscalNumero) ? c.comprobanteFiscal : null,
      documentoSieAnulado: !c.comprobanteFiscal && c.comprobanteFiscalAt !== null && c.comprobanteFiscalBy === AUTORES_SISTEMA.IIMP,
      documentoSieJustificacion: c.iimpJustificacion ?? null,
      documentoSieFechaEmision: c.documentoSieFechaEmision ? c.documentoSieFechaEmision.toISOString().slice(0, 10) : null,
      iimpDocumento: (c.iimpDocumento ?? null) as FacturacionRow["cuotas"][number]["iimpDocumento"],
    })),
  };
}

/** OR de propiedad (userId / email) para filtrar facturaciones del cliente. */
function identOr(ident: ClienteIdent): Record<string, unknown>[] {
  const or: Record<string, unknown>[] = [];
  if (ident.userId) or.push({ userId: ident.userId });
  if (ident.email) or.push({ email: ident.email });
  // Sin identidad no se expone nada.
  return or.length > 0 ? or : [{ id: "__sin_identidad__" }];
}

export class FacturacionPrismaRepository implements IFacturacionRepository {
  async listar(params: FacturacionListParams): Promise<FacturacionListResult> {
    const where: Record<string, unknown> = { flgActivo: true };
    if (params.estado) where.estado = params.estado;
    if (params.tipo) where.tipo = params.tipo;

    /* Requerimiento de facturacion: estado de la solicitud y documentos de las cuotas. */
    if (params.requerimiento === REQUERIMIENTOS_FACTURACION.CON_FACTURA) {
      where.cuotas = { some: { comprobanteFiscal: { not: null } } };
    } else if (params.requerimiento === REQUERIMIENTOS_FACTURACION.SIN_FACTURA) {
      where.cuotas = { none: { comprobanteFiscal: { not: null } } };
    } else if (params.requerimiento === REQUERIMIENTOS_FACTURACION.CON_SOLICITUD_SIN_FACTURA) {
      where.cuotas = { none: { comprobanteFiscal: { not: null } } };
    } else if (params.requerimiento === REQUERIMIENTOS_FACTURACION.ANULADA) {
      where.cuotas = {
        some: {
          comprobanteFiscal: null,
          comprobanteFiscalAt: { not: null },
          comprobanteFiscalBy: AUTORES_SISTEMA.IIMP,
        },
      };
    }

    const condicionesSolicitud: Record<string, unknown>[] = [];
    if (params.eventoId) {
      condicionesSolicitud.push({
        OR: [
          { gessStand: { eventoId: params.eventoId } },
          { stands: { some: { gessStand: { eventoId: params.eventoId } } } },
        ],
      });
    }
    /* Sin solicitud de factura: la reserva aun no se registro en el IIMP. */
    if (params.requerimiento === REQUERIMIENTOS_FACTURACION.SIN_SOLICITUD) {
      condicionesSolicitud.push({ iimpContrato: null });
    }
    /* Solicitud enviada (reserva registrada) pendiente de que se genere la factura. */
    if (params.requerimiento === REQUERIMIENTOS_FACTURACION.CON_SOLICITUD_SIN_FACTURA) {
      condicionesSolicitud.push({ iimpContrato: { not: null } });
    }
    const busqueda = params.search?.trim();
    if (busqueda) {
      /* RUC de la empresa: cuentas de usuario cuyo RUC coincide (empresa vinculada). */
      const cuentas = await prisma.userRole.findMany({
        where: { ruc: { contains: busqueda, mode: "insensitive" } },
        select: { email: true },
        take: 200,
      });
      const emailsPorRuc = cuentas.map((c) => c.email).filter((e): e is string => Boolean(e));

      condicionesSolicitud.push({
        OR: [
          { email: { contains: busqueda, mode: "insensitive" } },
          { iimpContrato: { contains: busqueda, mode: "insensitive" } },
          { gessStand: { standCode: { contains: busqueda, mode: "insensitive" } } },
          { stands: { some: { gessStand: { standCode: { contains: busqueda, mode: "insensitive" } } } } },
          /* RUC/DNI capturado en el snapshot de facturacion de la reserva. */
          { datosFacturacion: { path: ["numeroDocumento"], string_contains: busqueda } },
          ...(emailsPorRuc.length > 0 ? [{ email: { in: emailsPorRuc } }] : []),
        ],
      });
    }
    if (condicionesSolicitud.length === 1) where.solicitud = condicionesSolicitud[0];
    if (condicionesSolicitud.length > 1) where.solicitud = { AND: condicionesSolicitud };

    return this.paginar(where, params);
  }

  async listarPorCliente(params: FacturacionClienteParams): Promise<FacturacionListResult> {
    /* Todos los eventos: ocultar por evento activo dejaba al cliente sin ver planes pendientes de otros eventos. */
    let solicitudWhere: Record<string, unknown> = { flgActivo: true, OR: identOr(params) };
    if (params.empresaId) {
      /* "Ver como": incluye a todos los usuarios vinculados a la empresa. */
      const { userIds, emails } = await usuariosDeEmpresa(params.empresaId);
      solicitudWhere =
        userIds.length > 0 || emails.length > 0
          ? {
              flgActivo: true,
              OR: [
                ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
                ...(emails.length > 0 ? [{ email: { in: emails } }] : []),
              ],
            }
          : { flgActivo: true, id: "__sin_empresa__" };
    }
    const where: Record<string, unknown> = { flgActivo: true, solicitud: solicitudWhere };
    return this.paginar(where, params);
  }

  /** Razon social de la ficha vinculada al usuario de la solicitud. */
  private async empresasPorUsuario(rows: FacturacionRaw[]): Promise<Map<string, string>> {
    const userIds = [...new Set(rows.map((r) => r.solicitud.userId).filter((id): id is string => Boolean(id)))];
    if (userIds.length === 0) return new Map();
    const usuarios = await prisma.userRole.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, empresa: { select: { razonSocial: true } } },
    });
    return new Map(
      usuarios
        .map((u) => [u.userId, u.empresa?.razonSocial ?? ""] as const)
        .filter(([, razonSocial]) => Boolean(razonSocial)),
    );
  }

  private async paginar(where: Record<string, unknown>, params: { page: number; perPage: number }): Promise<FacturacionListResult> {
    const [rows, total] = await Promise.all([
      prisma.facturacion.findMany({
        where: where as never,
        include: INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.perPage,
        take: params.perPage,
      }),
      prisma.facturacion.count({ where: where as never }),
    ]);
    const rawRows = rows as unknown as FacturacionRaw[];
    const empresas = await this.empresasPorUsuario(rawRows);
    return { data: rawRows.map((r) => toRow(r, empresas)), total };
  }

  async detalle(id: string): Promise<FacturacionRow | null> {
    const r = await prisma.facturacion.findUnique({ where: { id }, include: INCLUDE });
    if (!r) return null;
    const raw = r as unknown as FacturacionRaw;
    const empresas = await this.empresasPorUsuario([raw]);
    return toRow(raw, empresas);
  }

  async agregarCuota(facturacionId: string, monto: number, fechaVencimiento: string | null, createdBy: string) {
    const last = await prisma.facturacionCuota.findFirst({ where: { facturacionId }, orderBy: { numero: "desc" } });
    const numero = (last?.numero ?? 0) + 1;
    await prisma.facturacionCuota.create({
      data: { facturacionId, numero, monto, fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null },
    });
    await prisma.facturacionHistorial.create({
      data: { facturacionId, accion: ACCIONES_FACTURACION.AGREGAR_CUOTA, detalle: `Cuota #${numero} agregada por ${monto.toFixed(2)}`, createdBy },
    });
  }

  async actualizarCuota(cuotaId: string, data: CuotaUpdate, createdBy: string) {
    const prev = await prisma.facturacionCuota.findUnique({ where: { id: cuotaId } });
    if (!prev) return;
    const updateData: Record<string, unknown> = {};
    if (data.monto !== undefined) updateData.monto = data.monto;
    if (data.fechaVencimiento !== undefined) {
      updateData.fechaVencimiento = data.fechaVencimiento ? new Date(data.fechaVencimiento) : null;
    }
    await prisma.facturacionCuota.update({ where: { id: cuotaId }, data: updateData });
    await prisma.facturacionHistorial.create({
      data: { facturacionId: prev.facturacionId, accion: ACCIONES_FACTURACION.ACTUALIZAR_CUOTA, detalle: `Cuota #${prev.numero} actualizada`, createdBy },
    });
  }

  async adjuntarVoucher(cuotaId: string, comprobante: string, createdBy: string) {
    const prev = await prisma.facturacionCuota.findUnique({ where: { id: cuotaId }, select: { facturacionId: true, numero: true } });
    if (!prev) return;
    await prisma.facturacionCuota.update({ where: { id: cuotaId }, data: { comprobante } });
    await prisma.facturacionHistorial.create({
      data: { facturacionId: prev.facturacionId, accion: ACCIONES_FACTURACION.ADJUNTAR_VOUCHER, detalle: `Voucher adjuntado a la cuota #${prev.numero}`, createdBy },
    });
  }

  async pagarCuota(cuotaId: string, createdBy: string, comprobante: string | null) {
    const cuota = await prisma.facturacionCuota.update({
      where: { id: cuotaId },
      data: { estado: ESTADOS_CUOTA.PAGADO, comprobante },
    });
    await prisma.facturacionHistorial.create({
      data: { facturacionId: cuota.facturacionId, accion: ACCIONES_FACTURACION.PAGAR_CUOTA, detalle: `Cuota #${cuota.numero} marcada como pagada`, createdBy },
    });
    await this.cerrarFacturacionSiCompleta(cuota.facturacionId, createdBy);
  }

  /** Cierra facturacion y solicitud cuando no quedan cuotas pendientes. */
  private async cerrarFacturacionSiCompleta(facturacionId: string, createdBy: string) {
    const pendientes = await prisma.facturacionCuota.count({
      where: { facturacionId, estado: ESTADOS_CUOTA.PENDIENTE },
    });
    if (pendientes > 0) return;
    await prisma.facturacion.update({ where: { id: facturacionId }, data: { estado: ESTADOS_FACTURACION.PAGADO } });
    const facturacion = await prisma.facturacion.findUnique({ where: { id: facturacionId }, select: { solicitudId: true } });
    if (facturacion) {
      await prisma.solicitud.update({ where: { id: facturacion.solicitudId }, data: { estado: ESTADOS_SOLICITUD.PAGADO } });
    }
    await prisma.facturacionHistorial.create({
      data: { facturacionId, accion: ACCIONES_FACTURACION.ACTUALIZAR, detalle: "Facturacion marcada como pagada (todas las cuotas pagadas)", createdBy },
    });
  }

  async findFacturacionIdPorSolicitud(solicitudId: string): Promise<string | null> {
    const facturacion = await prisma.facturacion.findFirst({
      where: { solicitudId, flgActivo: true },
      select: { id: true },
    });
    return facturacion?.id ?? null;
  }

  /**
   * Notificacion del sistema de facturacion externo: guarda el nombre del documento
   * en la cuota segun el estado notificado.
   * - `0` PAGADA: la cuota pasa a pagada (y cierra facturacion/solicitud si no quedan pendientes).
   * - `1` PENDIENTE: solo registra el documento.
   * - `2` ANULADA: limpia el documento de la cuota (vuelve a pendiente de documento).
   */
  async registrarNotificacionFactura(cuotaId: string, data: { documento: string; estadoPago: import("@/lib/shared/constants").EstadoPagoExterno; fechaEmision?: string | null; justificacion?: string | null }, createdBy: string) {
    const anterior = await prisma.facturacionCuota.findUnique({
      where: { id: cuotaId },
      select: { comprobanteFiscal: true },
    });
    if (!anterior) return;

    const anulada = data.estadoPago === ESTADOS_PAGO_EXTERNO.ANULADA;
    const cuota = await prisma.facturacionCuota.update({
      where: { id: cuotaId },
      data: {
        comprobanteFiscal: anulada ? null : data.documento,
        comprobanteFiscalAt: new Date(),
        comprobanteFiscalBy: createdBy,
        ...(anulada
          ? { documentoSieFechaEmision: null }
          : data.fechaEmision
            ? { documentoSieFechaEmision: dateUtils.toDate(data.fechaEmision) }
            : {}),
        iimpJustificacion: anulada ? (data.justificacion ?? null) : null,
        ...(data.estadoPago === ESTADOS_PAGO_EXTERNO.PAGADA ? { estado: ESTADOS_CUOTA.PAGADO } : {}),
      },
    });
    await prisma.facturacionHistorial.create({
      data: {
        facturacionId: cuota.facturacionId,
        accion: ACCIONES_FACTURACION.DOCUMENTO_IIMP,
        detalle: anulada
          ? `Documento '${anterior.comprobanteFiscal ?? data.documento}' anulado o rechazado desde el sistema de facturacion (estado 2)${data.justificacion ? `: ${data.justificacion}` : ""}`
          : `Documento '${data.documento}' registrado desde el sistema de facturacion (estado ${data.estadoPago})${data.fechaEmision ? `, emitido el ${data.fechaEmision}` : ""}${data.justificacion ? `: ${data.justificacion}` : ""}`,
        createdBy,
      },
    });
    if (data.estadoPago === ESTADOS_PAGO_EXTERNO.PAGADA) {
      await this.cerrarFacturacionSiCompleta(cuota.facturacionId, createdBy);
    }
  }
  async adjuntarComprobanteFiscal(cuotaId: string, data: DatosComprobanteFiscal, createdBy: string) {
    const cuota = await prisma.facturacionCuota.update({
      where: { id: cuotaId },
      data: {
        comprobanteFiscal: data.url,
        comprobanteFiscalTipo: data.tipo,
        comprobanteFiscalNumero: data.numero,
        comprobanteFiscalAt: new Date(),
        comprobanteFiscalBy: createdBy,
      },
    });
    await prisma.facturacionHistorial.create({
      data: {
        facturacionId: cuota.facturacionId,
        accion: ACCIONES_FACTURACION.ADJUNTAR_COMPROBANTE,
        detalle: `Comprobante fiscal (${data.tipo} ${data.numero}) adjuntado a la cuota #${cuota.numero}`,
        createdBy,
      },
    });
  }

  /** Guarda el documento fiscal emitido por el IIMP en la cuota con ese numero. */
  async guardarDocumentoIImp(facturacionId: string, numero: number, documento: unknown, emitidaAt: Date) {
    const cuota = await prisma.facturacionCuota.findFirst({ where: { facturacionId, numero } });
    if (!cuota) return;
    await prisma.facturacionCuota.update({
      where: { id: cuota.id },
      data: { iimpDocumento: documento as never, iimpEmitidaAt: emitidaAt },
    });
    await prisma.facturacionHistorial.create({
      data: {
        facturacionId,
        accion: ACCIONES_FACTURACION.DOCUMENTO_IIMP,
        detalle: `Documento fiscal del IIMP guardado en la cuota #${numero}`,
        createdBy: AUTORES_SISTEMA.IIMP,
      },
    });
  }

  async actualizar(id: string, data: { tipo?: string; modoPago?: string }, createdBy: string) {
    const prev = await prisma.facturacion.findUnique({ where: { id }, select: { tipo: true, modoPago: true } });
    await prisma.facturacion.update({ where: { id }, data });
    if (data.tipo && prev?.tipo !== data.tipo) {
      await prisma.facturacionHistorial.create({
        data: { facturacionId: id, accion: ACCIONES_FACTURACION.ACTUALIZAR, detalle: `Tipo de pago cambiado de "${prev?.tipo}" a "${data.tipo}"`, createdBy },
      });
    }
    if (data.modoPago && prev?.modoPago !== data.modoPago) {
      await prisma.facturacionHistorial.create({
        data: { facturacionId: id, accion: ACCIONES_FACTURACION.ACTUALIZAR, detalle: `Modo de pago cambiado de "${prev?.modoPago}" a "${data.modoPago}"`, createdBy },
      });
    }
  }

  async eliminar(id: string, createdBy: string) {
    await prisma.facturacion.update({ where: { id }, data: { flgActivo: false } });
    await prisma.facturacionHistorial.create({
      data: { facturacionId: id, accion: ACCIONES_FACTURACION.ELIMINAR, detalle: "Registro dado de baja", createdBy },
    });
  }

  async eliminarCuota(cuotaId: string, createdBy: string) {
    const cuota = await prisma.facturacionCuota.findUnique({ where: { id: cuotaId }, select: { facturacionId: true, numero: true } });
    if (!cuota) return;
    await prisma.facturacionCuota.delete({ where: { id: cuotaId } });
    await prisma.facturacionHistorial.create({
      data: { facturacionId: cuota.facturacionId, accion: ACCIONES_FACTURACION.ELIMINAR_CUOTA, detalle: `Cuota #${cuota.numero} eliminada`, createdBy },
    });
    // Renumera secuencialmente (1..n) las cuotas restantes.
    const restantes = await prisma.facturacionCuota.findMany({
      where: { facturacionId: cuota.facturacionId },
      orderBy: { numero: "asc" },
      select: { id: true, numero: true },
    });
    await Promise.all(
      restantes.map((c, i) => (c.numero === i + 1 ? null : prisma.facturacionCuota.update({ where: { id: c.id }, data: { numero: i + 1 } }))),
    );
  }

  /**
   * Candidatos para el boton "Notificar" de la bandeja: facturaciones en proceso
   * con cuotas pendientes, su empresa/correo y la declaracion de requisitos.
   * La verificacion de documentos en el IIMP la hace el servicio de aplicacion.
   */
  async listarCandidatosRecordatorio(): Promise<RecordatorioCandidatoRow[]> {
    const rows = await prisma.facturacion.findMany({
      where: { flgActivo: true, estado: ESTADOS_FACTURACION.PENDIENTE },
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    const rawRows = rows as unknown as FacturacionRaw[];
    const empresas = await this.empresasPorUsuario(rawRows);
    return rawRows.map((r) => {
      const row = toRow(r, empresas);
      const pendientes = row.cuotas.filter((c) => c.estado !== ESTADOS_CUOTA.PAGADO);
      const snapshotEmail = (r.solicitud.datosFacturacion as { email?: string | null } | null)?.email?.trim() || null;
      return {
        facturacionId: row.id,
        solicitudId: row.solicitudId,
        standCode: row.standCode,
        empresa: row.empresaFacturacion,
        email: snapshotEmail ?? row.correoSolicitante,
        moneda: row.moneda,
        cuotasPendientes: pendientes.length,
        montoPendiente: pendientes.reduce((total, c) => total + c.monto, 0),
        requisitos: row.requisitos,
        iimpContrato: row.iimpContrato,
        iimpCuentaCorriente: row.iimpCuentaCorriente,
      };
    });
  }

  async registrarNotificacionRecordatorio(facturacionId: string, detalle: string, createdBy: string): Promise<void> {
    await prisma.facturacionHistorial.create({
      data: { facturacionId, accion: ACCIONES_FACTURACION.NOTIFICAR_RECORDATORIO, detalle, createdBy },
    });
  }

  async esPropietario(facturacionId: string, ident: ClienteIdent): Promise<boolean> {    const f = await prisma.facturacion.findUnique({
      where: { id: facturacionId },
      select: { solicitud: { select: { flgActivo: true, userId: true, email: true } } },
    });
    // Solo solicitudes vigentes (no bajas logicas).
    if (!f || !f.solicitud.flgActivo) return false;
    return this.coincide(f.solicitud, ident);
  }

  async esPropietarioDeCuota(cuotaId: string, ident: ClienteIdent): Promise<boolean> {
    const c = await prisma.facturacionCuota.findUnique({ where: { id: cuotaId }, select: { facturacionId: true } });
    if (!c) return false;
    return this.esPropietario(c.facturacionId, ident);
  }

  async facturacionDeCuota(cuotaId: string): Promise<FacturacionRow | null> {
    const c = await prisma.facturacionCuota.findUnique({ where: { id: cuotaId }, select: { facturacionId: true } });
    if (!c) return null;
    return this.detalle(c.facturacionId);
  }

  private coincide(solicitud: { userId: string | null; email: string | null }, ident: ClienteIdent): boolean {
    const porUser = Boolean(ident.userId) && solicitud.userId === ident.userId;
    const porEmail = Boolean(ident.email) && solicitud.email === ident.email;
    return porUser || porEmail;
  }
}

export const facturacionRepo = new FacturacionPrismaRepository();
