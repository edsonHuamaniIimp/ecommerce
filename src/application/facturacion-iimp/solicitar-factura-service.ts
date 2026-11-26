import {
  API_ERROR_CODES,
  CUOTAS_PORCENTAJE_TOTAL,
  FACTURACION_IIMP,
  IIMP_CARGO_REPRESENTANTE,
  MAX_ARCHIVOS_IIMP_POR_LLAMADA,
  MAX_CUOTAS_IIMP,
  MAX_DESCRIPCION_FACTURA,
  MAX_STANDS_IIMP,
  REGEX_FECHA_ISO,
  REGEX_RUC,
  TIPOS_COMPROBANTE,
  TIPOS_DOCUMENTO_EMPRESA,
  TIPOS_DOCUMENTO_FACTURACION_IIMP,
  TIPOS_DOCUMENTO_PERSONA,
  TIPOS_SOLICITUD,
} from "@/lib/shared/constants";
import { DomainError } from "@/lib/server/router";
import type { ClienteIdent, IFacturacionRepository } from "@/domain/ports/facturacion-repository";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IEmpresaRepository } from "@/domain/ports/empresa-repository";
import type { IPersonaClient } from "@/domain/ports/persona-client";
import type { IConsultaDocumentoClient } from "@/domain/ports/consulta-documento-client";
import type { DatosFacturacionSolicitud } from "@/domain/models/entities";
import type { IFacturacionIntentoRepository } from "@/domain/ports/facturacion-intento-repository";
import type { IReservaIimpClient, ReservaIimpArchivoInput, ReservaIimpCuotaInput, ReservaIimpDocumento, ReservaIimpInput } from "@/domain/ports/reserva-iimp-client";
import { validarArchivoIImp, normalizarLinkArchivoIImp } from "./validar-archivo-iimp";
import { numeroSolicitudIImp } from "./numero-solicitud";
import { extensionReserva } from "./extension-reserva-iimp";
import { normalizarDocumentoEmpresa, resolverTipoDocumentoEmpresa, validarDocumentoEmpresa } from "@/lib/shared/utils/documento-empresa";
import { normalizarDocumentoPersona, normalizarTipoDocumentoPersona, validarDocumentoPersona } from "@/lib/shared/utils/documento-persona";
import { codigoUbigeoDePais } from "@/lib/shared/utils/pais";
import { mapSolicitudVigente } from "./solicitud-vigente-mapper";
import type { SolicitudVigenteResponseDTO } from "@/types/dto/facturacion/solicitud-vigente-response.dto";
import { requisitosVacios, type RequisitosFacturacionDeclarados } from "@/lib/shared/utils/requisitos-facturacion";
import { diasParaHabilitarSolicitudFactura, solicitudFacturaHabilitada } from "@/lib/shared/utils/facturacion";

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
  /** Texto libre para la factura de la cuota (SIE `TextoLibre`, max. 100). */
  descripcionFactura?: string | null;
}

/** Quien registra la solicitud de factura (trazabilidad hacia el SIE en solicitudes internas). */
export interface OrigenSolicitudFactura {
  registradoPor: string | null;
  /** ISO-8601 UTC: fecha y hora que Facturacion programo (tarea automatica). */
  programadaPara?: string | null;
}

/** Lo que se sabe de la solicitud en curso, para la bitacora si falla. */
interface CapturaSolicitud {
  solicitudId: string | null;
  payload: ReservaIimpInput | null;
  requisitos: RequisitosFacturacionInput | null;
  archivos: ReservaIimpArchivoInput[];
  /** El SIE respondio bien (si despues falla, el error es del guardado local). */
  respondio: boolean;
}

/** Solo digitos (RUC/DNI llegan con puntos o espacios). */
function digitos(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\D/g, "");
}

/** Tipo de documento de la persona (servicio-persona) -> codigo de `TipDocFacturacion` del IIMP. */
const TIPO_DOC_IIMP_POR_PERSONA: Record<string, string> = {
  [TIPOS_DOCUMENTO_PERSONA.DNI]: TIPOS_DOCUMENTO_FACTURACION_IIMP.DNI,
  [TIPOS_DOCUMENTO_PERSONA.CARNE_EXTRANJERIA]: TIPOS_DOCUMENTO_FACTURACION_IIMP.CARNE_EXTRANJERIA,
  [TIPOS_DOCUMENTO_PERSONA.PASAPORTE]: TIPOS_DOCUMENTO_FACTURACION_IIMP.PASAPORTE,
};

