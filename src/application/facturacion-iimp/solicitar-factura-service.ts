import {
  API_ERROR_CODES,
  CUOTAS_PORCENTAJE_TOTAL,
  FACTURACION_IIMP,
  IIMP_CARGO_REPRESENTANTE,
  MAX_CUOTAS_IIMP,
  MAX_STANDS_IIMP,
  REGEX_DNI,
  REGEX_FECHA_ISO,
  REGEX_RUC,
  TIPOS_COMPROBANTE,
  TIPOS_DOCUMENTO_FACTURACION_IIMP,
  TIPOS_DOCUMENTO_PERSONA,
} from "@/lib/shared/constants";
import { DomainError } from "@/lib/server/router";
import type { ClienteIdent, IFacturacionRepository } from "@/domain/ports/facturacion-repository";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IEmpresaRepository } from "@/domain/ports/empresa-repository";
import type { IPersonaClient } from "@/domain/ports/persona-client";
import type { DatosFacturacionSolicitud } from "@/domain/models/entities";
import type { IReservaIimpClient, ReservaIimpDocumento, ReservaIimpInput } from "@/domain/ports/reserva-iimp-client";

export interface ResultadoSolicitudFactura {
  contrato: string;
  cuentaCorriente: number;
  documento: ReservaIimpDocumento | null;
}

/** Solo digitos (RUC/DNI llegan con puntos o espacios). */
function digitos(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\D/g, "");
}

/**
 * "Solicitar factura" desde Mis pagos: registra la reserva oficial en el API del IIMP
 * (`POST /stands/reserva`) y emite la factura/boleta de la 1ra cuota.
 *
 * Los datos fiscales salen del **snapshot del paso 1 del wizard**
 * (`solicitud.datos_facturacion`); la empresa vinculada es opcional y solo
 * enriquece (web, friso, representante, correo de facturacion). Para boleta a
 * persona natural se completan nombres/apellidos desde servicio-persona.
 */
export class SolicitarFacturaApplicationService {
  constructor(
    private readonly facturacion: IFacturacionRepository,
    private readonly solicitudes: ISolicitudesRepository,
    private readonly auth: IAuthRepository,
    private readonly empresas: IEmpresaRepository,
    private readonly reserva: IReservaIimpClient,
    private readonly personas: IPersonaClient,
  ) {}

