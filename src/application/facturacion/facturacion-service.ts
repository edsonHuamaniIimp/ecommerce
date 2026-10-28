import type { IFacturacionRepository, FacturacionListParams, FacturacionListResult, FacturacionRow, DatosComprobanteFiscal } from "@/domain/ports/facturacion-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IEmpresaRepository } from "@/domain/ports/empresa-repository";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import { DomainError } from "@/lib/server/router";
import { API_ERROR_CODES, ESTADOS_CUOTA, PERMISSIONS, TIPOS_COMPROBANTE } from "@/lib/shared/constants";
import { enviarEmailPlantilla } from "@/lib/server/email";
import { resolverIdiomaDestinatario } from "@/application/idioma/resolver-idioma";

/** Tipos validos del comprobante fiscal (ver TIPOS_COMPROBANTE). */
const TIPOS_COMPROBANTE_FISCAL: string[] = [TIPOS_COMPROBANTE.FACTURA, TIPOS_COMPROBANTE.BOLETA];

export class FacturacionApplicationService {
  constructor(
    private readonly repo: IFacturacionRepository,
    private readonly authRepo: IAuthRepository,
    private readonly solicitudes: Pick<ISolicitudesRepository, "detalle" | "datosReservaIImp">,
    private readonly empresas: Pick<IEmpresaRepository, "findById">,
  ) {}

  /** Permiso de gestion de Facturacion (o admin total). */
  autorizarGestion(permissions: string[] = []): void {
    const permitido =
      permissions.includes(PERMISSIONS.FACTURACION_VIEW) || permissions.includes(PERMISSIONS.ADMIN_FULL);
    if (!permitido) {
      throw new DomainError("Sin permiso para gestionar facturacion", API_ERROR_CODES.FORBIDDEN, 403);
    }
  }

  async listar(params: FacturacionListParams): Promise<FacturacionListResult> {
    return this.repo.listar(params);
  }

  async detalle(id: string): Promise<FacturacionRow | null> {
    return this.repo.detalle(id);
  }

  /**
   * Expediente de la solicitud para la vista de Facturacion: datos de la empresa
   * (contactos y responsables), datos de la reserva y documentos (contrato
   * generado, contrato firmado y anexos), para que Facturacion pueda revisarlos.
   */
  async expediente(solicitudId: string) {
    const solicitud = await this.solicitudes.detalle(solicitudId);
    if (!solicitud) {
      throw new DomainError("Solicitud no encontrada", API_ERROR_CODES.NOT_FOUND, 404);
    }

    const empresaId = solicitud.email ? await this.authRepo.findEmpresaIdDeUsuario(solicitud.email).catch(() => null) : null;
    const empresa = empresaId ? await this.empresas.findById(empresaId) : null;
    /* Snapshot de facturacion capturado en el wizard (puede diferir de la ficha de la empresa). */
    const reservaIimp = await this.solicitudes.datosReservaIImp(solicitudId);
    const datos = reservaIimp?.datosFacturacion ?? null;

    return {
      solicitudId: solicitud.id,
      empresaNombre: solicitud.empresa,
      email: solicitud.email,
      estadoSolicitud: solicitud.estadoSolicitud,
      contrato: solicitud.iimpContrato,
      cuentaCorriente: solicitud.iimpCuentaCorriente,
      reservaAt: solicitud.iimpReservaAt,
      planCuotas: solicitud.planCuotas,
      facturacion: datos
        ? {
            tipoComprobante: datos.tipoComprobante ?? null,
            tipoDocumento: datos.tipoDocumento ?? null,
            numeroDocumento: datos.numeroDocumento ?? null,
            razonSocial: datos.razonSocial ?? null,
            direccion: datos.direccion ?? null,
            telefono: datos.telefono ?? null,
            contacto: datos.contacto ?? null,
            email: datos.email ?? null,
          }
        : null,
      empresa: empresa
        ? {
            ruc: empresa.ruc,
            tipoDocumento: empresa.tipoDocumento,
            pais: empresa.pais,
            razonSocial: empresa.razonSocial,
            nombreComercial: empresa.nombreComercial,
            nombreFriso: empresa.nombreFriso ?? null,
            direccionFiscal: empresa.direccionFiscal,
            inicioOperaciones: empresa.inicioOperaciones ? empresa.inicioOperaciones.toISOString().slice(0, 10) : null,
            telefono: empresa.telefono,
            emailContacto: empresa.emailContacto,
            emailFacturacion: empresa.emailFacturacion,
            sitioWeb: empresa.sitioWeb,
            partidaElectronica: empresa.partidaElectronica,
            actividadEconomica: empresa.actividadEconomica ?? null,
            estadoContribuyente: empresa.estadoContribuyente ?? null,
            facturarANombre: empresa.facturarANombre ?? null,
            tipoComprobante: empresa.tipoComprobante,
            representanteLegal: {
              nombre: empresa.representanteLegalNombre,
              tipoDocumento: empresa.representanteLegalTipoDocumento,
              documento: empresa.representanteLegalDni,
              correo: empresa.representanteCorreo,
              celular: empresa.representanteCelular,
              direccion: empresa.representanteDireccion,
            },
            responsables: {
              extemin: {
                nombre: empresa.responsableExteminNombre ?? null,
                tipoDocumento: empresa.responsableExteminTipoDocumento ?? null,
                documento: empresa.responsableExteminDni ?? null,
                telefono: empresa.responsableExteminTelefono ?? null,
                email: empresa.responsableExteminEmail ?? null,
              },
              pagos: {
                nombre: empresa.responsablePagosNombre ?? null,
                tipoDocumento: empresa.responsablePagosTipoDocumento ?? null,
                documento: empresa.responsablePagosDni ?? null,
                telefono: empresa.responsablePagosTelefono ?? null,
                email: empresa.responsablePagosEmail ?? null,
              },
            },
          }
        : null,
      documentos: solicitud.docsAdjuntos.map((d) => ({
        id: d.id,
        categoria: d.categoria,
        requisito: d.requisito ?? null,
        nombre: d.nombre,
        url: d.url,
        estado: d.estado,
        createdAt: d.createdAt,
      })),
    };
  }

