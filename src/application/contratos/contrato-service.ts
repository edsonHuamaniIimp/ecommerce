import 'server-only';

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ImageModule from "docxtemplater-image-module-free";
import sharp from "sharp";

import { concatenarAnexosPdf } from "./anexos-pdf";

import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { IEmpresaRepository } from "@/domain/ports/empresa-repository";
import type { IPlanoRepository } from "@/domain/ports/plano-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IGessRepository } from "@/domain/ports/gess-repository";
import type { PlanoEntity } from "@/domain/models/plano-entities";
import type { DatosContrato } from "@/domain/models/entities";
import type { PlanoItem } from "@/lib/shared/planos/registry";
import type { StorageAdapter } from "@/lib/server/storage";
import { DomainError } from "@/lib/server/router";
import { API_ERROR_CODES, CUOTA_MONTO_MINIMO, ESTADOS_DOCUMENTO_SOLICITUD, ESTADOS_SOLICITUD, IDIOMAS, MAX_CUOTAS_PAGO, MAX_CUOTAS_PERSONALIZADAS, MODOS_PAGO, ORIGENES_DOCUMENTO, PERMISSIONS, TIPOS_DOCUMENTO_SOLICITUD, type Idioma } from "@/lib/shared/constants";
import { resolverIdiomaDestinatario } from "@/application/idioma/resolver-idioma";
import { calcularImportes } from "@/lib/shared/utils/importes";
import { resolverPrecioStand } from "@/lib/shared/utils/precio-stand";
import { configCuotasValida, cronogramaValido, cuotasCoincidenConfig, etiquetaModalidad, fechasCuotasEstructuralmenteValidas, modalidadDeCuotas, planCuotasConFechas, porcentajesValidos, type ConfigCuotasEmpresa } from "@/lib/shared/utils/cuotas";
import { construirSvgRecorte } from "@/lib/shared/utils/recorte-plano";
import { renderizarMacroConSecciones } from "@/lib/server/macro-plano";
import { numberUtils } from "@/lib/shared/utils/number";
import { codigoComercialStand } from "@/lib/shared/utils/stand-codigo";
import { dateUtils } from "@/lib/shared/utils/date";
import { puedeClienteSubirDocumentos } from "@/lib/shared/utils/solicitud-documentos";

/** Limite de espera de la conversion DOCX -> PDF (LibreOffice/Word headless). */
const CONVERSION_PDF_TIMEOUT_MS = 90_000;

/**
 * Cola de conversion PDF: limita los procesos concurrentes (LibreOffice/Word pesan
 * ~200 MB y la tarea ECS es pequena). Evita que una rafaga de envios tumbe el contenedor;
 * las conversiones extra esperan turno (~1-3 s c/u).
 */
const MAX_CONVERSIONES_PDF = 2;
let conversionesPdfActivas = 0;
const esperaTurnoPdf: Array<() => void> = [];

function adquirirTurnoConversion(): Promise<void> {
  if (conversionesPdfActivas < MAX_CONVERSIONES_PDF) {
    conversionesPdfActivas++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    esperaTurnoPdf.push(() => {
      conversionesPdfActivas++;
      resolve();
    });
  });
}

function liberarTurnoConversion(): void {
  conversionesPdfActivas = Math.max(0, conversionesPdfActivas - 1);
  esperaTurnoPdf.shift()?.();
}

/** Plantillas DOCX etiquetadas por idioma (F3: contrato en el idioma del cliente). */
export const PLANTILLAS_CONTRATO: Record<Idioma, string[]> = {
  [IDIOMAS.ES]: ["plantillas", "contrato-perumin38-tags.docx"],
  [IDIOMAS.EN]: ["plantillas", "contrato-perumin38-tags-en.docx"],
};

/**
 * Anexos PDF fijos que se concatenan al final del contrato, en este orden:
 * 1) Fichas de Reglamento (Anexo B1 + listados por pabellon), 2) Fichas IPD.
 * Se copian tal cual (copyPages: sin re-render ni recomprimir) para conservar su
 * diseno y distribucion; hoy son las mismas para ES/EN (documentos oficiales en espanol).
 */
export const ANEXOS_PDF_CONTRATO: Record<Idioma, string[]> = {
  [IDIOMAS.ES]: ["anexos/fichas-reglamento-perumin38.pdf", "anexos/fichas-ipd-perumin38.pdf"],
  [IDIOMAS.EN]: ["anexos/fichas-reglamento-perumin38.pdf", "anexos/fichas-ipd-perumin38.pdf"],
};

/** PNG 1x1 transparente: se usa cuando el contrato no lleva firma digital. */
const PNG_1PX_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export interface GenerarContratoInput {
  solicitudId: string;
  /** Cuotas configuradas por el cliente (1..3); si falta usa el plan persistido. */
  cuotas?: Array<{ porcentaje: number; fechaVencimiento: string }>;
  /** Idioma del documento (es|en); si falta se resuelve el del cliente. */
  idioma?: Idioma;
  /** Firma digital del cliente (imagen base64) para estamparla en el contrato. */
  firmaExhibidorBase64?: string;
  /** Datos del exhibidor capturados en el wizard (prioridad sobre la empresa local). */
  contrato?: DatosContrato;
  /** Correo de la sesion: resuelve la empresa/config aunque el correo de contacto sea otro. */
  userEmail?: string;
  userSub: string;
  userPermissions: string[];
  /** Al firmar se genera el PDF firmado pero NO se reemplaza el contrato del admin. */
  registrarContrato?: boolean;
}

