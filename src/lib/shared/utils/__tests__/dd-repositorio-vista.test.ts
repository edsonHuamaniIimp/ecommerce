import { describe, expect, it } from "vitest";
import {
  DD_DOCUMENTO_ESTADOS,
  DD_DOCUMENTOS,
  DD_DOCUMENTOS_REQUERIDOS,
  DD_MATRIZ_ADJUNTO_CATEGORIAS,
  DD_MATRIZ_CRITERIO_PREFIJO,
  DD_REPOSITORIO_AGRUPACIONES,
  DD_REPOSITORIO_AREAS,
  DD_REPOSITORIO_FORMATOS,
  DD_REPOSITORIO_ORDENES,
  DD_REPOSITORIO_PERIODOS,
  DD_REPOSITORIO_TABS,
  DD_REPOSITORIO_TIPOS,
  DD_REPOSITORIO_VINCULO_EXPEDIENTE,
} from "@/lib/shared/constants";
import { ddRepositorioVista, type DdRepositorioFila } from "@/lib/shared/utils/dd-repositorio-vista";
import type {
  DdDocumentoDTO,
  DdExpedienteDTO,
  DdMatrizAdjuntoDTO,
  DdMatrizEvaluacionDetalleDTO,
} from "@/types/dto/debida-diligencia";

const AHORA = new Date("2026-11-21T12:00:00Z").getTime();
const dias = (n: number) => new Date(AHORA - n * 24 * 3_600_000).toISOString();

function documento(parcial: Partial<DdDocumentoDTO>): DdDocumentoDTO {
  return {
    id: "d1",
    tipo: DD_DOCUMENTOS.FICHA_RUC,
    nombre: "ficha.pdf",
    url: "/uploads/ficha.pdf",
    estado: DD_DOCUMENTO_ESTADOS.CARGADO,
    observacion: null,
    updatedAt: dias(1),
    versiones: [],
    ...parcial,
  };
}

function adjunto(parcial: Partial<DdMatrizAdjuntoDTO>): DdMatrizAdjuntoDTO {
  return {
    id: "a1",
    categoria: `${DD_MATRIZ_CRITERIO_PREFIJO}ofac`,
    nombre: "ofac.png",
    url: "/uploads/ofac.png",
    mimeType: "image/png",
    tamano: 10,
    creadoPor: "sig@iimp.org.pe",
    createdAt: dias(2),
    ...parcial,
  };
}

function detalle(parcial: Partial<DdMatrizEvaluacionDetalleDTO>): DdMatrizEvaluacionDetalleDTO {
  return {
    id: "v1",
    tipo: "empresa",
    nombre: "ACME S.A.C.",
    listas: [],
    adjuntos: [],
    ...parcial,
  } as unknown as DdMatrizEvaluacionDetalleDTO;
}

function escenario(): DdRepositorioFila[] {
  const empresa = detalle({
    id: "v-empresa",
    listas: [
      { codigo: "ofac", label: "OFAC", color: "extranjero", valor: "no", observacion: null },
      { codigo: "dea", label: "DEA", color: "extranjero", valor: null, observacion: null },
      { codigo: "otros", label: "Otros", color: "comun", valor: null, observacion: null },
    ],
    adjuntos: [
      adjunto({ id: "a-ofac", categoria: `${DD_MATRIZ_CRITERIO_PREFIJO}ofac`, createdAt: dias(2) }),
      adjunto({
        id: "a-inf",
        categoria: DD_MATRIZ_ADJUNTO_CATEGORIAS.SIG_INFORME,
        nombre: "Informe SIG.pdf",
        url: "/uploads/inf.pdf",
        mimeType: "application/pdf",
        createdAt: dias(40),
      }),
    ],
  });
  const representante = detalle({
    id: "v-rep",
    tipo: "representante",
    nombre: "JUAN PEREZ",
    adjuntos: [
      adjunto({
        id: "a-rep",
        categoria: DD_MATRIZ_ADJUNTO_CATEGORIAS.COMPLIANCE_SUSTENTO,
        nombre: "poder.docx",
        url: "/uploads/poder.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        createdAt: dias(100),
      }),
    ],
  });
  const expediente = {
    documentos: [
      documento({ id: "d-ruc", tipo: DD_DOCUMENTOS.FICHA_RUC, nombre: "Ficha RUC.pdf", updatedAt: dias(0) }),
      documento({
        id: "d-pod",
        tipo: DD_DOCUMENTOS.PODERES,
        nombre: "poderes.jpg",
        url: "/uploads/poderes.jpg",
        estado: DD_DOCUMENTO_ESTADOS.OBSERVADO,
        updatedAt: dias(10),
      }),
    ],
  } as unknown as DdExpedienteDTO;
  return ddRepositorioVista.construirFilas(expediente, [empresa, representante]);
}

