import { describe, expect, it, vi } from "vitest";
import { DdMatrizAsistenteApplicationService } from "../dd-matriz-asistente-service";
import { CONFIG_DEFAULT } from "../dd-configuracion-service";
import type { DdMatrizAdjuntoEntity, DdMatrizVinculoEntity } from "@/domain/models/dd-matriz-evaluacion";
import type { DdAsistenteRespuestaIa, DdAsistenteSolicitudIa, IDdAsistenteIaClient } from "@/domain/ports/dd-asistente-ia-client";
import type { IExtractorTexto } from "@/domain/ports/extractor-texto";
import type { DdMatrizAsistenteRequestDTO } from "@/types/dto/debida-diligencia";
import {
  DD_ASISTENTE,
  DD_ASISTENTE_MENSAJES,
  DD_ASISTENTE_METODOS_TEXTO,
  DD_ASISTENTE_MIME,
  DD_ASISTENTE_MODOS,
  DD_MATRIZ_AMBITOS,
  DD_MATRIZ_CRITERIO_PREFIJO,
  DD_MATRIZ_LISTA_OBSERVACION_EXTENDIDA_MAX,
  DD_MATRIZ_LISTA_OTROS,
  DD_MATRIZ_ORIGENES,
  DD_MATRIZ_TIPOS_VINCULO,
  PERMISSIONS,
} from "@/lib/shared/constants";

const OEFA = "oefa";
const SESION_SIG = { email: "sig@iimp.org.pe", roles: [], permissions: [PERMISSIONS.DD_MATRIZ, PERMISSIONS.DD_REVISION] };
const BLOQUE_VACIO = { fecha: null, responsable: null, resultado: null, observaciones: null, conclusion: null };

function vinculo(parcial: Partial<DdMatrizVinculoEntity> = {}): DdMatrizVinculoEntity {
  return {
    id: "v-1",
    tipo: DD_MATRIZ_TIPOS_VINCULO.EMPRESA,
    refKey: "empresa",
    origen: DD_MATRIZ_ORIGENES.AUTOMATICO,
    nombre: "MINERA DEMO S.A.C.",
    tipoDocumento: "RUC",
    documento: "20100000001",
    nacionalidad: null,
    cargo: null,
    ambito: DD_MATRIZ_AMBITOS.NACIONAL,
    ambitoEditado: false,
    pais: "PE",
    paisEditado: false,
    identidadEditada: false,
    fechaInicioActividades: null,
    estadoContribuyente: null,
    direccionLegal: null,
    actividadEconomica: null,
    motivo: null,
    eventoProyecto: null,
    historialIimp: null,
    beneficioMutuo: null,
    listas: {},
    listasObservaciones: {},
    sig: { ...BLOQUE_VACIO },
    reputacional: { ...BLOQUE_VACIO },
    compliance: { ...BLOQUE_VACIO },
    resultadoFinal: null,
    finalFecha: null,
    finalPor: null,
    finalComentario: null,
    creadoPor: "sistema",
    actualizadoPor: null,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    expediente: {
      expedienteId: "exp-1",
      eventoId: "evento-1",
      eventoLabel: "PERUMIN 2027",
      codigo: "DD-2026-0001",
      estado: "en_revision",
      empresaRazonSocial: "MINERA DEMO S.A.C.",
      empresaRuc: "20100000001",
      empresaDireccionFiscal: null,
      empresaPais: "PE",
      paisConstitucion: "Perú",
      actividadEconomica: null,
      tipoRelacionComercial: [],
      motivo: null,
      eventoProyecto: null,
      fechaIngreso: new Date("2026-10-01T00:00:00Z"),
      revisadoPor: null,
      fechaRevision: null,
    },
    ...parcial,
  };
}

function adjunto(id: string, nombre: string, mimeType: string, codigo = OEFA, tamano = 1000): DdMatrizAdjuntoEntity {
  return {
    id,
    vinculoId: "v-1",
    categoria: `${DD_MATRIZ_CRITERIO_PREFIJO}${codigo}` as DdMatrizAdjuntoEntity["categoria"],
    nombre,
    url: `/uploads/${nombre}`,
    mimeType,
    tamano,
    creadoPor: "sig@iimp.org.pe",
    createdAt: new Date("2026-10-02T00:00:00Z"),
  };
}