export interface FirmarContratoInput {
  solicitudId: string;
  idioma?: Idioma;
  /** Datos del exhibidor capturados en el wizard (prioridad sobre la empresa local). */
  contrato?: DatosContrato;
  /** Correo de la sesion: resuelve el perfil/empresa del firmante. */
  userEmail?: string;
  userSub: string;
  userPermissions: string[];
}

/** Borrador del contrato del wizard (paso Contrato): aun NO existe solicitud. */
export interface GenerarBorradorInput {
  /** IDs (gess_stand) de los stands seleccionados. */
  standIds: string[];
  cuotas: Array<{ porcentaje: number; fechaVencimiento: string }>;
  idioma?: Idioma;
  /** Email de la cuenta autenticada (empresa y firma del perfil). */
  email: string;
  /** Firma digital del cliente (imagen base64) para estamparla en el contrato. */
  firmaExhibidorBase64?: string;
  /** Datos del exhibidor capturados en el wizard (prioridad sobre la empresa local). */
  contrato?: DatosContrato;
}

/** Firma digital del borrador (antes de que exista la solicitud). */
export interface FirmarBorradorInput {
  standIds: string[];
  cuotas: Array<{ porcentaje: number; fechaVencimiento: string }>;
  idioma?: Idioma;
  email: string;
  /** Datos del exhibidor capturados en el wizard (prioridad sobre la empresa local). */
  contrato?: DatosContrato;
}

export interface ContratoFirmado {
  docxUrl: string;
  pdfUrl: string | null;
  nombre: string;
}

export interface ContratoGenerado {
  docxUrl: string;
  pdfUrl: string | null;
  nombre: string;
  pdfDisponible: boolean;
}

/**
 * Genera el contrato de exhibicion (plantilla DOCX etiquetada) con los datos de la
 * empresa, los modulos (stands), el cronograma de pagos y los recortes por pabellon;
 * lo adjunta a la solicitud como documento CONTRATO y devuelve las URLs (DOCX + PDF).
 */
export class ContratoApplicationService {
  constructor(
    private readonly solicitudes: ISolicitudesRepository,
    private readonly empresas: IEmpresaRepository,
    private readonly planos: IPlanoRepository,
    private readonly gess: IGessRepository,
    private readonly auth: IAuthRepository,
    private readonly storage: StorageAdapter,
  ) {}

