import 'server-only';

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ImageModule from "docxtemplater-image-module-free";
import sharp from "sharp";

import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { IEmpresaRepository } from "@/domain/ports/empresa-repository";
import type { IPlanoRepository } from "@/domain/ports/plano-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IGessRepository } from "@/domain/ports/gess-repository";
import type { PlanoEntity } from "@/domain/models/plano-entities";
import type { PlanoItem } from "@/lib/shared/planos/registry";
import type { StorageAdapter } from "@/lib/server/storage";
import { DomainError } from "@/lib/server/router";
import { API_ERROR_CODES, CUOTA_MONTO_MINIMO, ESTADOS_SOLICITUD, IDIOMAS, MAX_CUOTAS_PAGO, MODOS_PAGO, PERMISSIONS, type Idioma } from "@/lib/shared/constants";
import { resolverIdiomaDestinatario } from "@/application/idioma/resolver-idioma";
import { calcularImportes } from "@/lib/shared/utils/importes";
import { resolverPrecioStand } from "@/lib/shared/utils/precio-stand";
import { fechasCuotasValidas, planCuotasConFechas, porcentajesValidos } from "@/lib/shared/utils/cuotas";
import { construirSvgRecorte } from "@/lib/shared/utils/recorte-plano";
import { renderizarMacroConSecciones } from "@/lib/server/macro-plano";
import { numberUtils } from "@/lib/shared/utils/number";

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
  userSub: string;
  userPermissions: string[];
}

export interface FirmarContratoInput {
  solicitudId: string;
  idioma?: Idioma;
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
}

/** Firma digital del borrador (antes de que exista la solicitud). */
export interface FirmarBorradorInput {
  standIds: string[];
  cuotas: Array<{ porcentaje: number; fechaVencimiento: string }>;
  idioma?: Idioma;
  email: string;
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
    if (!isAdmin && detalle.userId !== input.userSub) {
      throw new DomainError("No puedes generar el contrato de esta solicitud", API_ERROR_CODES.FORBIDDEN, 403);
    }
    /* El cliente solo puede (re)generar mientras la solicitud esta pendiente; despues, solo admin. */
    if (!isAdmin && detalle.estadoSolicitud !== ESTADOS_SOLICITUD.PENDIENTE) {
      throw new DomainError("La solicitud ya avanzo en el flujo; no puedes regenerar el contrato.", API_ERROR_CODES.CONFLICT, 409);
    }

    /* Datos de la empresa del cliente (cuenta → empresa del Portal). */
    const empresaId = detalle.email ? await this.auth.findEmpresaIdDeUsuario(detalle.email) : null;
    const empresa = empresaId ? await this.empresas.findById(empresaId) : null;

    /* Idioma del contrato: el elegido por quien lo genera (UI) o el del cliente (perfil/cookie). */
    const idioma: Idioma = input.idioma ?? (await resolverIdiomaDestinatario(this.auth, detalle.email ?? null));

    /* Modulos (stands) + recortes por pabellon (el recorte se genera en el servidor). */
    const bloqueIds = detalle.bloqueId ? [detalle.bloqueId] : [...(detalle.standCodes ?? [])];
    const { modulos, gruposPabellon } = await this.construirModulos(
      bloqueIds.map((bloqueId) => ({
        bloqueId,
        tipoStand: detalle.tipoStand,
        pabellon: detalle.pabellon ?? null,
      })),
    );

    /* Importes y cuotas: los MONTOS nunca vienen del cliente (precio del stand en BD). */
    const { importes, plan, porcentajes, modalidad } = this.calcularPlan(
      detalle.precio ?? 0,
      input.cuotas ?? detalle.planCuotas?.cuotas.map((c) => ({ porcentaje: c.porcentaje, fechaVencimiento: c.fechaVencimiento ?? "" })),
    );

    /* Snapshot del plan: fuente de verdad para regenerar el contrato y para Facturacion. */
    await this.solicitudes.guardarPlanCuotas(input.solicitudId, { modalidad, cuotas: plan });

    const base = `contrato-${(detalle.standCode || input.solicitudId.slice(0, 8)).replace(/[^A-Za-z0-9_-]/g, "")}-${Date.now()}`;
    const generado = await this.renderContrato({
      idioma,
      empresa,
      empresaFallback: detalle.empresa,
      emailFallback: detalle.email,
      modulos,
      gruposPabellon,
      importes,
      plan,
      porcentajes,
      modalidad,
      firmaExhibidorBase64: input.firmaExhibidorBase64,
      base,
    });