  async solicitar(cuotaId: string, ident: ClienteIdent): Promise<ResultadoSolicitudFactura> {
    const propio = await this.facturacion.esPropietarioDeCuota(cuotaId, ident);
    if (!propio) throw new DomainError("Sin acceso a esta cuota", API_ERROR_CODES.FORBIDDEN, 403);
    const fact = await this.facturacion.facturacionDeCuota(cuotaId);
    if (!fact) throw new DomainError("Cuota no encontrada", API_ERROR_CODES.NOT_FOUND, 404);

    const datos = await this.solicitudes.datosReservaIImp(fact.solicitudId);
    if (!datos) throw new DomainError("Solicitud no encontrada", API_ERROR_CODES.NOT_FOUND, 404);
    if (datos.iimpContrato) {
      throw new DomainError(`La reserva ya fue registrada en el IIMP (contrato ${datos.iimpContrato})`, API_ERROR_CODES.CONFLICT, 409);
    }

    const snapshot = datos.datosFacturacion;
    /* Empresa vinculada: opcional (enriquece y cubre solicitudes sin snapshot). */
    const empresaId = datos.email ? await this.auth.findEmpresaIdDeUsuario(datos.email).catch(() => null) : null;
    const empresa = empresaId ? await this.empresas.findById(empresaId) : null;
    if (!snapshot && !empresa) {
      throw new DomainError(
        "La solicitud no tiene datos de facturacion; registra la empresa en Empresas o vuelve a reservar",
        API_ERROR_CODES.VALIDATION,
        400,
      );
    }

    if (datos.tipoEvento === null || datos.codigoEvento === null) {
      throw new DomainError("La solicitud no tiene un evento valido", API_ERROR_CODES.VALIDATION, 400);
    }
    if (datos.stands.length === 0) throw new DomainError("La solicitud no tiene stands", API_ERROR_CODES.VALIDATION, 400);
    if (datos.stands.length > MAX_STANDS_IIMP) throw new DomainError(`El IIMP permite reservar hasta ${MAX_STANDS_IIMP} stands por operacion`, API_ERROR_CODES.VALIDATION, 400);

    const cuotasPlan = datos.planCuotas?.cuotas ?? [];
    if (cuotasPlan.length === 0) throw new DomainError("La solicitud no tiene plan de cuotas", API_ERROR_CODES.VALIDATION, 400);
    if (cuotasPlan.length > MAX_CUOTAS_IIMP) {
      throw new DomainError(`El IIMP permite hasta ${MAX_CUOTAS_IIMP} cuotas`, API_ERROR_CODES.VALIDATION, 400);
    }
    /* El IIMP exige porcentajes enteros que sumen 100: se redondea y el ultimo absorbe el ajuste. */
    const porcentajes = cuotasPlan.map((c) => Math.round(c.porcentaje));
    if (porcentajes.some((p) => p <= 0)) {
      throw new DomainError("Los porcentajes de las cuotas deben ser enteros positivos", API_ERROR_CODES.VALIDATION, 400);
    }
    const ultimoIdx = porcentajes.length - 1;
    const ultimoAjustado = (porcentajes[ultimoIdx] ?? 0) + (CUOTAS_PORCENTAJE_TOTAL - porcentajes.reduce((s, p) => s + p, 0));
    if (ultimoAjustado <= 0) {
      throw new DomainError("No se pudo ajustar el plan de cuotas a porcentajes enteros", API_ERROR_CODES.VALIDATION, 400);
    }
    porcentajes[ultimoIdx] = ultimoAjustado;
    const cuotas = cuotasPlan.map((c, i) => {
      const fecha = (c.fechaVencimiento ?? "").slice(0, 10);
      if (!REGEX_FECHA_ISO.test(fecha)) {
        throw new DomainError("El plan de cuotas no tiene fechas validas (AAAA-MM-DD)", API_ERROR_CODES.VALIDATION, 400);
      }
      return { porcentaje: porcentajes[i] ?? 1, fecha };
    });

    const input = await this.armarPayload(snapshot, empresa, {
      tipEvCod: datos.tipoEvento,
      evenCod: datos.codigoEvento,
      stands: datos.stands,
      cuotas,
    });

    const respuesta = await this.reserva.reservar(input);

    await this.solicitudes.guardarReservaIImp(fact.solicitudId, {
      contrato: respuesta.contrato,
      cuentaCorriente: String(respuesta.cuentaCorriente),
      clienteCodigo: respuesta.cliente.codigo || null,
      reserva: respuesta,
      at: new Date(),
    });

    const documento = respuesta.cuotas.find((c) => c.cuota === 1)?.documento ?? null;
    if (documento) {
      await this.facturacion.guardarDocumentoIImp(fact.id, 1, documento, new Date());
    }

    return { contrato: respuesta.contrato, cuentaCorriente: respuesta.cuentaCorriente, documento };
  }