  async generar(input: GenerarContratoInput): Promise<ContratoGenerado> {
    const detalle = await this.solicitudes.detalle(input.solicitudId);
    if (!detalle) throw new DomainError("Solicitud no encontrada", API_ERROR_CODES.NOT_FOUND, 404);

    const isAdmin =
      input.userPermissions.includes(PERMISSIONS.ADMIN_FULL) ||
      input.userPermissions.includes(PERMISSIONS.SOLICITUDES_UPLOAD);
    /*
     * El revisor (Asociado/Legal) habilita la firma; el cliente no puede generar
     * el contrato antes de esa accion.
     */
    const esRevisorContrato =
      input.userPermissions.includes(PERMISSIONS.SOLICITUDES_REVIEW_ASOCIADO) ||
      input.userPermissions.includes(PERMISSIONS.SOLICITUDES_REVIEW_LEGAL);
    const puedeGenerar = isAdmin || esRevisorContrato;
    if (!puedeGenerar && detalle.userId !== input.userSub) {
      throw new DomainError("No puedes generar el contrato de esta solicitud", API_ERROR_CODES.FORBIDDEN, 403);
    }
    /* El cliente puede (re)generar mientras la solicitud este en una ventana habilitada
     * (pendiente, observada, Legal/SGC o subsanacion); despues, solo admin. */
    if (!puedeGenerar && detalle.estadoSolicitud !== ESTADOS_SOLICITUD.PENDIENTE && !puedeClienteSubirDocumentos(detalle)) {
      throw new DomainError("La solicitud ya avanzo en el flujo; no puedes regenerar el contrato.", API_ERROR_CODES.CONFLICT, 409);
    }
    if (!isAdmin && !esRevisorContrato && detalle.contratoHabilitado !== true) {
      throw new DomainError(
        "El IIMP aún no ha habilitado la firma del contrato de esta solicitud.",
        API_ERROR_CODES.CONFLICT,
        409,
      );
    }

    /* Datos de la empresa del cliente (cuenta → empresa del Portal). */
    /* Datos de la empresa del cliente (cuenta -> empresa del Portal). Se usa el correo
     * de la sesion: el correo de contacto de la solicitud puede ser distinto. */
    /* Al generar para el cliente, usar los datos de la solicitud, no la cuenta
     * del revisor/admin que ejecuta la accion. */
    const emailPropietario = isAdmin || esRevisorContrato
      ? (detalle.email ?? input.userEmail)
      : (input.userEmail ?? detalle.email);
    const empresaId = emailPropietario ? await this.auth.findEmpresaIdDeUsuario(emailPropietario) : null;
    const empresa = empresaId ? await this.empresas.findById(empresaId) : null;

    /* Idioma del contrato: el elegido por quien lo genera (UI) o el del cliente (perfil/cookie). */
    const idioma: Idioma = input.idioma ?? (await resolverIdiomaDestinatario(this.auth, emailPropietario ?? null));

    /* Modulos (stands) + recortes por pabellon (el recorte se genera en el servidor).
     * El contrato usa el CODIGO COMERCIAL del stand (standCode); el bloqueId del plano
     * solo sirve para ubicarlo (nunca se muestra al cliente). */
    const refs = detalle.standsDetalle && detalle.standsDetalle.length > 0
      ? detalle.standsDetalle.map((s) => ({
          bloqueId: s.bloqueId ?? s.standCode,
          codigoComercial: s.standCode,
          tipoStand: detalle.tipoStand,
          pabellon: detalle.pabellon ?? null,
        }))
      : (detalle.bloqueId ? [detalle.bloqueId] : [...(detalle.standCodes ?? [])]).map((bloqueId) => ({
          bloqueId,
          codigoComercial: null,
          tipoStand: detalle.tipoStand,
          pabellon: detalle.pabellon ?? null,
        }));
    const { modulos, gruposPabellon } = await this.construirModulos(refs);

    /* Importes y cuotas: los MONTOS nunca vienen del cliente (precio del stand en BD). */
    const cuotasPersistidas = detalle.planCuotas?.cuotas.map((c) => ({ porcentaje: c.porcentaje, fechaVencimiento: c.fechaVencimiento ?? "" }));
    const usandoPlanPersistido = !input.cuotas || input.cuotas.length === 0;
    const cuotasSolicitadas = usandoPlanPersistido ? cuotasPersistidas : input.cuotas;
    const configCuotasEmpresa = empresa?.configCuotas
      ?? (emailPropietario ? (await this.auth.findPerfilByEmail(emailPropietario).catch(() => null))?.empresa?.configCuotas : null)
      ?? null;
    const { importes, plan, porcentajes, modalidad } = this.calcularPlan(
      detalle.precio ?? 0,
      cuotasSolicitadas,
      {
        permitirPersonalizado: isAdmin || usandoPlanPersistido,
        configCuotas: configCuotasEmpresa,
        modalidadPersistida: usandoPlanPersistido ? detalle.planCuotas?.modalidad : undefined,
      },
    );

    /* Snapshot del plan: fuente de verdad para regenerar el contrato y para Facturacion. */
    await this.solicitudes.guardarPlanCuotas(input.solicitudId, { modalidad, cuotas: plan });

    const base = `contrato-${(detalle.standCode || input.solicitudId.slice(0, 8)).replace(/[^A-Za-z0-9_-]/g, "")}-${Date.now()}`;
    const generado = await this.renderContrato({
      idioma,
      empresa,
      empresaFallback: detalle.empresa,
      modulos,
      gruposPabellon,
      importes,
      plan,
      porcentajes,
      modalidad,
      firmaExhibidorBase64: input.firmaExhibidorBase64,
      contrato: input.contrato,
      base,
    });

    /*
     * El contrato del administrador se registra al generarlo. Al FIRMAR solo se
     * produce el archivo firmado: el contrato vigente (version nueva) no se
     * sobrescribe; el caller lo adjunta como `contrato_firmado`.
     */
    if (input.registrarContrato !== false) {
      const urlContrato = generado.pdfUrl ?? generado.docxUrl;
      const etiquetaContrato = idioma === IDIOMAS.EN ? "Exhibition contract" : "Contrato de exhibicion";
      await this.solicitudes.upsertContratoSistema(
        input.solicitudId,
        urlContrato,
        `${etiquetaContrato} (${porcentajes.map((c) => `${c}%`).join(" / ")}).${generado.pdfUrl ? "pdf" : "docx"}`,
      );
    }

    return generado;
  }

  /**
   * Borrador del contrato (paso Contrato del wizard): genera el DOCX/PDF con los stands
   * seleccionados y las cuotas configuradas SIN crear la solicitud ni persistir nada.
   * La solicitud recien se crea al enviar la reserva (paso Confirmar).
   */
  async generarBorrador(input: GenerarBorradorInput): Promise<ContratoGenerado> {
    const empresaId = await this.auth.findEmpresaIdDeUsuario(input.email).catch(() => null);
    const empresa = empresaId ? await this.empresas.findById(empresaId) : null;
    const idioma: Idioma = input.idioma ?? (await resolverIdiomaDestinatario(this.auth, input.email));

    const filas = await Promise.all(input.standIds.map((id) => this.gess.findById(id)));
    const stands = filas.filter((s): s is NonNullable<typeof s> => s !== null);
    if (stands.length !== input.standIds.length) {
      throw new DomainError("Algun stand seleccionado ya no esta disponible.", API_ERROR_CODES.CONFLICT, 409);
    }
    const { modulos, gruposPabellon } = await this.construirModulos(
      stands.map((s) => ({ bloqueId: s.bloqueId ?? s.standCode, codigoComercial: s.standCode, tipoStand: s.tipoStand, pabellon: null })),
    );
    const neto = stands.reduce((sum, s) => sum + resolverPrecioStand(s), 0);
    const configCuotasEmpresa = empresa?.configCuotas
      ?? (await this.auth.findPerfilByEmail(input.email).catch(() => null))?.empresa?.configCuotas
      ?? null;
    const { importes, plan, porcentajes, modalidad } = this.calcularPlan(neto, input.cuotas, {
      configCuotas: configCuotasEmpresa,
    });

    const codigos = stands.map((s) => s.standCode).join("-").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
    const base = `contrato-borrador-${codigos || "stands"}-${Date.now()}`;
    return this.renderContrato({
      idioma,
      empresa,
      empresaFallback: null,
      modulos,
      gruposPabellon,
      importes,
      plan,
      porcentajes,
      modalidad,
      firmaExhibidorBase64: input.firmaExhibidorBase64,
      contrato: input.contrato,
      base,
    });
  }