const vacios = ddRepositorioVista.filtrosVacios;

describe("ddRepositorioVista.formatoArchivo", () => {
  it("detecta el formato por extension o MIME", () => {
    expect(ddRepositorioVista.formatoArchivo("a.PDF")).toBe(DD_REPOSITORIO_FORMATOS.PDF);
    expect(ddRepositorioVista.formatoArchivo("a", "application/pdf")).toBe(DD_REPOSITORIO_FORMATOS.PDF);
    expect(ddRepositorioVista.formatoArchivo("a.jpeg")).toBe(DD_REPOSITORIO_FORMATOS.IMAGEN);
    expect(ddRepositorioVista.formatoArchivo("a", "image/png")).toBe(DD_REPOSITORIO_FORMATOS.IMAGEN);
    expect(ddRepositorioVista.formatoArchivo("a.docx")).toBe(DD_REPOSITORIO_FORMATOS.WORD);
    expect(ddRepositorioVista.formatoArchivo("a.zip")).toBe(DD_REPOSITORIO_FORMATOS.OTRO);
  });
});

describe("ddRepositorioVista.construirFilas", () => {
  it("separa documentos base (sin vinculo) de evidencias (con vinculo y area)", () => {
    const filas = escenario();
    expect(filas).toHaveLength(5);
    const base = filas.filter((fila) => fila.tipo === DD_REPOSITORIO_TIPOS.DOCUMENTO);
    expect(base).toHaveLength(2);
    expect(base.every((fila) => fila.vinculoId === DD_REPOSITORIO_VINCULO_EXPEDIENTE)).toBe(true);
    const ofac = filas.find((fila) => fila.id === "adj-a-ofac");
    expect(ofac).toMatchObject({ area: DD_REPOSITORIO_AREAS.SIG, claseLabel: "Registra antecedentes en OFAC", vinculoNombre: "ACME S.A.C." });
    expect(filas.find((fila) => fila.id === "adj-a-rep")?.area).toBe(DD_REPOSITORIO_AREAS.LEGAL);
    expect(filas.find((fila) => fila.id === "adj-a-inf")?.claseLabel).toBe("Informe de SIG");
  });
});

describe("ddRepositorioVista.aplicarFiltros", () => {
  const filas = escenario();
  const ids = (resultado: DdRepositorioFila[]) => resultado.map((fila) => fila.id).sort();

  it("sin filtros devuelve todo", () => {
    expect(ddRepositorioVista.aplicarFiltros(filas, vacios(), AHORA)).toHaveLength(5);
  });

  it("filtra por tipo (documentos base / evidencias)", () => {
    const documentos = ddRepositorioVista.aplicarFiltros(filas, { ...vacios(), tipo: DD_REPOSITORIO_TABS.DOCUMENTOS }, AHORA);
    expect(documentos).toHaveLength(2);
    const evidencias = ddRepositorioVista.aplicarFiltros(filas, { ...vacios(), tipo: DD_REPOSITORIO_TABS.EVIDENCIAS }, AHORA);
    expect(evidencias).toHaveLength(3);
  });

  it("combina facetas con AND entre facetas y OR dentro de una faceta", () => {
    const porArea = ddRepositorioVista.aplicarFiltros(
      filas,
      { ...vacios(), areas: [DD_REPOSITORIO_AREAS.SIG, DD_REPOSITORIO_AREAS.LEGAL] },
      AHORA,
    );
    expect(ids(porArea)).toEqual(["adj-a-inf", "adj-a-ofac", "adj-a-rep"]);
    const conFormato = ddRepositorioVista.aplicarFiltros(
      filas,
      { ...vacios(), areas: [DD_REPOSITORIO_AREAS.SIG, DD_REPOSITORIO_AREAS.LEGAL], formatos: [DD_REPOSITORIO_FORMATOS.PDF] },
      AHORA,
    );
    expect(ids(conFormato)).toEqual(["adj-a-inf"]);
  });

  it("filtra por vinculo, tipo de documento/criterio y estado", () => {
    expect(ids(ddRepositorioVista.aplicarFiltros(filas, { ...vacios(), vinculos: ["v-rep"] }, AHORA))).toEqual(["adj-a-rep"]);
    expect(
      ids(ddRepositorioVista.aplicarFiltros(filas, { ...vacios(), clases: [`${DD_MATRIZ_CRITERIO_PREFIJO}ofac`] }, AHORA)),
    ).toEqual(["adj-a-ofac"]);
    expect(
      ids(ddRepositorioVista.aplicarFiltros(filas, { ...vacios(), estados: [DD_DOCUMENTO_ESTADOS.OBSERVADO] }, AHORA)),
    ).toEqual(["doc-d-pod"]);
  });

  it("filtra por periodo de carga", () => {
    const sieteDias = ddRepositorioVista.aplicarFiltros(filas, { ...vacios(), periodo: DD_REPOSITORIO_PERIODOS.SIETE_DIAS }, AHORA);
    expect(ids(sieteDias)).toEqual(["adj-a-ofac", "doc-d-ruc"]);
    const noventa = ddRepositorioVista.aplicarFiltros(filas, { ...vacios(), periodo: DD_REPOSITORIO_PERIODOS.NOVENTA_DIAS }, AHORA);
    expect(ids(noventa)).not.toContain("adj-a-rep");
  });

  it("busca sin distinguir mayusculas ni acentos en nombre, vinculo y tipo", () => {
    expect(ids(ddRepositorioVista.aplicarFiltros(filas, { ...vacios(), busqueda: "juan pérez" }, AHORA))).toEqual(["adj-a-rep"]);
    expect(ids(ddRepositorioVista.aplicarFiltros(filas, { ...vacios(), busqueda: "INFORME" }, AHORA))).toEqual(["adj-a-inf"]);
    expect(ddRepositorioVista.aplicarFiltros(filas, { ...vacios(), busqueda: "zzz" }, AHORA)).toHaveLength(0);
  });
});