function montar(opciones: {
  adjuntos?: DdMatrizAdjuntoEntity[];
  vinculo?: DdMatrizVinculoEntity | null;
  iaDisponible?: boolean;
  ocrDisponible?: boolean;
  respuesta?: string | null;
  errorIa?: Error;
  extraer?: IExtractorTexto["extraer"];
  /** Regla «Asistente IA en observaciones»; sin valor no se pasa repositorio de configuracion. */
  asistenteIaHabilitado?: boolean;
} = {}) {
  const repo = {
    findVinculo: vi.fn().mockResolvedValue(opciones.vinculo === undefined ? vinculo() : opciones.vinculo),
    listarAdjuntos: vi.fn().mockResolvedValue(opciones.adjuntos ?? [adjunto("a-1", "oefa.pdf", DD_ASISTENTE_MIME.PDF)]),
    registrarAuditoria: vi.fn().mockResolvedValue(undefined),
  };
  const documentos = { leer: vi.fn().mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]), mimeType: "", fileName: "x" }) };
  const texto = opciones.respuesta === undefined ? "Se registran 2 sanciones del OEFA." : opciones.respuesta;
  const generar = vi.fn<(solicitud: DdAsistenteSolicitudIa) => Promise<DdAsistenteRespuestaIa | null>>();
  if (opciones.errorIa) generar.mockRejectedValue(opciones.errorIa);
  else generar.mockResolvedValue(texto === null ? null : { texto, modelo: "Gemini prueba" });
  const ia: IDdAsistenteIaClient = {
    disponible: () => opciones.iaDisponible ?? true,
    generar,
  };
  const extraer = vi.fn(
    opciones.extraer ??
      (async () => ({ texto: "Resolucion 123-2025-OEFA multa 10 UIT", paginas: 2, metodo: DD_ASISTENTE_METODOS_TEXTO.OCR })),
  );
  const extractor: IExtractorTexto = {
    ocrDisponible: vi.fn().mockResolvedValue(opciones.ocrDisponible ?? true),
    extraer,
  };
  const configuracion =
    opciones.asistenteIaHabilitado === undefined
      ? undefined
      : { obtener: vi.fn().mockResolvedValue({ ...CONFIG_DEFAULT, asistenteIaHabilitado: opciones.asistenteIaHabilitado }) };
  const servicio = new DdMatrizAsistenteApplicationService(repo, documentos, ia, extractor, configuracion);
  return { servicio, repo, documentos, generar, extraer };
}

function solicitud(parcial: Partial<DdMatrizAsistenteRequestDTO> = {}): DdMatrizAsistenteRequestDTO {
  return {
    vinculoId: "v-1",
    codigo: OEFA,
    modo: DD_ASISTENTE_MODOS.IA,
    prompt: "Lee el documento y dame un resumen.",
    adjuntoIds: ["a-1"],
    ...parcial,
  };
}