  /** Firma digital del BORRADOR: estampa la firma del perfil sin crear solicitud. */
  async firmarBorrador(input: FirmarBorradorInput): Promise<ContratoFirmado> {
    const perfil = await this.auth.findPerfilByEmail(input.email);
    if (!perfil?.firmaUrl) {
      throw new DomainError("Antes de firmar digitalmente, sube tu firma (imagen) en tu Perfil.", API_ERROR_CODES.VALIDATION, 409);
    }
    const imagen = await this.leerImagenFirma(perfil.firmaUrl);
    const png = await sharp(imagen).resize({ width: 480, withoutEnlargement: true }).png().toBuffer();
    const generado = await this.generarBorrador({ ...input, firmaExhibidorBase64: png.toString("base64") });
    return { docxUrl: generado.docxUrl, pdfUrl: generado.pdfUrl, nombre: generado.nombre };
  }

  /** Valida cuotas y calcula importes/plan (montos siempre desde el precio en BD). */
  private calcularPlan(
    neto: number,
    cuotas?: Array<{ porcentaje: number; fechaVencimiento: string }>,
    opciones?: {
      permitirPersonalizado?: boolean;
      configCuotas?: ConfigCuotasEmpresa | null;
      modalidadPersistida?: string;
    },
  ): {
    importes: ReturnType<typeof calcularImportes>;
    plan: ReturnType<typeof planCuotasConFechas>;
    porcentajes: number[];
    modalidad: string;
  } {
    if (!(neto > 0)) {
      throw new DomainError("El stand no tiene un precio configurado; contacta a Facturacion del IIMP.", API_ERROR_CODES.CONFLICT, 409);
    }
    const importes = calcularImportes(neto);
    const porcentajes = (cuotas ?? []).map((c) => c.porcentaje);
    const fechas = (cuotas ?? []).map((c) => c.fechaVencimiento);
    if (porcentajes.length === 0) {
      throw new DomainError("Configura las cuotas de pago antes de generar el contrato.", API_ERROR_CODES.VALIDATION, 400);
    }

    const programadas = (cuotas ?? []).map((c) => ({ porcentaje: c.porcentaje, fechaVencimiento: c.fechaVencimiento }));
    const permitirPersonalizado = opciones?.permitirPersonalizado === true;
    const configCuotas = opciones?.configCuotas ?? null;
    const usaConfigEmpresa = !permitirPersonalizado && configCuotasValida(configCuotas);
    /*
     * En modo personalizado (admin o snapshot persistido) el maximo no es 3: el plan
     * persistido de una empresa puede tener hasta 9 cuotas. Nunca se acepta mas que
     * el limite del IIMP.
     */
    const maxCuotas = permitirPersonalizado
      ? Math.min(
          MAX_CUOTAS_PERSONALIZADAS,
          Math.max(MAX_CUOTAS_PAGO, cuotas?.length ?? 0, configCuotas?.maxCuotas ?? 0),
        )
      : usaConfigEmpresa
        ? (configCuotas?.maxCuotas ?? MAX_CUOTAS_PAGO)
        : MAX_CUOTAS_PAGO;

    if (porcentajes.length > maxCuotas || !porcentajesValidos(porcentajes, maxCuotas)) {
      throw new DomainError(
        `Configuracion de cuotas invalida (maximo ${maxCuotas} cuotas que suman 100%).`,
        API_ERROR_CODES.VALIDATION,
        400,
      );
    }

    if (!permitirPersonalizado) {
      if (usaConfigEmpresa) {
        if (!cuotasCoincidenConfig(programadas, configCuotas)) {
          throw new DomainError(
            "El cronograma no coincide con las cuotas y fechas configuradas por el IIMP para tu empresa.",
            API_ERROR_CODES.VALIDATION,
            400,
          );
        }
      } else if (!cronogramaValido(programadas)) {
        throw new DomainError(
          "Selecciona una modalidad de pago valida: 1 cuota (100%), 2 cuotas (50/50) o 3 cuotas (40/30/30), con las fechas vigentes del cronograma.",
          API_ERROR_CODES.VALIDATION,
          400,
        );
      }
    } else if (!fechasCuotasEstructuralmenteValidas(fechas)) {
      throw new DomainError("Las fechas del cronograma no son validas o no estan en orden.", API_ERROR_CODES.VALIDATION, 400);
    }

    const plan = planCuotasConFechas(importes.total, porcentajes, fechas);
    if (plan.some((c) => c.monto < CUOTA_MONTO_MINIMO)) {
      throw new DomainError(`Cada cuota debe ser de al menos US$ ${CUOTA_MONTO_MINIMO.toFixed(2)}.`, API_ERROR_CODES.VALIDATION, 400);
    }
    const modalidad = opciones?.modalidadPersistida
      ?? (usaConfigEmpresa ? MODOS_PAGO.PERSONALIZADO : modalidadDeCuotas(porcentajes));
    return { importes, plan, porcentajes, modalidad };
  }