describe("ddRepositorioVista.opcionesFaceta", () => {
  const filas = escenario();
  const etiquetaArea = (fila: DdRepositorioFila) => fila.area;

  it("cuenta cada opcion ignorando la seleccion de su propia faceta", () => {
    const filtros = { ...vacios(), areas: [DD_REPOSITORIO_AREAS.SIG], formatos: [DD_REPOSITORIO_FORMATOS.PDF] };
    const areas = ddRepositorioVista.opcionesFaceta(filas, filtros, "areas", AHORA, etiquetaArea);
    /* Con formato PDF: Documento base (ficha RUC) y SIG (informe); Legal es DOCX y no suma. */
    expect(Object.fromEntries(areas.map((opcion) => [opcion.value, opcion.total]))).toEqual({
      [DD_REPOSITORIO_AREAS.DOCUMENTO_BASE]: 1,
      [DD_REPOSITORIO_AREAS.SIG]: 1,
    });
  });

  it("mantiene visible una opcion elegida aunque otro filtro la deje en cero", () => {
    const filtros = { ...vacios(), areas: [DD_REPOSITORIO_AREAS.LEGAL], formatos: [DD_REPOSITORIO_FORMATOS.PDF] };
    const formatos = ddRepositorioVista.opcionesFaceta(filas, filtros, "formatos", AHORA, (fila) => fila.formato);
    expect(formatos.find((opcion) => opcion.value === DD_REPOSITORIO_FORMATOS.PDF)?.total).toBe(0);
  });
});