describe("DdMatrizAsistenteApplicationService", () => {
  it("modo IA: envia el PDF completo con el prompt y registra auditoria", async () => {
    const { servicio, generar, extraer, repo } = montar();
    const r = await servicio.generar(SESION_SIG, solicitud());
    expect(r.texto).toBe("Se registran 2 sanciones del OEFA.");
    expect(r.evidencias).toEqual([{ id: "a-1", nombre: "oefa.pdf", metodo: null, paginas: null }]);
    const enviado = generar.mock.calls[0]![0];
    expect(enviado.archivos).toHaveLength(1);
    expect(enviado.archivos[0]!.mimeType).toBe(DD_ASISTENTE_MIME.PDF);
    expect(enviado.textos).toHaveLength(0);
    expect(enviado.prompt).toBe("Lee el documento y dame un resumen.");
    expect(enviado.instrucciones).toContain("MINERA DEMO S.A.C.");
    expect(enviado.timeoutMs).toBe(DD_ASISTENTE.TIMEOUT_IA_ARCHIVOS_MS);
    expect(extraer).not.toHaveBeenCalled();
    expect(repo.registrarAuditoria).toHaveBeenCalledWith(
      DD_ASISTENTE.ACCION_AUDITORIA,
      "DD-2026-0001",
      SESION_SIG.email,
      expect.stringContaining("oefa.pdf"),
    );
    expect(repo.registrarAuditoria.mock.calls[0]![3]).toContain("Gemini prueba");
  });

  it("la IA no responde a tiempo (error tecnico): 503 con mensaje claro", async () => {
    const { servicio, repo } = montar({ errorIa: new DOMException("The operation was aborted due to timeout", "TimeoutError") });
    await expect(servicio.generar(SESION_SIG, solicitud())).rejects.toMatchObject({
      status: 503,
      message: DD_ASISTENTE_MENSAJES.IA_SATURADA,
    });
    expect(repo.registrarAuditoria).not.toHaveBeenCalled();
  });

  it("modo IA: el Word se envia como texto", async () => {
    const { servicio, generar } = montar({
      adjuntos: [adjunto("a-1", "informe.docx", DD_ASISTENTE_MIME.DOCX)],
      extraer: async () => ({ texto: "Texto del Word", paginas: 1, metodo: DD_ASISTENTE_METODOS_TEXTO.DOCX }),
    });
    const r = await servicio.generar(SESION_SIG, solicitud());
    const enviado = generar.mock.calls[0]![0];
    expect(enviado.archivos).toHaveLength(0);
    expect(enviado.textos[0]!.texto).toContain("Texto del Word");
    expect(r.evidencias[0]!.metodo).toBe(DD_ASISTENTE_METODOS_TEXTO.DOCX);
  });

  it("modo OCR: solo el texto extraido va a la IA, con el nombre de la evidencia", async () => {
    const { servicio, generar, extraer } = montar();
    const r = await servicio.generar(SESION_SIG, solicitud({ modo: DD_ASISTENTE_MODOS.OCR }));
    expect(extraer).toHaveBeenCalledTimes(1);
    const enviado = generar.mock.calls[0]![0];
    expect(enviado.archivos).toHaveLength(0);
    expect(enviado.textos[0]!.texto).toContain("oefa.pdf");
    expect(enviado.textos[0]!.texto).toContain("Resolucion 123-2025-OEFA");
    expect(enviado.instrucciones).toContain("OCR");
    expect(enviado.timeoutMs).toBe(DD_ASISTENTE.TIMEOUT_IA_TEXTO_MS);
    expect(r.evidencias).toEqual([{ id: "a-1", nombre: "oefa.pdf", metodo: DD_ASISTENTE_METODOS_TEXTO.OCR, paginas: 2 }]);
  });

  it("modo OCR: recorta el texto extraido al maximo y lo avisa", async () => {
    const { servicio, generar } = montar({
      extraer: async () => ({ texto: "x".repeat(DD_ASISTENTE.TEXTO_MAX + 500), paginas: 10, metodo: DD_ASISTENTE_METODOS_TEXTO.OCR }),
    });
    const r = await servicio.generar(SESION_SIG, solicitud({ modo: DD_ASISTENTE_MODOS.OCR }));
    expect(r.textoTruncado).toBe(true);
    expect(generar.mock.calls[0]![0].textos[0]!.texto.length).toBe(DD_ASISTENTE.TEXTO_MAX);
  });

  it("modo OCR sin texto legible: 422", async () => {
    const { servicio, generar } = montar({
      extraer: async () => ({ texto: "   ", paginas: 1, metodo: DD_ASISTENTE_METODOS_TEXTO.OCR }),
    });
    await expect(servicio.generar(SESION_SIG, solicitud({ modo: DD_ASISTENTE_MODOS.OCR }))).rejects.toMatchObject({
      status: 422,
      message: DD_ASISTENTE_MENSAJES.SIN_TEXTO,
    });
    expect(generar).not.toHaveBeenCalled();
  });

  it("modo OCR sin Tesseract instalado: 503", async () => {
    const { servicio } = montar({ ocrDisponible: false });
    await expect(servicio.generar(SESION_SIG, solicitud({ modo: DD_ASISTENTE_MODOS.OCR }))).rejects.toMatchObject({
      status: 503,
      message: DD_ASISTENTE_MENSAJES.OCR_NO_DISPONIBLE,
    });
  });

  it("sin proveedor de IA: 503", async () => {
    const { servicio } = montar({ iaDisponible: false });
    await expect(servicio.generar(SESION_SIG, solicitud())).rejects.toMatchObject({
      status: 503,
      message: DD_ASISTENTE_MENSAJES.IA_NO_DISPONIBLE,
    });
  });

  it("solo SIG: Legal con matriz no puede usarlo", async () => {
    const { servicio } = montar();
    await expect(
      servicio.generar({ email: "legal@iimp.org.pe", roles: [], permissions: [PERMISSIONS.DD_MATRIZ, PERMISSIONS.DD_LEGAL] }, solicitud()),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("regla de Configuración DD apagada: 403 y no consulta a la IA; encendida: responde", async () => {
    const apagado = montar({ asistenteIaHabilitado: false });
    await expect(apagado.servicio.generar(SESION_SIG, solicitud())).rejects.toMatchObject({
      status: 403,
      message: DD_ASISTENTE_MENSAJES.DESHABILITADO,
    });
    expect(apagado.generar).not.toHaveBeenCalled();

    const encendido = montar({ asistenteIaHabilitado: true });
    await expect(encendido.servicio.generar(SESION_SIG, solicitud())).resolves.toMatchObject({ modo: DD_ASISTENTE_MODOS.IA });
  });

  it("criterio no habilitado (OFAC): 400", async () => {
    const { servicio } = montar();
    await expect(servicio.generar(SESION_SIG, solicitud({ codigo: "ofac" }))).rejects.toMatchObject({
      status: 400,
      message: DD_ASISTENTE_MENSAJES.CRITERIO_NO_HABILITADO,
    });
  });

  it("criterio que no aplica al vinculo (corrupcion_persona en una empresa): 400", async () => {
    const { servicio } = montar();
    await expect(servicio.generar(SESION_SIG, solicitud({ codigo: "corrupcion_persona" }))).rejects.toMatchObject({
      status: 400,
      message: DD_ASISTENTE_MENSAJES.CRITERIO_NO_APLICA,
    });
  });

  it("evidencia de otro criterio: 400", async () => {
    const { servicio } = montar({
      adjuntos: [adjunto("a-1", "oefa.pdf", DD_ASISTENTE_MIME.PDF), adjunto("a-2", "otros.pdf", DD_ASISTENTE_MIME.PDF, DD_MATRIZ_LISTA_OTROS)],
    });
    await expect(servicio.generar(SESION_SIG, solicitud({ adjuntoIds: ["a-2"] }))).rejects.toMatchObject({
      status: 400,
      message: DD_ASISTENTE_MENSAJES.EVIDENCIA_AJENA,
    });
  });

  it("criterio sin evidencias: 400", async () => {
    const { servicio } = montar({ adjuntos: [] });
    await expect(servicio.generar(SESION_SIG, solicitud())).rejects.toMatchObject({
      status: 400,
      message: DD_ASISTENTE_MENSAJES.SIN_EVIDENCIA,
    });
  });

  it("evidencias que superan el tamano maximo: 400", async () => {
    const { servicio } = montar({
      adjuntos: [adjunto("a-1", "oefa.pdf", DD_ASISTENTE_MIME.PDF, OEFA, DD_ASISTENTE.BYTES_MAX + 1)],
    });
    await expect(servicio.generar(SESION_SIG, solicitud())).rejects.toMatchObject({
      status: 400,
      message: DD_ASISTENTE_MENSAJES.TAMANO_EXCEDIDO,
    });
  });

  it("formato no soportado: 400", async () => {
    const { servicio } = montar({ adjuntos: [adjunto("a-1", "datos.xlsx", "application/vnd.ms-excel")] });
    await expect(servicio.generar(SESION_SIG, solicitud())).rejects.toMatchObject({
      status: 400,
      message: DD_ASISTENTE_MENSAJES.FORMATO_NO_SOPORTADO,
    });
  });

  it("la IA no responde: 502", async () => {
    const { servicio } = montar({ respuesta: null });
    await expect(servicio.generar(SESION_SIG, solicitud())).rejects.toMatchObject({
      status: 502,
      message: DD_ASISTENTE_MENSAJES.SIN_RESPUESTA,
    });
  });

  it("recorta la respuesta al limite de la observacion del criterio", async () => {
    const { servicio } = montar({ respuesta: "a".repeat(DD_MATRIZ_LISTA_OBSERVACION_EXTENDIDA_MAX + 10) });
    const r = await servicio.generar(SESION_SIG, solicitud());
    expect(r.recortado).toBe(true);
    expect(r.texto.length).toBe(DD_MATRIZ_LISTA_OBSERVACION_EXTENDIDA_MAX);
  });

  it("vinculo inexistente: 404", async () => {
    const { servicio } = montar({ vinculo: null });
    await expect(servicio.generar(SESION_SIG, solicitud())).rejects.toMatchObject({ status: 404 });
  });
});