/**
 * Parte un nombre completo en apellidos y nombres. Acepta "APELLIDOS, NOMBRES" (formato de la
 * ficha) o "NOMBRES APELLIDO": en el segundo caso la ultima palabra es el apellido paterno.
 */
function separarNombreExtranjero(
  completo: string | null | undefined,
): { nombres: string; apellidoPaterno: string; apellidoMaterno: string | null } | null {
  const texto = (completo ?? "").trim().replace(/\s+/g, " ");
  if (!texto) return null;
  const [antes = "", despues = ""] = texto.split(",").map((parte) => parte.trim());
  if (despues) {
    const [paterno = "", ...resto] = antes.split(" ");
    return paterno ? { nombres: despues, apellidoPaterno: paterno, apellidoMaterno: resto.join(" ") || null } : null;
  }
  const palabras = texto.split(" ");
  const paterno = palabras.pop() ?? "";
  if (!palabras.length || !paterno) return null;
  return { nombres: palabras.join(" "), apellidoPaterno: paterno, apellidoMaterno: null };
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
    /** Enviar al SIE el tipo de cambio pactado y, en solicitudes internas, el detalle comercial. */
    private readonly enviarCamposExtendidos: boolean = false,
    /** Bitacora de solicitudes fallidas (opcional): conserva lo declarado para reenviarlo. */
    private readonly intentos: IFacturacionIntentoRepository | null = null,
  ) {}

  async solicitar(cuotaId: string, ident: ClienteIdent, archivos: ReservaIimpArchivoInput[] = [], requisitos: RequisitosFacturacionInput | null = null, origen: OrigenSolicitudFactura | null = null): Promise<ResultadoSolicitudFactura> {
    const captura: CapturaSolicitud = { solicitudId: null, payload: null, requisitos: null, archivos: [], respondio: false };
    try {
      return await this.ejecutarSolicitud(cuotaId, ident, archivos, requisitos, origen, captura);
    } catch (e) {
      /* Solo si el envio llego a armarse: se guarda lo declarado para reenviarlo sin pedirlo de nuevo. */
      await this.registrarFallo(cuotaId, ident, origen, captura, e);
      throw e;
    }
  }

  /** Empresa vinculada a la solicitud: opcional (enriquece y cubre solicitudes sin snapshot). */
  private async resolverEmpresaDeSolicitud(datos: { email: string | null; datosFacturacion: DatosFacturacionSolicitud | null }) {
    const snapshot = datos.datosFacturacion;
    const empresaId = datos.email ? await this.auth.findEmpresaIdDeUsuario(datos.email).catch(() => null) : null;
    let empresa = empresaId ? await this.empresas.findById(empresaId) : null;
    /* Empresa extranjera: si el correo de la solicitud no pertenece a un usuario vinculado, se ubica por su documento (RUT/ID). */
    if (!empresa && snapshot?.tipoDocumento?.trim() === TIPOS_DOCUMENTO_EMPRESA.NO_DOMICILIADO && snapshot.numeroDocumento) {
      empresa = await this.empresas.findByRuc(normalizarDocumentoEmpresa(snapshot.numeroDocumento)).catch(() => null);
    }
    return empresa;
  }

  /**
   * API de solo lectura para el SIE: devuelve los datos VIGENTES de la solicitud (cliente facturado
   * incluido) armados con la misma logica del envio, sin enviar ni modificar nada. Busca por
   * `numeroSolicitud` o por `contrato`.
   */
  async consultarVigente(input: { numeroSolicitud?: string | null; contrato?: string | null }): Promise<SolicitudVigenteResponseDTO> {
    const numero = input.numeroSolicitud?.trim() ?? "";
    const contrato = input.contrato?.trim() ?? "";
    if (!numero && !contrato) {
      throw new DomainError("numeroSolicitud o contrato es obligatorio", API_ERROR_CODES.VALIDATION, 400);
    }
    const solicitudId = numero ? await this.solicitudes.findSolicitudIdPorNumeroIImp(numero) : await this.solicitudes.findSolicitudIdPorContrato(contrato);
    if (!solicitudId) throw new DomainError("Solicitud no encontrada", API_ERROR_CODES.NOT_FOUND, 404);
    const datos = await this.solicitudes.datosReservaIImp(solicitudId);
    if (!datos) throw new DomainError("Solicitud no encontrada", API_ERROR_CODES.NOT_FOUND, 404);

    const snapshot = datos.datosFacturacion;
    const empresa = await this.resolverEmpresaDeSolicitud(datos);
    if (!snapshot && !empresa) {
      throw new DomainError("La solicitud no tiene datos de facturacion", API_ERROR_CODES.VALIDATION, 400);
    }
    const numeroSolicitud = numeroSolicitudIImp(solicitudId);
    const correoCliente = await this.resolverCorreoFacturacion(empresa, datos.email);
    const payload = await this.armarPayload(snapshot, empresa, correoCliente, {
      numeroSolicitud,
      tipEvCod: datos.tipoEvento ?? 0,
      evenCod: datos.codigoEvento ?? 0,
      stands: datos.stands,
      cuotas: [],
    });
    return mapSolicitudVigente(numeroSolicitud, datos, payload);
  }

  /** Guarda en la bitacora (best-effort) lo que el usuario declaro cuando el SIE fallo; nunca oculta el error original. */
  private async registrarFallo(cuotaId: string, ident: ClienteIdent, origen: OrigenSolicitudFactura | null, captura: CapturaSolicitud, error: unknown): Promise<void> {
    if (!this.intentos || !captura.solicitudId || !captura.payload) return;
    try {
      const detalle = error instanceof DomainError ? (error.detalle as { httpStatus?: number; cuerpo?: { identificador?: string } } | undefined) : undefined;
      await this.intentos.registrarFallo({
        solicitudId: captura.solicitudId,
        cuotaId,
        origen: origen ? (origen.programadaPara ? "programada" : "staff") : "cliente",
        actor: origen ? origen.registradoPor : (ident.email ?? null),
        resultado: captura.respondio ? "error_posterior" : "error_sie",
        httpStatus: detalle?.httpStatus ?? (error instanceof DomainError ? error.status : null),
        mensaje: error instanceof Error ? error.message : String(error),
        identificadorSie: detalle?.cuerpo?.identificador ?? null,
        requisitos: captura.requisitos,
        archivos: captura.archivos,
        payload: captura.payload,
        respuestaSie: detalle?.cuerpo ?? null,
      });
    } catch (e) {
      console.error("[facturacion-intento] no se pudo registrar el fallo", e instanceof Error ? e.message : e);
    }
  }

  private async ejecutarSolicitud(cuotaId: string, ident: ClienteIdent, archivos: ReservaIimpArchivoInput[], requisitos: RequisitosFacturacionInput | null, origen: OrigenSolicitudFactura | null, captura: CapturaSolicitud): Promise<ResultadoSolicitudFactura> {
    const propio = await this.facturacion.esPropietarioDeCuota(cuotaId, ident);
    if (!propio) throw new DomainError("Sin acceso a esta cuota", API_ERROR_CODES.FORBIDDEN, 403);
    const fact = await this.facturacion.facturacionDeCuota(cuotaId);
    if (!fact) throw new DomainError("Cuota no encontrada", API_ERROR_CODES.NOT_FOUND, 404);

    /* La solicitud se habilita 30 dias antes de la fecha configurada de la cuota. */
    const cuotaOrigen = fact.cuotas.find((c) => c.id === cuotaId);
    if (!cuotaOrigen) throw new DomainError("Cuota no encontrada", API_ERROR_CODES.NOT_FOUND, 404);
    if (!solicitudFacturaHabilitada(cuotaOrigen.fechaVencimiento, cuotaOrigen.numero)) {
      const dias = diasParaHabilitarSolicitudFactura(cuotaOrigen.fechaVencimiento);
      throw new DomainError(
        `La solicitud de factura se habilita 30 dias antes de la fecha de la cuota${dias !== null ? ` (faltan ${dias} dias)` : ""}`,
        API_ERROR_CODES.CONFLICT,
        409,
      );
    }

    const datos = await this.solicitudes.datosReservaIImp(fact.solicitudId);
    if (!datos) throw new DomainError("Solicitud no encontrada", API_ERROR_CODES.NOT_FOUND, 404);
    if (datos.iimpContrato) {
      throw new DomainError(`La reserva ya fue registrada en el IIMP (contrato ${datos.iimpContrato})`, API_ERROR_CODES.CONFLICT, 409);
    }

    const snapshot = datos.datosFacturacion;
    const empresa = await this.resolverEmpresaDeSolicitud(datos);
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
    const cuotas: ReservaIimpCuotaInput[] = cuotasPlan.map((c, i) => {
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

    /* Requisitos de facturacion: la declaracion del cliente es referencial (no bloquea
       la solicitud); se guarda con la cuota de origen para Facturacion. */
    const requisitosDeclarados = requisitos ? this.normalizarRequisitos(requisitos) : null;
    /* Texto libre de la factura (SIE `TextoLibre`): aplica a la cuota desde la que se
       solicita y viaja en el payload de la reserva (una sola vez). */
    if (requisitosDeclarados?.descripcionFactura) {
      const cuotaOrigen = fact.cuotas.find((c) => c.id === cuotaId)?.numero ?? 1;
      const indice = cuotaOrigen - 1;
      if (cuotas[indice]) {
        cuotas[indice] = { ...cuotas[indice], textoLibre: requisitosDeclarados.descripcionFactura };
      }
    }

    const numeroSolicitud = numeroSolicitudIImp(fact.solicitudId);
    const cuotaOrigenNumero = fact.cuotas.find((c) => c.id === cuotaId)?.numero ?? null;
    const extension = this.enviarCamposExtendidos
      ? extensionReserva({
          moneda: datos.moneda,
          tipoCambio: datos.tipoCambio,
          plan: datos.planCuotas,
          cuotas,
          stands: datos.standsPrecio ?? [],
          interna: fact.tipoSolicitud === TIPOS_SOLICITUD.RESERVA_EMPRESA,
          requisitos: requisitosDeclarados
            ? {
                oc: requisitosDeclarados.oc === true,
                hes: requisitosDeclarados.hes === true,
                plataforma: requisitosDeclarados.plataforma === true,
                plataformaNombre: requisitosDeclarados.plataformaNombre ?? null,
                plataformaUrl: requisitosDeclarados.plataformaUrl ?? null,
                valorizacion: requisitosDeclarados.valorizacion === true,
                otros: requisitosDeclarados.otros ?? null,
                ninguna: requisitosDeclarados.ninguna === true,
                cuotaOrigen: cuotaOrigenNumero,
              }
            : null,
          origen: origen ? { tipoSolicitud: TIPOS_SOLICITUD.RESERVA_EMPRESA, registradoPor: origen.registradoPor, programadaPara: origen.programadaPara ?? null } : null,
          ahora: new Date(),
        })
      : {};
    const correoCliente = await this.resolverCorreoFacturacion(empresa, datos.email);
    const input = await this.armarPayload(snapshot, empresa, correoCliente, {
      ...extension,
      numeroSolicitud,
      tipEvCod: datos.tipoEvento,
      evenCod: datos.codigoEvento,
      moneda: datos.moneda,
      stands: datos.stands,
      cuotas: extension.cuotas ?? cuotas,
      ...(archivosNormalizados.length > 0 ? { archivos: archivosNormalizados } : {}),
    });

    captura.solicitudId = fact.solicitudId;
    captura.payload = input;
    captura.requisitos = requisitosDeclarados;
    captura.archivos = archivosNormalizados;
    const respuesta = await this.reserva.reservar(input);
    captura.respondio = true;

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

  /**
   * Completa la declaracion de requisitos de una solicitud que ya se registro en
   * el IIMP con el checklist vacio (casos previos a la validacion). Actualiza solo
   * el dato local y, si el cliente adjunta documentos, los agrega a la cuenta
   * corriente existente. No reenvia la reserva (NumeroSolicitud es unico).
   */
  async completarRequisitos(
    cuotaId: string,
    ident: ClienteIdent,
    archivos: ReservaIimpArchivoInput[] = [],
    requisitos: RequisitosFacturacionInput | null = null,
  ): Promise<void> {
    const propio = await this.facturacion.esPropietarioDeCuota(cuotaId, ident);
    if (!propio) throw new DomainError("Sin acceso a esta cuota", API_ERROR_CODES.FORBIDDEN, 403);
    const fact = await this.facturacion.facturacionDeCuota(cuotaId);
    if (!fact) throw new DomainError("Cuota no encontrada", API_ERROR_CODES.NOT_FOUND, 404);
    const datos = await this.solicitudes.datosReservaIImp(fact.solicitudId);
    if (!datos) throw new DomainError("Solicitud no encontrada", API_ERROR_CODES.NOT_FOUND, 404);
    if (!datos.iimpContrato || Number(datos.iimpCuentaCorriente ?? 0) <= 0) {
      throw new DomainError(
        "La reserva aun no esta registrada en el IIMP; envia primero tu solicitud de factura",
        API_ERROR_CODES.CONFLICT,
        409,
      );
    }
    if (!requisitosVacios(datos.requisitosFacturacion as RequisitosFacturacionDeclarados | null)) {
      throw new DomainError("Los requisitos de facturacion ya fueron declarados", API_ERROR_CODES.CONFLICT, 409);
    }
    if (!requisitos) {
      throw new DomainError("Declara al menos un requisito o marca 'Ninguna de las anteriores'", API_ERROR_CODES.VALIDATION, 400);
    }

    const normalizados = this.normalizarRequisitos(requisitos);
    const cuotasPlan = datos.planCuotas?.cuotas?.length ?? 0;
    const archivosNormalizados = archivos
      .filter((archivo) => archivo.link?.trim())
      .map((archivo) => ({ ...archivo, link: normalizarLinkArchivoIImp(archivo.link) }));
    for (const archivo of archivosNormalizados) {
      validarArchivoIImp(archivo, cuotasPlan);
    }
    if (archivosNormalizados.length > 0) {
      const cuenta = { numeroSolicitud: numeroSolicitudIImp(fact.solicitudId) };
      for (let i = 0; i < archivosNormalizados.length; i += MAX_ARCHIVOS_IIMP_POR_LLAMADA) {
        await this.reserva.agregarArchivos({
          ...cuenta,
          archivos: archivosNormalizados.slice(i, i + MAX_ARCHIVOS_IIMP_POR_LLAMADA),
        });
      }
    }

    const previos = datos.requisitosFacturacion as { cuota?: number } | null;
    await this.solicitudes.actualizarRequisitosFacturacion(fact.solicitudId, {
      ...normalizados,
      cuota: previos?.cuota ?? fact.cuotas.find((c) => c.id === cuotaId)?.numero ?? 1,
    });
  }

  /**
   * Version para Facturacion: registra la solicitud en nombre del cliente (resuelve
   * su correo) cuando el cliente aun no la envio desde Mis documentos.
   */
  async solicitarComoStaff(
    cuotaId: string,
    archivos: ReservaIimpArchivoInput[] = [],
    requisitos: RequisitosFacturacionInput | null = null,
    origen: OrigenSolicitudFactura | null = null,
  ): Promise<ResultadoSolicitudFactura> {
    const fact = await this.facturacion.facturacionDeCuota(cuotaId);
    if (!fact) throw new DomainError("Cuota no encontrada", API_ERROR_CODES.NOT_FOUND, 404);
    const datos = await this.solicitudes.datosReservaIImp(fact.solicitudId);
    if (!datos?.email) {
      throw new DomainError("La solicitud no tiene correo de cliente", API_ERROR_CODES.VALIDATION, 400);
    }
    return this.solicitar(cuotaId, { email: datos.email }, archivos, requisitos, origen);
  }

  /**
   * Version para Facturacion: resuelve el cliente de la solicitud y completa los
   * requisitos en su nombre (misma logica que el flujo del cliente).
   */
  async completarRequisitosComoStaff(
    cuotaId: string,
    archivos: ReservaIimpArchivoInput[] = [],
    requisitos: RequisitosFacturacionInput | null = null,
  ): Promise<void> {
    const fact = await this.facturacion.facturacionDeCuota(cuotaId);
    if (!fact) throw new DomainError("Cuota no encontrada", API_ERROR_CODES.NOT_FOUND, 404);
    const datos = await this.solicitudes.datosReservaIImp(fact.solicitudId);
    if (!datos?.email) {
      throw new DomainError("La solicitud no tiene correo de cliente", API_ERROR_CODES.VALIDATION, 400);
    }
    await this.completarRequisitos(cuotaId, { email: datos.email }, archivos, requisitos);
  }

  /** Normaliza la declaracion de requisitos y valida el enlace de la plataforma. */
  normalizarRequisitos(input: RequisitosFacturacionInput): RequisitosFacturacionInput {
    const enlace = (input.plataformaUrl ?? "").trim();
    if (enlace && !/^https?:\/\/\S+$/i.test(enlace)) {
      throw new DomainError("El enlace de la plataforma debe ser una URL http(s) valida", API_ERROR_CODES.VALIDATION, 400);
    }
    const descripcion = (input.descripcionFactura ?? "").trim();
    if (descripcion.length > MAX_DESCRIPCION_FACTURA) {
      throw new DomainError(
        `La descripcion de la factura no puede superar ${MAX_DESCRIPCION_FACTURA} caracteres`,
        API_ERROR_CODES.VALIDATION,
        400,
      );
    }
    const normalizado: RequisitosFacturacionInput = {
      oc: input.oc === true,
      hes: input.hes === true,
      plataforma: input.plataforma === true,
      plataformaNombre: (input.plataformaNombre ?? "").trim() || null,
      plataformaUrl: enlace || null,
      valorizacion: input.valorizacion === true,
      otros: (input.otros ?? "").trim() || null,
      ninguna: input.ninguna === true,
      descripcionFactura: descripcion || null,
    };
    /* El cliente debe declarar al menos un requisito (o marcar "Ninguna"); el modal
       envia un objeto aun sin seleccion, por eso se valida aqui y no en el null. */
    const declaro =
      normalizado.oc ||
      normalizado.hes ||
      normalizado.plataforma ||
      normalizado.valorizacion ||
      Boolean(normalizado.otros) ||
      normalizado.ninguna;
    if (!declaro) {
      throw new DomainError(
        "Declara al menos un requisito o marca 'Ninguna de las anteriores'",
        API_ERROR_CODES.VALIDATION,
        400,
      );
    }
    return normalizado;
  }

  /**
   * Correo del cliente que viaja al SIE (contactos de contrato y de pagos), por prioridad:
   * 1) responsable de pagos de la empresa, 2) correo de facturacion de la empresa,
   * 3) correo de notificaciones que el cliente eligio en su perfil (o su correo de acceso).
   * Cadena vacia si ninguno existe; entonces `armarPayload` recurre a los datos de la solicitud.
   */
  private async resolverCorreoFacturacion(
    empresa: Awaited<ReturnType<IEmpresaRepository["findById"]>>,
    emailSolicitante: string | null | undefined,
  ): Promise<string> {
    const deEmpresa = empresa?.responsablePagosEmail?.trim() || empresa?.emailFacturacion?.trim();
    if (deEmpresa) return deEmpresa;
    if (!emailSolicitante) return "";
    try {
      const perfil = await this.auth.findPerfilByEmail(emailSolicitante);
      return perfil?.notificationEmail?.trim() || perfil?.email?.trim() || "";
    } catch {
      return "";
    }
  }

  /** Arma el payload del IIMP desde el snapshot (preferente) y la empresa (enriquecimiento). */
  private async armarPayload(
    snapshot: DatosFacturacionSolicitud | null,
    empresa: Awaited<ReturnType<IEmpresaRepository["findById"]>>,
    correoCliente: string,
    base: Partial<ReservaIimpInput> & { numeroSolicitud: string; tipEvCod: number; evenCod: number; stands: string[]; cuotas: ReservaIimpCuotaInput[] },
  ): Promise<ReservaIimpInput> {
    /* Tipo normalizado: define el payload del IIMP (01 factura / 03 boleta). No se asume
     * factura en silencio: si ninguna fuente trae un tipo valido, se rechaza. */
    const comprobante = (snapshot?.tipoComprobante?.trim() || empresa?.tipoComprobante?.trim() || "").toLowerCase();
    if (comprobante !== TIPOS_COMPROBANTE.FACTURA && comprobante !== TIPOS_COMPROBANTE.BOLETA) {
      throw new DomainError("El tipo de comprobante de la solicitud no es valido (factura|boleta)", API_ERROR_CODES.VALIDATION, 400);
    }
    /* Empresa extranjera (RUT/ID, tipo 0): el comprobante va a la EMPRESA como boleta (03) con TipDocFacturacion 0
       (doc IIMP 2.4), nunca a su representante. Un RUC peruano valido sigue el camino normal. */
    const tipoDocumentoFuente = (snapshot?.tipoDocumento?.trim() || empresa?.tipoDocumento?.trim() || "");
    const documentoFuente = normalizarDocumentoEmpresa(snapshot?.numeroDocumento || empresa?.ruc);
    const esEmpresaExtranjera = tipoDocumentoFuente === TIPOS_DOCUMENTO_EMPRESA.NO_DOMICILIADO && !REGEX_RUC.test(documentoFuente);
    const esBoleta = comprobante === TIPOS_COMPROBANTE.BOLETA && !esEmpresaExtranjera;
    const direccion = snapshot?.direccion?.trim() || empresa?.direccionFiscal?.trim() || "";
    if (!direccion) {
      throw new DomainError("Falta la direccion fiscal del cliente en la solicitud", API_ERROR_CODES.VALIDATION, 400);
    }
    /* El correo del paso 1 de la reserva ya no manda: solo evita bloquear el envio si no hay otro. */
    const email = correoCliente || snapshot?.email?.trim() || empresa?.emailContacto?.trim() || "";
    const telefono = snapshot?.telefono?.trim() || empresa?.telefono?.trim() || null;

    if (esBoleta) {
      /* El titular de la boleta puede ser DNI, carne de extranjeria o pasaporte (doc IIMP 2.4). */
      const tipoPersona = normalizarTipoDocumentoPersona(snapshot?.tipoDocumento || TIPOS_DOCUMENTO_PERSONA.DNI);
      const dni = normalizarDocumentoPersona(tipoPersona, snapshot?.numeroDocumento);
      if (validarDocumentoPersona(tipoPersona, dni)) {
        throw new DomainError(
          tipoPersona === TIPOS_DOCUMENTO_PERSONA.DNI
            ? "La boleta requiere DNI de 8 digitos en la solicitud"
            : "La boleta requiere un documento alfanumerico valido (carne de extranjeria o pasaporte) en la solicitud",
          API_ERROR_CODES.VALIDATION,
          400,
        );
      }
      const persona = await this.personas.buscarPorDocumento(dni, tipoPersona).catch(() => null);
      type TitularBoleta = { nombres: string; apellidoPaterno: string; apellidoMaterno: string | null; correo: string | null };
      let titular: TitularBoleta | null = persona?.nombres && persona.apellido_paterno
        ? { nombres: persona.nombres, apellidoPaterno: persona.apellido_paterno, apellidoMaterno: persona.apellido_materno ?? null, correo: persona.correo ?? null }
        : null;
      /* Respaldo RENIEC: son datos de facturacion y el DNI puede no existir en el padron interno. */
      if (!titular && tipoPersona === TIPOS_DOCUMENTO_PERSONA.DNI) {
        const reniec = await this.consultaDocumento.consultarDni(dni).catch(() => null);
        if (reniec?.nombres && reniec.apellidoPaterno) {
          titular = { nombres: reniec.nombres, apellidoPaterno: reniec.apellidoPaterno, apellidoMaterno: reniec.apellidoMaterno ?? null, correo: null };
        }
      }
      /* Extranjeros: RENIEC no los tiene; se usa el nombre de la solicitud ("APELLIDOS, NOMBRES"). */
      if (!titular && tipoPersona !== TIPOS_DOCUMENTO_PERSONA.DNI) {
        const partido = separarNombreExtranjero(snapshot?.razonSocial || snapshot?.contacto);
        if (partido) titular = { ...partido, correo: null };
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
        tipDocFacturacion: TIPO_DOC_IIMP_POR_PERSONA[tipoPersona] ?? TIPOS_DOCUMENTO_FACTURACION_IIMP.DNI,
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

    /* Si la solicitud declara empresa extranjera (tipo 0, documento no numerico), NO se extraen digitos:
       un IVA como IT02416280390 tiene 11 digitos y se confundiria con un RUC peruano. */
    const ruc = esEmpresaExtranjera ? "" : ([digitos(snapshot?.numeroDocumento), digitos(empresa?.ruc)].find((v) => REGEX_RUC.test(v)) ?? "");
    /* Empresa extranjera (no domiciliada): documento RUT/ID alfanumerico; el SIE la factura como
       exportacion con `TipDocFacturacion = 0` y su pais. Un RUC peruano valido sigue el camino normal. */
    const documentoExtranjero = normalizarDocumentoEmpresa(snapshot?.numeroDocumento || empresa?.ruc);
    const esExtranjera =
      !REGEX_RUC.test(ruc) &&
      (esEmpresaExtranjera ||
        resolverTipoDocumentoEmpresa(snapshot?.tipoDocumento || empresa?.tipoDocumento, documentoExtranjero) === TIPOS_DOCUMENTO_EMPRESA.NO_DOMICILIADO) &&
      validarDocumentoEmpresa(TIPOS_DOCUMENTO_EMPRESA.NO_DOMICILIADO, documentoExtranjero) === null;
    if (!esExtranjera && !REGEX_RUC.test(ruc)) {
      throw new DomainError("La factura requiere un RUC de 11 digitos (revisa los datos de la solicitud)", API_ERROR_CODES.VALIDATION, 400);
    }
    const paisIso = esExtranjera ? (empresa?.pais ?? "").trim().toUpperCase() : "";
    if (esExtranjera && !/^[A-Z]{2}$/.test(paisIso)) {
      throw new DomainError("La empresa extranjera no tiene pais (ISO de 2 letras); registralo en Empresas antes de facturar", API_ERROR_CODES.VALIDATION, 400);
    }
    /* El SIE exige `Pais` como codigo numerico de su catalogo de ubigeo (Alemania = 5), no el ISO. */
    let pais: number | null = null;
    if (esExtranjera) {
      const catalogo = await this.personas.listarPaises().catch(() => null);
      if (!catalogo) {
        throw new DomainError("No se pudo consultar el catalogo de paises del SIE; reintenta en unos minutos", API_ERROR_CODES.INTERNAL, 502);
      }
      pais = codigoUbigeoDePais(paisIso, catalogo);
      if (pais === null) {
        throw new DomainError(`El pais ${paisIso} de la empresa no figura en el catalogo del SIE; corrigelo en Empresas antes de facturar`, API_ERROR_CODES.VALIDATION, 400);
      }
    }
    const razonSocial = snapshot?.razonSocial?.trim() || empresa?.razonSocial?.trim() || "";
    if (!razonSocial) throw new DomainError("Falta la razon social en los datos de facturacion", API_ERROR_CODES.VALIDATION, 400);
    const emailPagos = email;
    if (!emailPagos) throw new DomainError("Falta el correo de facturacion (o de contacto) en la solicitud", API_ERROR_CODES.VALIDATION, 400);
    const nombreContacto = snapshot?.contacto?.trim() || empresa?.representanteLegalNombre?.trim() || razonSocial;
    const dniRepresentante = digitos(empresa?.representanteLegalDni);

    return {
      ...base,
      /* Empresa extranjera: boleta (03) a la empresa con tipo de documento 0; empresa con RUC: factura (01). */
      tipoFacturacion: esExtranjera ? FACTURACION_IIMP.BOLETA : FACTURACION_IIMP.FACTURA,
      tipDocFacturacion: esExtranjera ? TIPOS_DOCUMENTO_FACTURACION_IIMP.EXTRANJERA : TIPOS_DOCUMENTO_FACTURACION_IIMP.RUC,
      numDocFacturacion: esExtranjera ? documentoExtranjero : ruc,
      razonSocial,
      ...(esExtranjera ? { pais } : {}),
      dirFacturacion: direccion,
      web: empresa?.sitioWeb ?? null,
      telefono,
      friso: (empresa?.nombreComercial ?? razonSocial).trim() || null,
      contactos: {
        contrato: {
          nombre: nombreContacto,
          cargo: IIMP_CARGO_REPRESENTANTE,
          ...(dniRepresentante && !esExtranjera ? { tipoDocumento: TIPOS_DOCUMENTO_FACTURACION_IIMP.DNI, numDocumento: dniRepresentante } : {}),
          email: emailPagos,
          ...(telefono ? { telefono } : {}),
        },
        pagos: { nombre: nombreContacto, email: emailPagos, ...(telefono ? { telefono } : {}) },
      },
    };
  }
}