    const urlContrato = generado.pdfUrl ?? generado.docxUrl;
    const etiquetaContrato = idioma === IDIOMAS.EN ? "Exhibition contract" : "Contrato de exhibicion";
    await this.solicitudes.upsertContratoSistema(
      input.solicitudId,
      urlContrato,
      `${etiquetaContrato} (${porcentajes.map((c) => `${c}%`).join(" / ")}).${generado.pdfUrl ? "pdf" : "docx"}`,
    );

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
      stands.map((s) => ({ bloqueId: s.bloqueId ?? s.standCode, tipoStand: s.tipoStand, pabellon: null })),
    );
    const neto = stands.reduce((sum, s) => sum + resolverPrecioStand(s), 0);
    const { importes, plan, porcentajes, modalidad } = this.calcularPlan(neto, input.cuotas);

    const codigos = stands.map((s) => s.standCode).join("-").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
    const base = `contrato-borrador-${codigos || "stands"}-${Date.now()}`;
    return this.renderContrato({
      idioma,
      empresa,
      empresaFallback: null,
      emailFallback: input.email,
      modulos,
      gruposPabellon,
      importes,
      plan,
      porcentajes,
      modalidad,
      firmaExhibidorBase64: input.firmaExhibidorBase64,
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
    if (porcentajes.length > MAX_CUOTAS_PAGO || !porcentajesValidos(porcentajes)) {
      throw new DomainError("Configuracion de cuotas invalida (1 a 3 cuotas que suman 100%).", API_ERROR_CODES.VALIDATION, 400);
    }
    if (!fechasCuotasValidas(fechas)) {
      throw new DomainError("Las fechas de pago no pueden ser pasadas y deben ir en orden cronologico.", API_ERROR_CODES.VALIDATION, 400);
    }
    const plan = planCuotasConFechas(importes.total, porcentajes, fechas);
    if (plan.some((c) => c.monto < CUOTA_MONTO_MINIMO)) {
      throw new DomainError(`Cada cuota debe ser de al menos US$ ${CUOTA_MONTO_MINIMO.toFixed(2)}.`, API_ERROR_CODES.VALIDATION, 400);
    }
    const esCompleto = porcentajes.length === 1;
    const esMitad = porcentajes.length === 2 && porcentajes[0] === 50 && porcentajes[1] === 50;
    const modalidad = esCompleto ? MODOS_PAGO.COMPLETO : esMitad ? MODOS_PAGO.CUOTAS : MODOS_PAGO.PERSONALIZADO;
    return { importes, plan, porcentajes, modalidad };
  }

  /** Modulos del Anexo 1 + grupos por pabellon (items del plano para el recorte). */
  private async construirModulos(
    refs: Array<{ bloqueId: string; tipoStand: string | null; pabellon: string | null }>,
  ): Promise<{
    modulos: Array<{ modulo: string; zona: string; tipo: string; metraje: string; frente: string; fondo: string }>;
    gruposPabellon: Map<string, { nombre: string; planoId: string; objetivos: string[]; items: PlanoItem[]; etiquetas: Record<string, string> }>;
  }> {
    const modulos: Array<{ modulo: string; zona: string; tipo: string; metraje: string; frente: string; fondo: string }> = [];
    const gruposPabellon = new Map<string, { nombre: string; planoId: string; objetivos: string[]; items: PlanoItem[]; etiquetas: Record<string, string> }>();
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
          };
          grupo.objetivos.push(ref.bloqueId);
          gruposPabellon.set(codigo, grupo);
        }
      }
      modulos.push({
        modulo: ref.bloqueId,
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
    emailFallback: string | null;
    modulos: Array<{ modulo: string; zona: string; tipo: string; metraje: string; frente: string; fondo: string }>;
    gruposPabellon: Map<string, { nombre: string; planoId: string; objetivos: string[]; items: PlanoItem[]; etiquetas: Record<string, string> }>;
    importes: ReturnType<typeof calcularImportes>;
    plan: ReturnType<typeof planCuotasConFechas>;
    porcentajes: number[];
    modalidad: string;
    firmaExhibidorBase64?: string;
    base: string;
  }): Promise<ContratoGenerado> {
    const { idioma, empresa, modulos, gruposPabellon, importes, plan, firmaExhibidorBase64, base } = params;
    const esCompleto = params.modalidad === MODOS_PAGO.COMPLETO;
    const esMitad = params.modalidad === MODOS_PAGO.CUOTAS;
    const esPersonalizado = params.modalidad === MODOS_PAGO.PERSONALIZADO;
    const fechaCorta = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "");

    const hoy = new Date();
    const fechaFirma = `${String(hoy.getDate()).padStart(2, "0")}/${String(hoy.getMonth() + 1).padStart(2, "0")}/${hoy.getFullYear()}`;

    /*
     * Imagenes del Anexo 1: una por pabellon, generadas en el SERVIDOR con los mismos
     * datos del plano (util compartida con el portal) y rasterizadas con sharp.
     */
    const planosData: Array<{ imagen_plano: string; pabellon: string; version: string; fecha: string }> = [];
    for (const grupo of gruposPabellon.values()) {
      try {
        const { svg, encontrado } = construirSvgRecorte(grupo.items, grupo.objetivos, { etiquetas: grupo.etiquetas });
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
          pabellon: "Ubicacion general - Mapa de pabellones",
          version: "1",
          fecha: fechaFirma,
        });
      }
    } catch { /* imagen de ubicacion omitida: el contrato sigue siendo valido */ }

    const monto = (valor: number) => numberUtils.numero(valor, { decimales: 2 });

    const data = {
      razon_social: empresa?.razonSocial ?? params.empresaFallback ?? "-",
      ruc: empresa?.ruc ?? "-",
      domicilio_fiscal: empresa?.direccionFiscal ?? "-",
      representante_legal: empresa?.representanteLegalNombre ?? "-",
      dni_representante: empresa?.representanteLegalDni ?? "-",
      partida_electronica: empresa?.partidaElectronica ?? "",
      objeto_social: "actividades propias de su giro comercial",
      actividad: "exhibicion de productos y servicios",
      correo_planos: empresa?.emailContacto ?? params.emailFallback ?? "",
      modulos,
      planos: planosData,
      monto_total: monto(importes.total),
      valor_venta: monto(importes.valorVenta),
      igv: monto(importes.igv),
      precio_venta: monto(importes.total),
      sel_modalidad_1: esCompleto ? "X" : "",
      monto_modalidad_1: esCompleto ? monto(importes.total) : "",
      sel_modalidad_2: esMitad ? "X" : "",
      sel_modalidad_3: esPersonalizado ? "X" : "",
      cuotas_contrato: plan.map((c) => ({
        numero: c.numero,
        porcentaje: c.porcentaje,
        monto: monto(c.monto),
        fecha: fechaCorta(c.fechaVencimiento),
      })),
      firmante_nombre_cargo: empresa?.representanteLegalNombre
        ? `${empresa.representanteLegalNombre} - Representante Legal`
        : "",
      firmante_empresa: empresa?.razonSocial ?? params.empresaFallback ?? "",
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
    const pdfBuffer = await this.convertirPdf(docxBuffer);
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
    if (!isAdmin && detalle.estadoSolicitud !== ESTADOS_SOLICITUD.PENDIENTE) {
      throw new DomainError("La solicitud ya avanzo en el flujo; no puedes firmar el contrato.", API_ERROR_CODES.CONFLICT, 409);
    }

    const perfil = detalle.email ? await this.auth.findPerfilByEmail(detalle.email) : null;
    if (!perfil?.firmaUrl) {
      throw new DomainError("Antes de firmar digitalmente, sube tu firma (imagen) en tu Perfil.", API_ERROR_CODES.VALIDATION, 409);
    }

    const imagen = await this.leerImagenFirma(perfil.firmaUrl);
    const png = await sharp(imagen).resize({ width: 480, withoutEnlargement: true }).png().toBuffer();

    const generado = await this.generar({
      solicitudId: input.solicitudId,
      idioma: input.idioma,
      firmaExhibidorBase64: png.toString("base64"),
      userSub: input.userSub,
      userPermissions: input.userPermissions,
    });
    return { docxUrl: generado.docxUrl, pdfUrl: generado.pdfUrl, nombre: generado.nombre };
  }

  /** Lee la imagen de firma local (`/uploads/*`) o remota (S3). */
  private async leerImagenFirma(url: string): Promise<Buffer> {
    if (url.startsWith("/uploads/")) {
      return fs.readFileSync(path.join(process.cwd(), "public", url));
    }
    const res = await fetch(url);
    if (!res.ok) throw new DomainError("No se pudo leer tu firma digital", API_ERROR_CODES.INTERNAL, 500);
    return Buffer.from(await res.arrayBuffer());
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