  /** Modulos del Anexo 1 + grupos por pabellon (items del plano para el recorte). */
  private async construirModulos(
    refs: Array<{ bloqueId: string; codigoComercial?: string | null; tipoStand: string | null; pabellon: string | null }>,
  ): Promise<{
    modulos: Array<{ modulo: string; zona: string; tipo: string; metraje: string; frente: string; fondo: string }>;
    gruposPabellon: Map<string, { nombre: string; planoId: string; objetivos: string[]; items: PlanoItem[]; etiquetas: Record<string, string>; codigos: Record<string, string> }>;
  }> {
    const modulos: Array<{ modulo: string; zona: string; tipo: string; metraje: string; frente: string; fondo: string }> = [];
    const gruposPabellon = new Map<string, { nombre: string; planoId: string; objetivos: string[]; items: PlanoItem[]; etiquetas: Record<string, string>; codigos: Record<string, string> }>();
    const planosPorCodigo = new Map<string, Awaited<ReturnType<IPlanoRepository["detallePorCodigo"]>>>();
    for (const ref of refs) {
      const ubicacion = await this.planos.ubicacionDeBloque(ref.bloqueId);
      let frente = "";
      let fondo = "";
      let metraje = "";
      if (ubicacion) {
        const codigo = ubicacion.plano.codigo;
        if (!planosPorCodigo.has(codigo)) {
          planosPorCodigo.set(codigo, await this.planos.detallePorCodigo(codigo));
        }
        const plano = planosPorCodigo.get(codigo) ?? null;
        const tipo = plano?.tipos.find((t) => t.codigo === ubicacion.bloque.tipoCodigo);
        if (tipo) {
          frente = String(tipo.w);
          fondo = String(tipo.d);
          metraje = String(Math.round(tipo.w * tipo.d * 100) / 100);
        }
        if (plano) {
          const grupo = gruposPabellon.get(codigo) ?? {
            nombre: ubicacion.plano.nombre,
            planoId: plano.id,
            objetivos: [],
            items: construirItemsPlano(plano),
            etiquetas: Object.fromEntries(plano.tipos.map((t) => [t.codigo, t.label])),
            codigos: {} as Record<string, string>,
          };
          grupo.objetivos.push(ref.bloqueId);
          if (ref.codigoComercial) grupo.codigos[ref.bloqueId] = codigoComercialStand(ref.codigoComercial);
          gruposPabellon.set(codigo, grupo);
        }
      }
      modulos.push({
        modulo: codigoComercialStand(ref.codigoComercial ?? ref.bloqueId),
        zona: ubicacion?.plano.nombre ?? ref.pabellon ?? "",
        tipo: ref.tipoStand ?? "",
        metraje,
        frente,
        fondo,
      });
    }
    return { modulos, gruposPabellon };
  }

  /** Render DOCX + PDF + upload (compartido por generar y generarBorrador). */
  private async renderContrato(params: {
    idioma: Idioma;
    empresa: Awaited<ReturnType<IEmpresaRepository["findById"]>>;
    empresaFallback: string | null;
    modulos: Array<{ modulo: string; zona: string; tipo: string; metraje: string; frente: string; fondo: string }>;
    gruposPabellon: Map<string, { nombre: string; planoId: string; objetivos: string[]; items: PlanoItem[]; etiquetas: Record<string, string>; codigos: Record<string, string> }>;
    importes: ReturnType<typeof calcularImportes>;
    plan: ReturnType<typeof planCuotasConFechas>;
    porcentajes: number[];
    modalidad: string;
    firmaExhibidorBase64?: string;
    /** Datos del exhibidor capturados en el wizard (prioridad sobre la empresa local). */
    contrato?: DatosContrato | null;
    base: string;
  }): Promise<ContratoGenerado> {
    const { idioma, empresa, modulos, gruposPabellon, importes, plan, firmaExhibidorBase64, base } = params;
    const esCompleto = params.modalidad === MODOS_PAGO.COMPLETO;
    const esMitad = params.modalidad === MODOS_PAGO.CUOTAS;
    const esTresCuotas = params.modalidad === MODOS_PAGO.TRES_CUOTAS;
    const esPersonalizado = params.modalidad === MODOS_PAGO.PERSONALIZADO;
    const fechaCorta = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "");

    const hoy = dateUtils.now();
    const fechaFirma = `${String(hoy.getDate()).padStart(2, "0")}/${String(hoy.getMonth() + 1).padStart(2, "0")}/${hoy.getFullYear()}`;

    /* Copy insertado en el contrato: en ingles no debe filtrarse espanol. */
    const esContratoEn = idioma === IDIOMAS.EN;
    const textoUbicacionGeneral = esContratoEn ? "General location - Pavilions map" : "Ubicacion general - Mapa de pabellones";
    const textoObjetoSocial = esContratoEn ? "activities related to its line of business" : "actividades propias de su giro comercial";
    const textoActividad = esContratoEn ? "exhibition of products and services" : "exhibicion de productos y servicios";
    const textoCargoRepresentante = esContratoEn ? "Legal Representative" : "Representante Legal";

