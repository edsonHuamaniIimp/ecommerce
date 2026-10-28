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
  TIPOS_ARCHIVO_IIMP,
} from "@/lib/shared/constants";
import { DomainError } from "@/lib/server/router";
import type { ClienteIdent, IFacturacionRepository } from "@/domain/ports/facturacion-repository";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IEmpresaRepository } from "@/domain/ports/empresa-repository";
import type { IPersonaClient } from "@/domain/ports/persona-client";
import type { IConsultaDocumentoClient } from "@/domain/ports/consulta-documento-client";
import type { DatosFacturacionSolicitud } from "@/domain/models/entities";
import type { IReservaIimpClient, ReservaIimpArchivoInput, ReservaIimpDocumento, ReservaIimpInput } from "@/domain/ports/reserva-iimp-client";
import { validarArchivoIImp, normalizarLinkArchivoIImp } from "./validar-archivo-iimp";
import { numeroSolicitudIImp } from "./numero-solicitud";

export interface ResultadoSolicitudFactura {
  numeroSolicitud: string;
  contrato: string;
  cuentaCorriente: number;
  documento: ReservaIimpDocumento | null;
  /** Payload exacto enviado al IIMP (validacion/transparencia en la respuesta interna). */
  payloadEnviado: ReservaIimpInput;
}

/**
 * Declaracion del cliente sobre los requisitos de facturacion de su empresa
 * (checklist acordado): OC, HES, registro en plataforma de proveedores (con
 * nombre y enlace), valorizacion/cotizacion, otros o "ninguna de las anteriores".
 */