  /** Arma el payload del IIMP desde el snapshot (preferente) y la empresa (enriquecimiento). */
  private async armarPayload(
    snapshot: DatosFacturacionSolicitud | null,
    empresa: Awaited<ReturnType<IEmpresaRepository["findById"]>>,
    base: { tipEvCod: number; evenCod: number; stands: string[]; cuotas: Array<{ porcentaje: number; fecha: string }> },
  ): Promise<ReservaIimpInput> {
    const comprobante = snapshot?.tipoComprobante ?? empresa?.tipoComprobante ?? TIPOS_COMPROBANTE.FACTURA;
    const esBoleta = comprobante === TIPOS_COMPROBANTE.BOLETA;
    const direccion = snapshot?.direccion?.trim() || empresa?.direccionFiscal?.trim() || "";
    if (!direccion) {
      throw new DomainError("Falta la direccion fiscal del cliente en la solicitud", API_ERROR_CODES.VALIDATION, 400);
    }
    const email = snapshot?.email?.trim() || empresa?.emailFacturacion?.trim() || empresa?.emailContacto?.trim() || "";
    const telefono = snapshot?.telefono?.trim() || empresa?.telefono?.trim() || null;

    if (esBoleta) {
      const dni = digitos(snapshot?.numeroDocumento);
      if (!REGEX_DNI.test(dni)) {
        throw new DomainError("La boleta requiere DNI de 8 digitos en la solicitud", API_ERROR_CODES.VALIDATION, 400);
      }
      const persona = await this.personas.buscarPorDocumento(dni, TIPOS_DOCUMENTO_PERSONA.DNI).catch(() => null);
      if (!persona?.nombres || !persona.apellido_paterno) {
        throw new DomainError(`No se encontraron los datos del DNI ${dni} en el padron de personas`, API_ERROR_CODES.VALIDATION, 400);
      }
      const emailPagos = email || persona.correo?.trim() || "";
      if (!emailPagos) throw new DomainError("La boleta requiere correo de contacto en la solicitud", API_ERROR_CODES.VALIDATION, 400);
      const nombreContacto = [persona.nombres, persona.apellido_paterno, persona.apellido_materno].filter(Boolean).join(" ");
      return {
        ...base,
        tipoFacturacion: FACTURACION_IIMP.BOLETA,
        tipDocFacturacion: TIPOS_DOCUMENTO_FACTURACION_IIMP.DNI,
        numDocFacturacion: dni,
        apellidoPaternoFact: persona.apellido_paterno,
        apellidoMaternoFact: persona.apellido_materno ?? null,
        nombresFact: persona.nombres,
        dirFacturacion: direccion,
        telefono,
        friso: nombreContacto,
        contactos: {
          contrato: {
            nombre: snapshot?.contacto?.trim() || nombreContacto,
            ...(telefono ? { telefono } : {}),
            ...(emailPagos ? { email: emailPagos } : {}),
          },
          pagos: { nombre: nombreContacto, email: emailPagos, ...(telefono ? { telefono } : {}) },
        },
      };
    }

    const ruc = [digitos(snapshot?.numeroDocumento), digitos(empresa?.ruc)].find((v) => REGEX_RUC.test(v)) ?? "";
    if (!REGEX_RUC.test(ruc)) {
      throw new DomainError("La factura requiere un RUC de 11 digitos (revisa los datos de la solicitud)", API_ERROR_CODES.VALIDATION, 400);
    }
    const razonSocial = snapshot?.razonSocial?.trim() || empresa?.razonSocial?.trim() || "";
    if (!razonSocial) throw new DomainError("Falta la razon social en los datos de facturacion", API_ERROR_CODES.VALIDATION, 400);
    const emailPagos = email;
    if (!emailPagos) throw new DomainError("Falta el correo de facturacion (o de contacto) en la solicitud", API_ERROR_CODES.VALIDATION, 400);
    const nombreContacto = snapshot?.contacto?.trim() || empresa?.representanteLegalNombre?.trim() || razonSocial;
    const dniRepresentante = digitos(empresa?.representanteLegalDni);

    return {
      ...base,
      tipoFacturacion: FACTURACION_IIMP.FACTURA,
      tipDocFacturacion: TIPOS_DOCUMENTO_FACTURACION_IIMP.RUC,
      numDocFacturacion: ruc,
      razonSocial,
      dirFacturacion: direccion,
      web: empresa?.sitioWeb ?? null,
      telefono,
      friso: (empresa?.nombreComercial ?? razonSocial).trim() || null,
      contactos: {
        contrato: {
          nombre: nombreContacto,
          cargo: IIMP_CARGO_REPRESENTANTE,
          ...(dniRepresentante ? { tipoDocumento: TIPOS_DOCUMENTO_FACTURACION_IIMP.DNI, numDocumento: dniRepresentante } : {}),
          email: emailPagos,
          ...(telefono ? { telefono } : {}),
        },
        pagos: { nombre: nombreContacto, email: emailPagos, ...(telefono ? { telefono } : {}) },
      },
    };
  }
}