    /*
     * Imagenes del Anexo 1: una por pabellon, generadas en el SERVIDOR con los mismos
     * datos del plano (util compartida con el portal) y rasterizadas con sharp.
     */
    const planosData: Array<{ imagen_plano: string; pabellon: string; version: string; fecha: string }> = [];
    for (const grupo of gruposPabellon.values()) {
      try {
        const { svg, encontrado } = construirSvgRecorte(grupo.items, grupo.objetivos, { etiquetas: grupo.etiquetas, codigos: grupo.codigos });
        if (!encontrado) continue;
        const png = await sharp(Buffer.from(svg)).png().toBuffer();
        planosData.push({
          imagen_plano: png.toString("base64"),
          pabellon: grupo.nombre,
          version: "1",
          fecha: fechaFirma,
        });
      } catch { /* imagen omitida: el contrato sigue siendo valido */ }
    }

    /*
     * Ubicacion general: el mapa macro del evento con la(s) seccion(es) de los
     * pabellones del contrato resaltadas (imagen previa a los recortes).
     */
    try {
      const hijosPorMacro = new Map<string, { macroId: string; planosHijoIds: string[] }>();
      for (const grupo of gruposPabellon.values()) {
        const macros = await this.planos.macrosQueContienen(grupo.planoId);
        const macro = macros[0];
        if (!macro) continue;
        const acc = hijosPorMacro.get(macro.id) ?? { macroId: macro.id, planosHijoIds: [] };
        acc.planosHijoIds.push(grupo.planoId);
        hijosPorMacro.set(macro.id, acc);
      }
      for (const { macroId, planosHijoIds } of hijosPorMacro.values()) {
        const macro = await this.planos.detalle(macroId);
        if (!macro) continue;
        const jpg = await renderizarMacroConSecciones(macro, planosHijoIds);
        if (!jpg) continue;
        planosData.unshift({
          imagen_plano: jpg.toString("base64"),
          pabellon: textoUbicacionGeneral,
          version: "1",
          fecha: fechaFirma,
        });
      }
    } catch { /* imagen de ubicacion omitida: el contrato sigue siendo valido */ }

    const monto = (valor: number) => numberUtils.numero(valor, { decimales: 2 });

    /* Datos del cuerpo del contrato: wizard (prioridad) -> empresa local -> fallback. */
    const c = params.contrato;
    const razonSocial = c?.razonSocial?.trim() || empresa?.razonSocial || params.empresaFallback || "-";
    const ruc = c?.ruc?.trim() || empresa?.ruc || "-";
    const domicilioFiscal = c?.direccion?.trim() || empresa?.direccionFiscal || "-";
    const representanteLegal = c?.representante?.trim() || empresa?.representanteLegalNombre || "-";
    const dniRepresentante = c?.representanteDni?.trim() || empresa?.representanteLegalDni || "-";
    const partidaElectronica = c?.partidaElectronica?.trim() || empresa?.partidaElectronica || "";

    const data = {
      razon_social: razonSocial,
      ruc,
      domicilio_fiscal: domicilioFiscal,
      representante_legal: representanteLegal,
      dni_representante: dniRepresentante,
      partida_electronica: partidaElectronica,
      objeto_social: textoObjetoSocial,
      actividad: textoActividad,
      modulos,
      planos: planosData,
      monto_total: monto(importes.total),
      valor_venta: monto(importes.valorVenta),
      igv: monto(importes.igv),
      precio_venta: monto(importes.total),
      sel_modalidad_1: esCompleto ? "X" : "",
      monto_modalidad_1: esCompleto ? monto(importes.total) : "",
      sel_modalidad_2: esMitad ? "X" : "",
      sel_modalidad_3: esTresCuotas ? "X" : "",
      sel_modalidad_4: esPersonalizado ? "X" : "",
      modalidad_pago: etiquetaModalidad(params.modalidad),
      cuotas_contrato: plan.map((c) => ({
        numero: c.numero,
        porcentaje: c.porcentaje,
        monto: monto(c.monto),
        fecha: fechaCorta(c.fechaVencimiento),
      })),
      firmante_nombre_cargo: representanteLegal !== "-"
        ? `${representanteLegal} - ${textoCargoRepresentante}`
        : "",
      /** Codigos comerciales de los stands (Anexo 4: asunto de zona maquinaria). */
      codigos_stands: modulos.map((m) => m.modulo).join(", "),
      firmante_empresa: razonSocial !== "-" ? razonSocial : "",
      firma_exhibidor: firmaExhibidorBase64 ?? PNG_1PX_BASE64,
      firmante_fecha: fechaFirma,
    };