export interface RequisitosFacturacionInput {
  oc?: boolean;
  hes?: boolean;
  plataforma?: boolean;
  plataformaNombre?: string | null;
  plataformaUrl?: string | null;
  valorizacion?: boolean;
  otros?: string | null;
  /** Mi empresa no requiere estos documentos (extranjeras o sin orden de compra). */
  ninguna?: boolean;
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
    private readonly consultaDocumento: IConsultaDocumentoClient,
  ) {}

  async solicitar(cuotaId: string, ident: ClienteIdent, archivos: ReservaIimpArchivoInput[] = [], requisitos: RequisitosFacturacionInput | null = null): Promise<ResultadoSolicitudFactura> {
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

    /* Los archivos viajan en la misma reserva: se descartan los que no traen link (v3),
       se normaliza el link a URL absoluta y se validan con las reglas del IIMP. */
    const archivosNormalizados = archivos
      .filter((a) => a.link?.trim())
      .map((a) => ({ ...a, link: normalizarLinkArchivoIImp(a.link) }));
    for (const archivo of archivosNormalizados) {
      validarArchivoIImp(archivo, cuotasPlan.length);
    }

    /* Requisitos declarados por el cliente: la 1ra cuota exige OC y HES salvo que
       declare "ninguna de las anteriores" (empresas extranjeras o sin orden de compra). */
    const requisitosDeclarados = requisitos ? this.normalizarRequisitos(requisitos) : null;
    if (!requisitosDeclarados?.ninguna) {
      const esDePrimeraCuota = (a: (typeof archivosNormalizados)[number]) => a.cuota == null || a.cuota === 1;
      const tiposPrimeraCuota = new Set(archivosNormalizados.filter(esDePrimeraCuota).map((a) => a.tipo));
      if (!tiposPrimeraCuota.has(TIPOS_ARCHIVO_IIMP.OC) || !tiposPrimeraCuota.has(TIPOS_ARCHIVO_IIMP.HES)) {
        throw new DomainError(
          "La primera cuota requiere adjuntar al menos una OC y una HES (o marcar 'Ninguna de las anteriores')",
          API_ERROR_CODES.VALIDATION,
          400,
        );
      }
    }

    const numeroSolicitud = numeroSolicitudIImp(fact.solicitudId);
    const input = await this.armarPayload(snapshot, empresa, {
      numeroSolicitud,
      tipEvCod: datos.tipoEvento,
      evenCod: datos.codigoEvento,
      stands: datos.stands,
      cuotas,
      ...(archivosNormalizados.length > 0 ? { archivos: archivosNormalizados } : {}),
    });

    const respuesta = await this.reserva.reservar(input);

    await this.solicitudes.guardarReservaIImp(fact.solicitudId, {
      contrato: respuesta.contrato,
      cuentaCorriente: String(respuesta.cuentaCorriente),
      clienteCodigo: respuesta.cliente.codigo || null,
      reserva: respuesta,
      at: new Date(),
      requisitos: requisitosDeclarados ? { ...requisitosDeclarados, cuota: fact.cuotas.find((c) => c.id === cuotaId)?.numero ?? null } : null,
    });

    const documento = respuesta.cuotas.find((c) => c.cuota === 1)?.documento ?? null;
    if (documento) {
      await this.facturacion.guardarDocumentoIImp(fact.id, 1, documento, new Date());
    }

    return {
      numeroSolicitud: respuesta.numeroSolicitud || numeroSolicitud,
      contrato: respuesta.contrato,
      cuentaCorriente: respuesta.cuentaCorriente,
      documento,
      payloadEnviado: input,
    };
  }

  /** Normaliza la declaracion de requisitos y valida el enlace de la plataforma. */
  private normalizarRequisitos(input: RequisitosFacturacionInput): RequisitosFacturacionInput {
    const enlace = (input.plataformaUrl ?? "").trim();
    if (enlace && !/^https?:\/\/\S+$/i.test(enlace)) {
      throw new DomainError("El enlace de la plataforma debe ser una URL http(s) valida", API_ERROR_CODES.VALIDATION, 400);
    }
    return {
      oc: input.oc === true,
      hes: input.hes === true,
      plataforma: input.plataforma === true,
      plataformaNombre: (input.plataformaNombre ?? "").trim() || null,
      plataformaUrl: enlace || null,
      valorizacion: input.valorizacion === true,
      otros: (input.otros ?? "").trim() || null,
      ninguna: input.ninguna === true,
    };
  }

  /** Arma el payload del IIMP desde el snapshot (preferente) y la empresa (enriquecimiento). */
  private async armarPayload(
    snapshot: DatosFacturacionSolicitud | null,
    empresa: Awaited<ReturnType<IEmpresaRepository["findById"]>>,
    base: { numeroSolicitud: string; tipEvCod: number; evenCod: number; stands: string[]; cuotas: Array<{ porcentaje: number; fecha: string }>; archivos?: ReservaIimpArchivoInput[] },
  ): Promise<ReservaIimpInput> {
    /* Tipo normalizado: define el payload del IIMP (01 factura / 03 boleta). No se asume
     * factura en silencio: si ninguna fuente trae un tipo valido, se rechaza. */
    const comprobante = (snapshot?.tipoComprobante?.trim() || empresa?.tipoComprobante?.trim() || "").toLowerCase();
    if (comprobante !== TIPOS_COMPROBANTE.FACTURA && comprobante !== TIPOS_COMPROBANTE.BOLETA) {
      throw new DomainError("El tipo de comprobante de la solicitud no es valido (factura|boleta)", API_ERROR_CODES.VALIDATION, 400);
    }
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
      type TitularBoleta = { nombres: string; apellidoPaterno: string; apellidoMaterno: string | null; correo: string | null };
      let titular: TitularBoleta | null = persona?.nombres && persona.apellido_paterno
        ? { nombres: persona.nombres, apellidoPaterno: persona.apellido_paterno, apellidoMaterno: persona.apellido_materno ?? null, correo: persona.correo ?? null }
        : null;
      /* Respaldo RENIEC: son datos de facturacion y el DNI puede no existir en el padron interno. */
      if (!titular) {
        const reniec = await this.consultaDocumento.consultarDni(dni).catch(() => null);
        if (reniec?.nombres && reniec.apellidoPaterno) {
          titular = { nombres: reniec.nombres, apellidoPaterno: reniec.apellidoPaterno, apellidoMaterno: reniec.apellidoMaterno ?? null, correo: null };
        }
      }
      if (!titular) {
        throw new DomainError(`No se encontraron los datos del DNI ${dni} (padron de personas ni RENIEC)`, API_ERROR_CODES.VALIDATION, 400);
      }
      const emailPagos = email || titular.correo?.trim() || "";
      if (!emailPagos) throw new DomainError("La boleta requiere correo de contacto en la solicitud", API_ERROR_CODES.VALIDATION, 400);
      const nombreContacto = [titular.nombres, titular.apellidoPaterno, titular.apellidoMaterno].filter(Boolean).join(" ");
      return {
        ...base,
        tipoFacturacion: FACTURACION_IIMP.BOLETA,
        tipDocFacturacion: TIPOS_DOCUMENTO_FACTURACION_IIMP.DNI,
        numDocFacturacion: dni,
        apellidoPaternoFact: titular.apellidoPaterno,
        apellidoMaternoFact: titular.apellidoMaterno,
        nombresFact: titular.nombres,
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
