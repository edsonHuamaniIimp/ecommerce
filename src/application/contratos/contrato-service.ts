import 'server-only';

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ImageModule from "docxtemplater-image-module-free";
import sharp from "sharp";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { concatenarAnexosPdf } from "./anexos-pdf";

import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { IEmpresaRepository } from "@/domain/ports/empresa-repository";
import type { IPlanoRepository } from "@/domain/ports/plano-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IGessRepository } from "@/domain/ports/gess-repository";
import type { IEventoRepository } from "@/domain/ports/evento-repository";
import type { PlanoEntity } from "@/domain/models/plano-entities";
import type { EmpresaRepresentanteAdicionalEntity } from "@/domain/models/empresa";
import type { DatosContrato } from "@/domain/models/entities";
import type { PlanoItem } from "@/lib/shared/planos/registry";
import type { StorageAdapter } from "@/lib/server/storage";
import { DomainError } from "@/lib/server/router";
import { API_ERROR_CODES, CUOTA_MONTO_MINIMO, ESTADOS_DOCUMENTO_SOLICITUD, ESTADOS_SOLICITUD, IDIOMAS, MAX_CUOTAS_PAGO, MAX_CUOTAS_PERSONALIZADAS, MODOS_PAGO, ORIGENES_DOCUMENTO, PERMISSIONS, TIPOS_DOCUMENTO_PERSONA_LABELS, TIPOS_DOCUMENTO_SOLICITUD, type Idioma } from "@/lib/shared/constants";
import { ALERTA_CLAVES } from "@/lib/shared/alert-templates";
import { resolverIdiomaDestinatario } from "@/application/idioma/resolver-idioma";
import { calcularImportes } from "@/lib/shared/utils/importes";
import { convertirNeto, esMonedaContrato, etiquetaMoneda, simboloMoneda, tipoCambioValido, CUENTAS_CONTRATO, MONEDAS_CONTRATO, type MonedaContrato } from "@/lib/shared/utils/moneda";
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
  "iVBORw0KGgoAAAANSUhEUgAAAJYAAAA3CAYAAADuQbOpAAAACXBIWXMAAAPoAAAD6AG1e1JrAAABHElEQVR4nO2SsQnAABCEfv+lzRIJR8TCXsQDLmrAyw2aqqnuiwaN1VjXWE1wf2kwFwiUDeYCgbLBXCBQNpgLBMoGc4FA2WAuECgbzAUCZYO5QKBsMBcIlA3mAoGywVwgUDaYCwTKBnOBQNlgLhAoG8wFAmWDuUCgbDAXCJQN5gKBssFcIFA2mAsEygZzgUDZYC4QKBvMBQJlg7lAoGwwFwiUDeYCgbLBXCBQNpgLBMoGc4FA2WAuECgbzAUCZYO5QKBsMBcIlA3mAoGywVwgUDaYCwTKBnOBQNlgLhAoG8wFAmWDuUCgbDAXCJQN5gKBssFcIFA2mAsEygZzgUDZYC4QKBvMBQJlg7lAoGwwFwiUDeYCgbLBXCBQNngA4xNS816GO2oAAAAASUVORK5CYII=";

export interface SelloVectorialFirma {
  esSello: boolean;
  nombres: string;
  apellidos: string;
  fecha: string;
  /** Imagen capturada (cursor) en base64 (dataURL); solo cuando NO es sello. */
  imagen?: string;
  secciones: Array<{ pagina: number; x: number; y: number; w: number; h: number }>;
}

export interface GenerarContratoInput {
  solicitudId: string;
  /** Moneda solicitada (la solicitud ya guarda el snapshot; se conserva por compatibilidad). */
  moneda?: MonedaContrato;
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
  /** Sellos vectoriales (uno por firmante, principal primero). */
  sellosFirmantes?: SelloVectorialFirma[];
  /** true = estampar imagenes de firma reales (solo al firmar; el contrato del admin va sin firmas). */
  estamparFirmas?: boolean;
  /** true = generacion interna de la firma: el cliente ya paso las validaciones de `firmar`. */
  esFirma?: boolean;
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
  /** Sellos vectoriales (uno por firmante, principal primero). */
  sellosVectoriales?: SelloVectorialFirma[];
}