  /** El plan de pago lo definio el cliente en el contrato: la configuracion no es editable. */
  private async validarConfiguracionEditable(facturacionId: string): Promise<void> {
    const fact = await this.repo.detalle(facturacionId);
    if (fact?.planCliente) {
      throw new DomainError(
        "Las cuotas las definio el cliente en el contrato; no se pueden modificar. Aqui solo se confirman los pagos.",
        API_ERROR_CODES.CONFLICT,
        409,
      );
    }
  }

  async agregarCuota(facturacionId: string, monto: number, fechaVencimiento: string | null, createdBy: string): Promise<void> {
    await this.validarConfiguracionEditable(facturacionId);
    return this.repo.agregarCuota(facturacionId, monto, fechaVencimiento, createdBy);
  }

  async pagarCuota(cuotaId: string, createdBy: string, comprobante: string | null): Promise<void> {
    return this.repo.pagarCuota(cuotaId, createdBy, comprobante);
  }

  /**
   * Adjunta (o reemplaza) el comprobante fiscal (boleta/factura) de una cuota
   * pagada y notifica al cliente por correo (best-effort, en su idioma).
   */
  async adjuntarComprobanteFiscal(cuotaId: string, data: DatosComprobanteFiscal, createdBy: string): Promise<void> {
    if (!TIPOS_COMPROBANTE_FISCAL.includes(data.tipo)) {
      throw new DomainError(
        `Tipo de comprobante invalido: ${data.tipo}. Valores: ${TIPOS_COMPROBANTE_FISCAL.join(", ")}`,
        API_ERROR_CODES.VALIDATION,
        400,
      );
    }
    const fact = await this.repo.facturacionDeCuota(cuotaId);
    const cuota = fact?.cuotas.find((c) => c.id === cuotaId);
    if (!fact || !cuota) {
      throw new DomainError("Cuota no encontrada", API_ERROR_CODES.NOT_FOUND, 404);
    }
    if (cuota.estado !== ESTADOS_CUOTA.PAGADO) {
      throw new DomainError("Solo se puede adjuntar el comprobante de una cuota pagada", API_ERROR_CODES.CONFLICT, 409);
    }
    await this.repo.adjuntarComprobanteFiscal(cuotaId, data, createdBy);
    if (fact.correoSolicitante) {
      try {
        const idioma = await resolverIdiomaDestinatario(this.authRepo, fact.correoSolicitante);
        await enviarEmailPlantilla({
          to: fact.correoSolicitante,
          plantilla: "comprobante-pago",
          idioma,
          datos: { standCode: fact.standCode, tipo: data.tipo, numero: data.numero },
        });
      } catch { /* el correo no bloquea el adjuntado */ }
    }
  }

  async actualizar(id: string, data: { tipo?: string; modoPago?: string }, createdBy: string): Promise<void> {
    if (data.modoPago !== undefined) {
      await this.validarConfiguracionEditable(id);
    }
    return this.repo.actualizar(id, data, createdBy);
  }

  async eliminar(id: string, createdBy: string): Promise<void> {
    return this.repo.eliminar(id, createdBy);
  }

  async eliminarCuota(cuotaId: string, createdBy: string): Promise<void> {
    const fact = await this.repo.facturacionDeCuota(cuotaId);
    if (fact?.planCliente) {
      throw new DomainError(
        "Las cuotas las definio el cliente en el contrato; no se pueden modificar. Aqui solo se confirman los pagos.",
        API_ERROR_CODES.CONFLICT,
        409,
      );
    }
    return this.repo.eliminarCuota(cuotaId, createdBy);
  }
}