describe("ddRepositorioVista.ordenar y agrupar", () => {
  const filas = escenario();
  const vinculos = [
    { id: "v-empresa", nombre: "ACME S.A.C.", tipo: "empresa" },
    { id: "v-rep", nombre: "JUAN PEREZ", tipo: "representante" },
    { id: "v-sin", nombre: "SOCIO SIN ARCHIVOS", tipo: "beneficiario" },
  ];

  it("ordena por fecha o por nombre", () => {
    expect(ddRepositorioVista.ordenar(filas, DD_REPOSITORIO_ORDENES.RECIENTES)[0]?.id).toBe("doc-d-ruc");
    expect(ddRepositorioVista.ordenar(filas, DD_REPOSITORIO_ORDENES.ANTIGUOS)[0]?.id).toBe("adj-a-rep");
    expect(ddRepositorioVista.ordenar(filas, DD_REPOSITORIO_ORDENES.NOMBRE)[0]?.nombre).toBe("Ficha RUC.pdf");
  });

  it("agrupa por vinculo mostrando los vinculos sin archivos cuando no hay filtros", () => {
    const grupos = ddRepositorioVista.agrupar(filas, DD_REPOSITORIO_AGRUPACIONES.VINCULO, {
      vinculos,
      incluirVinculosVacios: true,
    });
    expect(grupos.map((grupo) => grupo.clave)).toEqual([DD_REPOSITORIO_VINCULO_EXPEDIENTE, "v-empresa", "v-rep", "v-sin"]);
    expect(grupos[3]?.filas).toHaveLength(0);
  });

  it("oculta los vinculos vacios cuando hay filtros activos", () => {
    const grupos = ddRepositorioVista.agrupar([filas[0] as DdRepositorioFila], DD_REPOSITORIO_AGRUPACIONES.VINCULO, {
      vinculos,
      incluirVinculosVacios: false,
    });
    expect(grupos).toHaveLength(1);
  });

  it("agrupa por tipo de documento, por area y sin agrupar", () => {
    const opciones = { vinculos, incluirVinculosVacios: false };
    expect(ddRepositorioVista.agrupar(filas, DD_REPOSITORIO_AGRUPACIONES.CLASE, opciones)).toHaveLength(5);
    const porArea = ddRepositorioVista.agrupar(filas, DD_REPOSITORIO_AGRUPACIONES.AREA, opciones);
    expect(porArea.find((grupo) => grupo.clave === DD_REPOSITORIO_AREAS.SIG)?.filas).toHaveLength(2);
    expect(ddRepositorioVista.agrupar(filas, DD_REPOSITORIO_AGRUPACIONES.NINGUNA, opciones)).toHaveLength(1);
  });
});

describe("ddRepositorioVista - ayudas visuales", () => {
  it("marca como nuevo lo cargado en las ultimas 48 horas", () => {
    expect(ddRepositorioVista.esNuevo(dias(1), AHORA)).toBe(true);
    expect(ddRepositorioVista.esNuevo(dias(3), AHORA)).toBe(false);
  });

  it("expresa la antiguedad en texto corto", () => {
    expect(ddRepositorioVista.fechaRelativa(dias(0), AHORA)).toBe("hoy");
    expect(ddRepositorioVista.fechaRelativa(dias(1), AHORA)).toBe("ayer");
    expect(ddRepositorioVista.fechaRelativa(dias(5), AHORA)).toBe("hace 5 días");
    expect(ddRepositorioVista.fechaRelativa(dias(65), AHORA)).toBe("hace 2 meses");
    expect(ddRepositorioVista.fechaRelativa(dias(400), AHORA)).toBe("hace 1 año");
  });

  it("calcula la cobertura de evidencias por criterio sin contar Otros", () => {
    const empresa = detalle({
      listas: [
        { codigo: "ofac", label: "OFAC", color: "extranjero", valor: "no", observacion: null },
        { codigo: "dea", label: "DEA", color: "extranjero", valor: null, observacion: null },
        { codigo: "otros", label: "Otros", color: "comun", valor: null, observacion: null },
      ],
      adjuntos: [adjunto({ categoria: `${DD_MATRIZ_CRITERIO_PREFIJO}ofac` })],
    });
    expect(ddRepositorioVista.coberturaVinculo(empresa)).toEqual({ aplicables: 2, conEvidencia: 1, faltantes: ["DEA"] });
  });

  it("calcula la cobertura de documentos base requeridos", () => {
    const expediente = {
      documentos: [documento({ tipo: DD_DOCUMENTOS.FICHA_RUC }), documento({ id: "p", tipo: DD_DOCUMENTOS.PODERES, estado: DD_DOCUMENTO_ESTADOS.PENDIENTE })],
    } as unknown as DdExpedienteDTO;
    const cobertura = ddRepositorioVista.coberturaDocumentosBase(expediente);
    expect(cobertura.requeridos).toBe(DD_DOCUMENTOS_REQUERIDOS.length);
    expect(cobertura.cargados).toBe(1);
    expect(cobertura.faltantes).toHaveLength(DD_DOCUMENTOS_REQUERIDOS.length - 1);
    expect(ddRepositorioVista.coberturaDocumentosBase(null).cargados).toBe(0);
  });

  it("cuenta los filtros activos", () => {
    expect(ddRepositorioVista.contarFiltrosActivos(vacios())).toBe(0);
    expect(
      ddRepositorioVista.contarFiltrosActivos({
        ...vacios(),
        busqueda: "x",
        areas: ["SIG"],
        periodo: DD_REPOSITORIO_PERIODOS.SIETE_DIAS,
        tipo: DD_REPOSITORIO_TABS.EVIDENCIAS,
      }),
    ).toBe(4);
  });
});