    /* Render DOCX en el idioma resuelto (respaldo al español si falta la plantilla). */
    const rutaPlantilla = path.join(process.cwd(), ...PLANTILLAS_CONTRATO[idioma]);
    const rutaRespaldo = path.join(process.cwd(), ...PLANTILLAS_CONTRATO[IDIOMAS.ES]);
    const plantilla = fs.readFileSync(fs.existsSync(rutaPlantilla) ? rutaPlantilla : rutaRespaldo);
    const zip = new PizZip(plantilla);
    const imageModule = new ImageModule({
      centered: false,
      fileType: "docx",
      getImage: (valor: unknown) => Buffer.from(String(valor), "base64"),
      getSize: (_img: Buffer, _valor: unknown, tagName: string) => (tagName === "firma_exhibidor" ? [150, 55] : [520, 320]),
    });
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, modules: [imageModule] });
    doc.render(data);
    const docxBuffer = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;

    const docxUrl = await this.storage.upload(
      docxBuffer,
      `${base}.docx`,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    const pdfBuffer = await this.generarPdfContrato(docxBuffer, idioma);
    const pdfUrl = pdfBuffer ? await this.storage.upload(pdfBuffer, `${base}.pdf`, "application/pdf") : null;

    return { docxUrl, pdfUrl, nombre: base, pdfDisponible: pdfBuffer !== null };
  }

  /**
   * Firma digital del cliente (RF-12): estampa la imagen de firma de su perfil en el contrato
   * generado y devuelve las URLs del documento firmado (equivale a subir el contrato firmado).
   */
  async firmar(input: FirmarContratoInput): Promise<ContratoFirmado> {
    const detalle = await this.solicitudes.detalle(input.solicitudId);
    if (!detalle) throw new DomainError("Solicitud no encontrada", API_ERROR_CODES.NOT_FOUND, 404);

    const isAdmin =
      input.userPermissions.includes(PERMISSIONS.ADMIN_FULL) ||
      input.userPermissions.includes(PERMISSIONS.SOLICITUDES_UPLOAD);
    if (!isAdmin && detalle.userId !== input.userSub) {
      throw new DomainError("No puedes firmar el contrato de esta solicitud", API_ERROR_CODES.FORBIDDEN, 403);
    }
    if (!isAdmin && detalle.estadoSolicitud !== ESTADOS_SOLICITUD.PENDIENTE && !puedeClienteSubirDocumentos(detalle)) {
      throw new DomainError("La solicitud ya avanzo en el flujo; no puedes firmar el contrato.", API_ERROR_CODES.CONFLICT, 409);
    }

    /*
     * La firma digital solo aplica a contratos generados por el sistema (misma
     * plantilla/datos). Si el admin subio un PDF corregido como archivo, el cliente
     * debe descargarlo, firmarlo y subir su version.
     */
    if (!isAdmin) {
      const contratoVigente = detalle.docsAdjuntos
        .filter((d) => (!d.estado || d.estado === ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO) &&
          d.userId === null && d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO)
        .sort((a, b) => (dateUtils.toMs(b.createdAt) ?? 0) - (dateUtils.toMs(a.createdAt) ?? 0))[0];
      if (contratoVigente && contratoVigente.origen !== ORIGENES_DOCUMENTO.GENERADO) {
        throw new DomainError(
          "El contrato corregido fue subido como archivo: descargalo, firmalo y sube tu version firmada.",
          API_ERROR_CODES.CONFLICT,
          409,
        );
      }
      /*
       * Si ya existe una firma manual vigente de la version actual, no se permite
       * firmar digitalmente otra vez: el cliente debe eliminar esa firma primero.
       */
      const firmadoVigente = detalle.docsAdjuntos
        .filter((d) => (!d.estado || d.estado === ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO) &&
          d.userId === input.userSub && d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO)
        .sort((a, b) => (dateUtils.toMs(b.createdAt) ?? 0) - (dateUtils.toMs(a.createdAt) ?? 0))[0];
      if (contratoVigente && firmadoVigente &&
        dateUtils.isSameOrAfter(firmadoVigente.createdAt, contratoVigente.createdAt)) {
        throw new DomainError(
          "Ya tienes un contrato firmado vigente para esta version. Elimina esa firma si deseas firmar digitalmente.",
          API_ERROR_CODES.CONFLICT,
          409,
        );
      }
    }

    const emailFirmante = input.userEmail ?? detalle.email;
    const perfil = emailFirmante ? await this.auth.findPerfilByEmail(emailFirmante) : null;
    if (!perfil?.firmaUrl) {
      throw new DomainError("Antes de firmar digitalmente, sube tu firma (imagen) en tu Perfil.", API_ERROR_CODES.VALIDATION, 409);
    }

    const imagen = await this.leerImagenFirma(perfil.firmaUrl);
    const png = await sharp(imagen).resize({ width: 480, withoutEnlargement: true }).png().toBuffer();

    const generado = await this.generar({
      solicitudId: input.solicitudId,
      idioma: input.idioma,
      firmaExhibidorBase64: png.toString("base64"),
      contrato: input.contrato,
      userEmail: input.userEmail,
      userSub: input.userSub,
      userPermissions: input.userPermissions,
      registrarContrato: false,
    });
    return { docxUrl: generado.docxUrl, pdfUrl: generado.pdfUrl, nombre: generado.nombre };
  }

  /** Lee la imagen de firma del storage (`/uploads/*`: S3 o volumen local) o remota. */
  private async leerImagenFirma(url: string): Promise<Buffer> {
    if (url.startsWith("/uploads/")) {
      const archivo = await this.storage.read(url.replace(/^\/uploads\//, "")).catch(() => null);
      if (archivo) return archivo.bytes;
      /* Compatibilidad pre-migracion a S3: archivo aun en el volumen local. */
      try {
        return fs.readFileSync(path.join(process.cwd(), "public", url));
      } catch {
        throw new DomainError("No se pudo leer tu firma digital", API_ERROR_CODES.INTERNAL, 500);
      }
    }
    const res = await fetch(url);
    if (!res.ok) throw new DomainError("No se pudo leer tu firma digital", API_ERROR_CODES.INTERNAL, 500);
    return Buffer.from(await res.arrayBuffer());
  }

  /** DOCX -> PDF con los anexos fijos al final (Fichas de Reglamento y Fichas IPD); null si no hay conversor. */
  private async generarPdfContrato(docx: Buffer, idioma: Idioma): Promise<Buffer | null> {
    const pdf = await this.convertirPdf(docx);
    if (!pdf) return null;
    return concatenarAnexosPdf(pdf, ANEXOS_PDF_CONTRATO[idioma]).catch(() => pdf);
  }

  /** Convierte DOCX a PDF: LibreOffice (soffice) o, en Windows, Microsoft Word; null si no hay conversor. */
  private async convertirPdf(docx: Buffer): Promise<Buffer | null> {
    await adquirirTurnoConversion();
    try {
      const inPath = path.join(os.tmpdir(), `contrato-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.docx`);
      try {
        fs.writeFileSync(inPath, docx);
        const porSoffice = await this.convertirConSoffice(inPath);
        if (porSoffice) return porSoffice;
        if (process.platform === "win32") {
          const porWord = await this.convertirConWord(inPath);
          if (porWord) return porWord;
        }
        console.warn("[contratos] PDF no generado: instala LibreOffice (o MS Word en Windows) o define SOFFICE_PATH.");
        return null;
      } finally {
        fs.rmSync(inPath, { force: true });
      }
    } finally {
      liberarTurnoConversion();
    }
  }

  /** LibreOffice headless (`soffice --convert-to pdf`). */
  private convertirConSoffice(inPath: string): Promise<Buffer | null> {
    return new Promise((resolve) => {
      const outPath = inPath.replace(/\.docx$/, ".pdf");
      const proc = spawn(this.resolverSoffice(), ["--headless", "--convert-to", "pdf", "--outdir", os.tmpdir(), inPath], { stdio: "ignore" });
      proc.on("error", () => resolve(null));
      proc.on("close", (code) => {
        if (code === 0 && fs.existsSync(outPath)) {
          const buf = fs.readFileSync(outPath);
          fs.rmSync(outPath, { force: true });
          resolve(buf);
        } else {
          resolve(null);
        }
      });
    });
  }

  /** Fallback en Windows: convierte con Microsoft Word (COM, preserva el formato del DOCX). */
  private convertirConWord(inPath: string): Promise<Buffer | null> {
    return new Promise((resolve) => {
      const outPath = `${inPath}.pdf`;
      const scriptPath = path.join(os.tmpdir(), `word-pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.ps1`);
      const script = [
        "param([string]$inPath, [string]$outPath)",
        "$ErrorActionPreference = 'Stop'",
        "$word = New-Object -ComObject Word.Application",
        "$word.Visible = $false",
        "$word.DisplayAlerts = 0",
        "try {",
        "  $doc = $word.Documents.Open($inPath, $false, $true)",
        "  $doc.SaveAs2($outPath, 17)",
        "  $doc.Close($false)",
        "} finally { $word.Quit() }",
      ].join("\n");
      fs.writeFileSync(scriptPath, script, "utf8");
      const terminar = (buf: Buffer | null) => {
        fs.rmSync(scriptPath, { force: true });
        fs.rmSync(outPath, { force: true });
        resolve(buf);
      };
      const proc = spawn(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-inPath", inPath, "-outPath", outPath],
        { stdio: "ignore", windowsHide: true },
      );
      const timeout = setTimeout(() => { proc.kill(); terminar(null); }, CONVERSION_PDF_TIMEOUT_MS);
      proc.on("error", () => { clearTimeout(timeout); terminar(null); });
      proc.on("close", (code) => {
        clearTimeout(timeout);
        const buf = code === 0 && fs.existsSync(outPath) ? fs.readFileSync(outPath) : null;
        terminar(buf);
      });
    });
  }

  /** Ubica el binario de LibreOffice (PATH, SOFFICE_PATH o rutas tipicas por SO). */
  private resolverSoffice(): string {
    const candidatos = [
      process.env.SOFFICE_PATH,
      "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
      "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
      "/Applications/LibreOffice.app/Contents/MacOS/soffice",
      "/usr/bin/soffice",
      "/usr/local/bin/soffice",
    ].filter((c): c is string => Boolean(c));
    for (const candidato of candidatos) {
      if (fs.existsSync(candidato)) return candidato;
    }
    return "soffice";
  }
}

/** Items del plano (bloques activos con dimensiones del tipo) para el recorte SVG. */
function construirItemsPlano(plano: PlanoEntity): PlanoItem[] {
  const dims: Record<string, { w: number; d: number; h: number; color: string }> = {};
  for (const tipo of plano.tipos) {
    if (tipo.flgActivo === false) continue;
    dims[tipo.codigo] = { w: tipo.w, d: tipo.d, h: tipo.h, color: tipo.color };
  }
  return plano.bloques
    .filter((b) => b.flgActivo !== false)
    .map((b) => ({
      id: b.bloqueId,
      dim: dims[b.tipoCodigo] ?? { w: 2, d: 2, h: 2.4, color: "#94a3b8" },
      type: b.tipoCodigo,
      x: b.x,
      z: b.z,
      rotY: b.rotY ?? 0,
    }));
}