/** Borrador del contrato del wizard (paso Contrato): aun NO existe solicitud. */
export interface GenerarBorradorInput {
  /** IDs (gess_stand) de los stands seleccionados. */
  standIds: string[];
  /** Moneda elegida (USD | PEN). */
  moneda?: MonedaContrato;
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
  moneda?: MonedaContrato;
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
    private readonly eventoRepo?: IEventoRepository,
  ) {}

  async generar(input: GenerarContratoInput): Promise<ContratoGenerado> {
    const detalle = await this.solicitudes.detalle(input.solicitudId);
    if (!detalle) throw new DomainError("Solicitud no encontrada", API_ERROR_CODES.NOT_FOUND, 404);

    const isAdmin =
      input.userPermissions.includes(PERMISSIONS.ADMIN_FULL) ||
      input.userPermissions.includes(PERMISSIONS.SOLICITUDES_UPLOAD);
    /*
     * El revisor **Asociado** habilita/regenera el contrato; el cliente no puede generar
     * el contrato antes de esa accion. Legal no regenera (su revision vive en el SGC).
     */
    const esRevisorContrato = input.userPermissions.includes(PERMISSIONS.SOLICITUDES_REVIEW_ASOCIADO);
    const puedeGenerar = isAdmin || esRevisorContrato;
    if (!puedeGenerar && detalle.userId !== input.userSub) {
      throw new DomainError("No puedes generar el contrato de esta solicitud", API_ERROR_CODES.FORBIDDEN, 403);
    }
    /* El cliente puede (re)generar mientras la solicitud este en una ventana habilitada
     * (pendiente, observada, Legal/SGC o subsanacion); despues, solo admin. */
    if (!puedeGenerar && detalle.estadoSolicitud !== ESTADOS_SOLICITUD.PENDIENTE && !puedeClienteSubirDocumentos(detalle)) {
      throw new DomainError("La solicitud ya avanzo en el flujo; no puedes regenerar el contrato.", API_ERROR_CODES.CONFLICT, 409);
    }
    if (!isAdmin && !esRevisorContrato && detalle.contratoHabilitado !== true && input.esFirma !== true) {
      const esPrimeraPlantilla = detalle.estadoSolicitud === ESTADOS_SOLICITUD.PENDIENTE && detalle.docsAdminCount === 0;
      if (!esPrimeraPlantilla) {
        throw new DomainError(
          "El IIMP aún no ha habilitado la firma del contrato de esta solicitud.",
          API_ERROR_CODES.CONFLICT,
          409,
        );
      }
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
    const moneda: MonedaContrato = esMonedaContrato(detalle.moneda) ? detalle.moneda : MONEDAS_CONTRATO.USD;
    const tipoCambio = detalle.tipoCambio ?? 1;
    if (moneda === MONEDAS_CONTRATO.PEN && !tipoCambioValido(tipoCambio)) {
      throw new DomainError("La solicitud no tiene un tipo de cambio valido para soles.", API_ERROR_CODES.CONFLICT, 409);
    }
    const neto = convertirNeto(detalle.precio ?? 0, moneda, tipoCambio);
    const { importes, plan, porcentajes, modalidad } = this.calcularPlan(
      neto,
      cuotasSolicitadas,
      {
        permitirPersonalizado: isAdmin || usandoPlanPersistido,
        configCuotas: configCuotasEmpresa,
        modalidadPersistida: usandoPlanPersistido ? detalle.planCuotas?.modalidad : undefined,
      },
    );

    /* Snapshot del plan: fuente de verdad para regenerar el contrato y para Facturacion. */
    await this.solicitudes.guardarPlanCuotas(input.solicitudId, { modalidad, cuotas: plan, moneda, tipoCambio });

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
      moneda,
      firmaExhibidorBase64: input.firmaExhibidorBase64,
      contrato: input.contrato,
      sellosFirmantes: input.sellosFirmantes,
      estamparFirmas: input.estamparFirmas,
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
   * Regenera el contrato desde la plantilla cuando el SGC observa el contrato.
   * Se ejecuta como sistema (sin depender de una sesion del Asociado) y habilita
   * la firma del cliente para la nueva version.
   */
  async regenerarContratoParaSgc(solicitudId: string): Promise<ContratoGenerado> {
    const detalle = await this.solicitudes.detalle(solicitudId);
    if (!detalle) throw new DomainError("Solicitud no encontrada", API_ERROR_CODES.NOT_FOUND, 404);
    const generado = await this.generar({
      solicitudId,
      userPermissions: [PERMISSIONS.ADMIN_FULL],
      userSub: detalle.userId ?? "system",
      userEmail: detalle.email ?? undefined,
    });
    await this.solicitudes.habilitarContrato(solicitudId);
    return generado;
  }

  /**
   * Regenera el contrato de las solicitudes de una empresa cuando cambia la lista
   * de representantes adicionales (0->1, 1->0, reemplazos...). Crea una NUEVA
   * version del contrato del administrador y habilita la firma; el firmado
   * anterior queda como historial (no se elimina ni se invalida).
   */
  async regenerarPorCambioRepresentantes(empresaId: string): Promise<number> {
    const empresa = await this.empresas.findById(empresaId).catch(() => null);
    if (!empresa) return 0;
    const ids = await this.solicitudes.listarIdsPorEmpresa(
      empresa.id,
      empresa.ruc ?? null,
      empresa.sieCode ?? null,
    );
    let regeneradas = 0;
    for (const solicitudId of ids) {
      const detalle = await this.solicitudes.detalle(solicitudId).catch(() => null);
      if (!detalle) continue;
      if (
        detalle.estadoSolicitud !== ESTADOS_SOLICITUD.PENDIENTE &&
        detalle.estadoSolicitud !== ESTADOS_SOLICITUD.OBSERVADO
      ) {
        continue;
      }
      try {
        await this.generar({
          solicitudId,
          userPermissions: [PERMISSIONS.ADMIN_FULL],
          userSub: detalle.userId ?? "system",
          userEmail: detalle.email ?? undefined,
          registrarContrato: true,
        });
        await this.solicitudes.habilitarContrato(solicitudId).catch(() => undefined);
        if (detalle.userId) {
          await this.solicitudes
            .crearAlertaReserva({
              userId: detalle.userId,
              tipo: "reserva",
              clave: ALERTA_CLAVES.CONTRATO_REGENERADO_REPRESENTANTES,
              datos: { stands: detalle.standCode ?? solicitudId },
              url: "/dashboard/mis-solicitudes",
            })
            .catch(() => undefined);
        }
        regeneradas += 1;
      } catch {
        /* Una solicitud que no se pueda regenerar no rompe el guardado de representantes. */
      }
    }
    return regeneradas;
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
    const moneda: MonedaContrato = input.moneda ?? MONEDAS_CONTRATO.USD;
    let tipoCambio = 1;
    if (moneda === MONEDAS_CONTRATO.PEN) {
      const eventoId = stands[0]?.eventoId;
      const evento = eventoId && this.eventoRepo ? await this.eventoRepo.findById(eventoId).catch(() => null) : null;
      const tcEvento = evento?.tipoCambio;
      if (!tipoCambioValido(tcEvento)) {
        throw new DomainError("El evento no tiene un tipo de cambio configurado para contratos en soles.", API_ERROR_CODES.CONFLICT, 409);
      }
      tipoCambio = tcEvento;
    }
    const netoUsd = stands.reduce((sum, s) => sum + resolverPrecioStand(s), 0);
    const neto = convertirNeto(netoUsd, moneda, tipoCambio);
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
      moneda,
      firmaExhibidorBase64: input.firmaExhibidorBase64,
      contrato: input.contrato,
      estamparFirmas: Boolean(input.firmaExhibidorBase64),
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
      throw new DomainError(`Cada cuota debe ser de al menos ${CUOTA_MONTO_MINIMO.toFixed(2)} en la moneda del contrato.`, API_ERROR_CODES.VALIDATION, 400);
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
    moneda: MonedaContrato;
    firmaExhibidorBase64?: string;
    /** Datos del exhibidor capturados en el wizard (prioridad sobre la empresa local). */
    contrato?: DatosContrato | null;
    /** Sellos vectoriales (uno por firmante, principal primero). */
    sellosFirmantes?: SelloVectorialFirma[];
    /** true = estampar imagenes reales de firma (solo al firmar). */
    estamparFirmas?: boolean;
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
    const mesesEs = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const mesesEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const fechaFirmaTexto = esContratoEn
      ? `${String(hoy.getDate()).padStart(2, "0")} ${mesesEn[hoy.getMonth()]} ${hoy.getFullYear()}`
      : `${String(hoy.getDate()).padStart(2, "0")} de ${mesesEs[hoy.getMonth()]} de ${hoy.getFullYear()}`;
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
    const representantesAdicionales = (empresa?.representantesAdicionales ?? []).map((rep) => ({
      nombre: rep.nombre,
      tipoDocumento: TIPOS_DOCUMENTO_PERSONA_LABELS[rep.tipoDocumento] ?? rep.tipoDocumento,
      documento: rep.documento,
    }));
    /*
     * Redaccion validada por Legal: los representantes firman conjuntamente y
     * comparten la misma personeria/partida. No se usa "adicionalmente comparece";
     * EL EXHIBIDOR sigue siendo la empresa (singular) y cada firma se identifica
     * como EL EXHIBIDOR con el nombre de la persona debajo.
     */
    const clausulaRepresentantes = (() => {
      const identificacionPrincipal = esContratoEn
        ? `${representanteLegal}, identified with DNI/ identification card/ ID Card/Passport or other equivalent No. ${dniRepresentante}`
        : `${representanteLegal}, identificado con DNI/ c\u00f3dula de identificaci\u00f3n/ ID Card/Pasaporte u otro equivalente N.\u00b0 ${dniRepresentante}`;
      const identificaciones = [
        identificacionPrincipal,
        ...representantesAdicionales.map(
          (rep) => `${rep.nombre}, ${esContratoEn ? "identified with" : "identificado con"} ${rep.tipoDocumento} ${esContratoEn ? "No." : "N.\u00b0"} ${rep.documento}`,
        ),
      ];
      const union =
        identificaciones.length === 1
          ? identificaciones[0]
          : `${identificaciones.slice(0, -1).join(", ")} y ${identificaciones.at(-1)}`;
      const partida = partidaElectronica.trim();
      const tienePartida = partida !== "" && partida !== "-";
      const plural = identificaciones.length === 2 ? (esContratoEn ? "both" : "ambos") : (esContratoEn ? "all" : "todos");
      const poderes = !tienePartida
        ? ""
        : esContratoEn
          ? `, ${identificaciones.length > 1 ? plural + " with powers registered under the same" : "with powers registered under"} Electronic File No. ${partida} of the Registry of Legal Entities of Lima (if applicable)`
          : `, ${identificaciones.length > 1 ? plural + " con poderes inscritos en la misma" : "con poderes inscritos en la"} Partida Electr\u00f3nica N.\u00b0 ${partida} del Registro de Personas Jur\u00eddicas de Lima (si aplica)`;
      return `${union}${poderes}`;
    })();
    const firmasRepresentantes = await this.prepararFirmasRepresentantes(
      empresa?.representantesAdicionales ?? [],
      (params.sellosFirmantes ?? []).slice(1),
      params.estamparFirmas === true,
    );
    const firmasExhibidor = [
      {
        firma: firmaExhibidorBase64 ?? PNG_1PX_BASE64,
        nombre: esContratoEn ? "THE EXHIBITOR" : "EL EXHIBIDOR",
        cargo: representanteLegal !== "-" ? representanteLegal : "",
      },
      ...firmasRepresentantes.map((rep) => ({
        firma: rep.firma_representante,
        nombre: esContratoEn ? "THE EXHIBITOR" : "EL EXHIBIDOR",
        cargo: rep.nombre_representante,
      })),
    ];
    const firmasTabla = Array.from({ length: Math.ceil(firmasExhibidor.length / 2) }, (_, indice) => {
      const primera = firmasExhibidor[indice * 2];
      const segunda = firmasExhibidor[indice * 2 + 1];
      return {
        firma_iimp: PNG_1PX_BASE64,
        linea_iimp: indice === 0 ? "_____________________________" : "",
        nombre_iimp: indice === 0 ? "IIMP" : "",
        cargo_iimp: indice === 0
          ? `Gustavo Adolfo De Vinatea Bellatin\n${esContratoEn ? "General Manager" : "Gerente General"}`
          : "",
        firma_1: primera?.firma ?? PNG_1PX_BASE64,
        linea_1: primera ? "_____________________________" : "",
        nombre_1: primera?.nombre ?? "",
        cargo_1: primera?.cargo ?? "",
        firma_2: segunda?.firma ?? PNG_1PX_BASE64,
        linea_2: segunda ? "_____________________________" : "",
        nombre_2: segunda?.nombre ?? "",
        cargo_2: segunda?.cargo ?? "",
      };
    });
    const firmasDeclaracionFilas = Array.from(
      { length: Math.ceil(firmasExhibidor.length / 2) },
      (_, indice) => {
        const primera = firmasExhibidor[indice * 2];
        const segunda = firmasExhibidor[indice * 2 + 1];
        return {
          firma_1: primera?.firma ?? PNG_1PX_BASE64,
          linea_1: primera ? "_____________________________" : "",
          nombre_1: primera?.nombre ?? "",
          cargo_1: primera?.cargo ?? "",
          firma_2: segunda?.firma ?? PNG_1PX_BASE64,
          linea_2: segunda ? "_____________________________" : "",
          nombre_2: segunda?.nombre ?? "",
          cargo_2: segunda?.cargo ?? "",
        };
      },
    );

    const data = {
      razon_social: razonSocial,
      ruc,
      domicilio_fiscal: domicilioFiscal,
      representante_legal: representanteLegal,
      dni_representante: dniRepresentante,
      partida_electronica: partidaElectronica,
      representantes_adicionales: representantesAdicionales,
      representantes_clausula: clausulaRepresentantes,
      firmas_representantes: firmasRepresentantes,
      firmas_tabla: firmasTabla,
      firmas_declaracion_filas: firmasDeclaracionFilas,
      objeto_social: textoObjetoSocial,
      actividad: textoActividad,
      modulos,
      planos: planosData,
      moneda: params.moneda,
      simbolo_moneda: simboloMoneda(params.moneda),
      moneda_codigo: etiquetaMoneda(params.moneda),
      cta_corriente: CUENTAS_CONTRATO[params.moneda].cuentaCorriente,
      cta_interbancaria: CUENTAS_CONTRATO[params.moneda].cuentaInterbancaria,
      cta_detraccion: CUENTAS_CONTRATO[params.moneda].cuentaDetraccion,
      tipo_cuenta: esContratoEn
        ? params.moneda
        : CUENTAS_CONTRATO[params.moneda].tipoCuenta,
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
      firmante_nombre_cargo: [
        representanteLegal !== "-" ? `${representanteLegal} - ${textoCargoRepresentante}` : "",
        ...representantesAdicionales.map((rep) => `${rep.nombre} - ${textoCargoRepresentante}`),
      ].filter(Boolean).join("; "),
      /** Codigos comerciales de los stands (Anexo 4: asunto de zona maquinaria). */
      codigos_stands: modulos.map((m) => m.modulo).join(", "),
      firmante_empresa: razonSocial !== "-" ? razonSocial : "",
      firma_exhibidor: firmaExhibidorBase64 ?? PNG_1PX_BASE64,
      firmante_fecha: fechaFirmaTexto,
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
      getSize: (_img: Buffer, _valor: unknown, tagName: string) =>
        (["firma_exhibidor", "firma_representante", "firma_iimp", "firma_1", "firma_2"].includes(tagName) ? [150, 55] : [520, 320]),
    });
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, modules: [imageModule] });
    doc.render(data);
    /* Word rechaza el DOCX si las imagenes generadas comparten el mismo docPr id. */
    const salida = doc.getZip();
    const archivoXml = salida.file("word/document.xml");
    if (!archivoXml) {
      throw new DomainError("No se pudo preparar el contrato generado", API_ERROR_CODES.INTERNAL, 500);
    }
    let xmlSalida = archivoXml.asText();
    let docPrId = 1000;
    xmlSalida = xmlSalida.replace(
      /<wp:docPr\b([^>]*?)id="\d+"/g,
      (_match, atributos: string) => `<wp:docPr${atributos}id="${docPrId++}"`,
    );
    salida.file("word/document.xml", xmlSalida);
    const docxBuffer = salida.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;

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
    const sellos = input.sellosVectoriales ?? [];
    const capturasCompletas = sellos.length > 0 && sellos.every((s) => s.esSello || s.imagen);
    if (!capturasCompletas) {
      if (!perfil?.firmaUrl) {
        throw new DomainError("Antes de firmar digitalmente, sube tu firma (imagen) en tu Perfil.", API_ERROR_CODES.VALIDATION, 409);
      }
      const empresaFirmanteId = emailFirmante
        ? await this.auth.findEmpresaIdDeUsuario(emailFirmante).catch(() => null)
        : null;
      const empresaFirmante = empresaFirmanteId ? await this.empresas.findById(empresaFirmanteId) : null;
      const representantesSinFirma = (empresaFirmante?.representantesAdicionales ?? []).filter((rep) => !rep.firmaUrl);
      if (representantesSinFirma.length > 0) {
        throw new DomainError(
          `Antes de firmar, sube la firma digital de: ${representantesSinFirma.map((rep) => rep.nombre).join(", ")}.`,
          API_ERROR_CODES.VALIDATION,
          409,
        );
      }
    }

    const base64DeImagen = (imagen: string) => {
      const coma = imagen.indexOf(",");
      return coma >= 0 ? imagen.slice(coma + 1) : imagen;
    };

    let firmaPrincipal = PNG_1PX_BASE64;
    if (sellos[0]?.esSello) {
      firmaPrincipal = PNG_1PX_BASE64;
    } else if (sellos[0]?.imagen) {
      const capturada = await sharp(Buffer.from(base64DeImagen(sellos[0].imagen), "base64"))
        .resize({ width: 480, withoutEnlargement: true })
        .png()
        .toBuffer();
      firmaPrincipal = capturada.toString("base64");
    } else if (perfil?.firmaUrl) {
      const imagen = await this.leerImagenFirma(perfil.firmaUrl);
      const png = await sharp(imagen).resize({ width: 480, withoutEnlargement: true }).png().toBuffer();
      firmaPrincipal = png.toString("base64");
    }

    const generado = await this.generar({
      solicitudId: input.solicitudId,
      idioma: input.idioma,
      firmaExhibidorBase64: firmaPrincipal,
      contrato: input.contrato,
      sellosFirmantes: sellos,
      estamparFirmas: true,
      esFirma: true,
      userEmail: input.userEmail,
      userSub: input.userSub,
      userPermissions: input.userPermissions,
      registrarContrato: false,
    });

    let pdfUrl = generado.pdfUrl;
    if (sellos.some((s) => s.esSello) && generado.pdfUrl) {
      const pdfBytes = await this.leerImagenFirma(generado.pdfUrl);
      const pdfVectorial = await this.estamparSellosVectoriales(pdfBytes, sellos);
      if (pdfVectorial) {
        pdfUrl = await this.storage.upload(pdfVectorial, `${generado.nombre}.pdf`, "application/pdf");
      }
    }
    return { docxUrl: generado.docxUrl, pdfUrl, nombre: generado.nombre };
  }

  /**
   * Estampa los sellos digitales como texto y rectangulo VECTORIAL encima del PDF
   * firmado (nitidez de texto nativo, sin raster). Las coordenadas vienen en puntos
   * PDF desde la deteccion de zonas que hace la vista de firma.
   */
  private async estamparSellosVectoriales(
    pdfBytes: Buffer,
    sellos: SelloVectorialFirma[],
  ): Promise<Buffer | null> {
    try {
      const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
      const colorSello = rgb(0.106, 0.212, 0.365);
      const colorFecha = rgb(0.278, 0.345, 0.412);

      for (const sello of sellos) {
        if (!sello.esSello) continue;
        for (const seccion of sello.secciones) {
          const page = doc.getPage(seccion.pagina - 1);
          if (!page) continue;
          const x = seccion.x;
          const y = seccion.y;
          const w = seccion.w;
          const h = seccion.h;
          const centro = x + w / 2;

          page.drawRectangle({
            x,
            y,
            width: w,
            height: h,
            borderColor: colorSello,
            borderWidth: 1.4,
          });

          const dibujarLinea = (texto: string, size: number, baseY: number, bold: boolean) => {
            const fuente = bold ? fontBold : font;
            const maxWidth = Math.max(10, w - 8);
            let tamano = size;
            const anchoBase = fuente.widthOfTextAtSize(texto, tamano);
            if (anchoBase > maxWidth) {
              tamano = size * (maxWidth / anchoBase);
            }
            const ancho = fuente.widthOfTextAtSize(texto, tamano);
            page.drawText(texto, {
              x: centro - ancho / 2,
              y: baseY,
              size: tamano,
              font: fuente,
              color: bold ? colorSello : colorFecha,
            });
          };

          dibujarLinea("Firmado digitalmente por", 6.5, y + h - 10, false);
          dibujarLinea((sello.nombres || "-").trim().toUpperCase(), 8, y + h - 20, true);
          dibujarLinea((sello.apellidos || "-").trim().toUpperCase(), 8, y + h - 29, true);
          dibujarLinea(sello.fecha || dateUtils.formatDateTime(dateUtils.now()), 6, y + h - 38.5, false);
        }
      }

      const salida = await doc.save();
      return Buffer.from(salida);
    } catch {
      return null;
    }
  }

  /** Prepara la imagen de firma de cada representante adicional para la plantilla. */
  private async prepararFirmasRepresentantes(
    representantes: EmpresaRepresentanteAdicionalEntity[],
    sellosAdicionales: SelloVectorialFirma[] = [],
    estamparFirmas = false,
  ): Promise<Array<{ nombre_representante: string; firma_representante: string }>> {
    return Promise.all(representantes.map(async (rep, index) => {
      const sello = sellosAdicionales[index];
      if (!estamparFirmas || sello?.esSello) {
        return { nombre_representante: rep.nombre, firma_representante: PNG_1PX_BASE64 };
      }
      if (sello?.imagen) {
        const coma = sello.imagen.indexOf(",");
        const base64 = coma >= 0 ? sello.imagen.slice(coma + 1) : sello.imagen;
        const capturada = await sharp(Buffer.from(base64, "base64"))
          .resize({ width: 480, withoutEnlargement: true })
          .png()
          .toBuffer();
        return { nombre_representante: rep.nombre, firma_representante: capturada.toString("base64") };
      }
      if (!rep.firmaUrl) {
        return { nombre_representante: rep.nombre, firma_representante: PNG_1PX_BASE64 };
      }
      const imagen = await this.leerImagenFirma(rep.firmaUrl);
      const png = await sharp(imagen).resize({ width: 480, withoutEnlargement: true }).png().toBuffer();
      return { nombre_representante: rep.nombre, firma_representante: png.toString("base64") };
    }));
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
      /* El usuario del contenedor no tiene HOME escribible: sin un perfil propio,
       * LibreOffice no inicia y la conversion devuelve null (contrato solo DOCX). */
      const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "lo-profile-"));
      const profileUrl = pathToFileURL(profileDir).href;
      const limpiar = () => {
        fs.rmSync(profileDir, { recursive: true, force: true });
      };
      const proc = spawn(
        this.resolverSoffice(),
        [`-env:UserInstallation=${profileUrl}`, "--headless", "--convert-to", "pdf", "--outdir", os.tmpdir(), inPath],
        { stdio: "ignore" },
      );
      let terminado = false;
      const finalizar = (buf: Buffer | null) => {
        if (terminado) return;
        terminado = true;
        clearTimeout(timer);
        limpiar();
        resolve(buf);
      };
      const timer = setTimeout(() => {
        proc.kill();
        finalizar(null);
      }, CONVERSION_PDF_TIMEOUT_MS);
      proc.on("error", () => finalizar(null));
      proc.on("close", (code) => {
        if (code === 0 && fs.existsSync(outPath)) {
          const buf = fs.readFileSync(outPath);
          fs.rmSync(outPath, { force: true });
          finalizar(buf);
        } else {
          finalizar(null);
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