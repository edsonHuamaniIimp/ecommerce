import {
  DD_DOCUMENTO_ESTADO_LABELS,
  DD_DOCUMENTO_ESTADOS,
  DD_DOCUMENTOS_REQUERIDOS,
  DD_MATRIZ_ADJUNTO_CATEGORIA_LABELS,
  DD_MATRIZ_ADJUNTO_CATEGORIAS,
  DD_MATRIZ_CRITERIO_PREFIJO,
  DD_MATRIZ_LISTA_OTROS,
  DD_MATRIZ_LISTAS,
  DD_MATRIZ_TIPO_VINCULO_LABELS,
  DD_MATRIZ_TIPOS_VINCULO,
  DD_REPOSITORIO_AGRUPACIONES,
  DD_REPOSITORIO_AREAS,
  DD_REPOSITORIO_FORMATOS,
  DD_REPOSITORIO_FUENTES,
  DD_REPOSITORIO_NUEVO_HORAS,
  DD_REPOSITORIO_ORDENES,
  DD_REPOSITORIO_PERIODO_OPCIONES,
  DD_REPOSITORIO_PERIODOS,
  DD_REPOSITORIO_RESPONSABLE_EXPEDIENTE,
  DD_REPOSITORIO_TABS,
  DD_REPOSITORIO_TIPOS,
  DD_REPOSITORIO_VINCULO_EXPEDIENTE,
  DD_REPOSITORIO_VINCULO_EXPEDIENTE_LABEL,
  type DdRepositorioAgrupacion,
  type DdRepositorioArea,
  type DdRepositorioFormato,
  type DdRepositorioOrden,
  type DdRepositorioPeriodo,
  type DdRepositorioTab,
  type DdRepositorioTipo,
} from "@/lib/shared/constants";
import type {
  DdDocumentoDTO,
  DdExpedienteDTO,
  DdMatrizAdjuntoDTO,
  DdMatrizEvaluacionDetalleDTO,
} from "@/types/dto/debida-diligencia";
import { archivoUtils } from "./archivo";
import { dateUtils } from "./date";

const MS_HORA = 3_600_000;
const MS_DIA = 24 * MS_HORA;

/** Un archivo del Centro documental: documento base del expediente o evidencia de la matriz. */
export interface DdRepositorioFila {
  id: string;
  tipo: DdRepositorioTipo;
  nombre: string;
  url: string;
  mimeType: string | null;
  formato: DdRepositorioFormato;
  /** Clave del vinculo (`DD_REPOSITORIO_VINCULO_EXPEDIENTE` para documentos base). */
  vinculoId: string;
  vinculoNombre: string;
  vinculoTipo: string;
  area: DdRepositorioArea;
  /** Codigo del tipo de documento o criterio (para filtrar y agrupar). */
  clase: string;
  claseLabel: string;
  fuente: string;
  fecha: string;
  responsable: string;
  estado: string;
}

export type DdRepositorioFaceta = "areas" | "formatos" | "vinculos" | "clases" | "estados";

export interface DdRepositorioFiltros {
  busqueda: string;
  tipo: DdRepositorioTab;
  areas: string[];
  formatos: string[];
  vinculos: string[];
  clases: string[];
  estados: string[];
  periodo: DdRepositorioPeriodo;
}

export interface DdRepositorioGrupo {
  clave: string;
  titulo: string;
  subtitulo: string | null;
  filas: DdRepositorioFila[];
}

export interface DdRepositorioOpcion {
  value: string;
  label: string;
  total: number;
}

export interface DdRepositorioCobertura {
  aplicables: number;
  conEvidencia: number;
  faltantes: string[];
}

const AREA_POR_CATEGORIA: Record<string, DdRepositorioArea> = {
  [DD_MATRIZ_ADJUNTO_CATEGORIAS.SIG_INFORME]: DD_REPOSITORIO_AREAS.SIG,
  [DD_MATRIZ_ADJUNTO_CATEGORIAS.SIG_SUSTENTO]: DD_REPOSITORIO_AREAS.SIG,
  [DD_MATRIZ_ADJUNTO_CATEGORIAS.REPUTACIONAL_SUSTENTO]: DD_REPOSITORIO_AREAS.REPUTACIONAL,
  [DD_MATRIZ_ADJUNTO_CATEGORIAS.COMPLIANCE_SUSTENTO]: DD_REPOSITORIO_AREAS.LEGAL,
};

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export const ddRepositorioVista = {
  /** Formato visible de un archivo segun su nombre/URL o su tipo MIME. */
  formatoArchivo(nombre: string, mimeType?: string | null): DdRepositorioFormato {
    const mime = (mimeType ?? "").toLowerCase();
    const extension = archivoUtils.extensionDeArchivo(nombre);
    if (archivoUtils.esPdf(nombre) || mime.includes("pdf") || extension === "pdf") return DD_REPOSITORIO_FORMATOS.PDF;
    if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp"].includes(extension)) {
      return DD_REPOSITORIO_FORMATOS.IMAGEN;
    }
    if (mime.includes("word") || ["doc", "docx"].includes(extension)) return DD_REPOSITORIO_FORMATOS.WORD;
    return DD_REPOSITORIO_FORMATOS.OTRO;
  },

  filtrosVacios(): DdRepositorioFiltros {
    return {
      busqueda: "",
      tipo: DD_REPOSITORIO_TABS.TODOS,
      areas: [],
      formatos: [],
      vinculos: [],
      clases: [],
      estados: [],
      periodo: DD_REPOSITORIO_PERIODOS.TODO,
    };
  },

  /** Cantidad de filtros distintos aplicados (el buscador cuenta como uno). */
  contarFiltrosActivos(filtros: DdRepositorioFiltros): number {
    return (
      (filtros.busqueda.trim() ? 1 : 0) +
      (filtros.tipo !== DD_REPOSITORIO_TABS.TODOS ? 1 : 0) +
      (filtros.areas.length > 0 ? 1 : 0) +
      (filtros.formatos.length > 0 ? 1 : 0) +
      (filtros.vinculos.length > 0 ? 1 : 0) +
      (filtros.clases.length > 0 ? 1 : 0) +
      (filtros.estados.length > 0 ? 1 : 0) +
      (filtros.periodo !== DD_REPOSITORIO_PERIODOS.TODO ? 1 : 0)
    );
  },

  filaDocumento(documento: DdDocumentoDTO): DdRepositorioFila {
    const titulo = DD_DOCUMENTOS_REQUERIDOS.find((item) => item.tipo === documento.tipo)?.titulo ?? documento.tipo;
    return {
      id: `doc-${documento.id}`,
      tipo: DD_REPOSITORIO_TIPOS.DOCUMENTO,
      nombre: documento.nombre,
      url: documento.url,
      mimeType: null,
      formato: ddRepositorioVista.formatoArchivo(documento.nombre || documento.url),
      vinculoId: DD_REPOSITORIO_VINCULO_EXPEDIENTE,
      vinculoNombre: DD_REPOSITORIO_VINCULO_EXPEDIENTE_LABEL,
      vinculoTipo: DD_MATRIZ_TIPOS_VINCULO.EMPRESA,
      area: DD_REPOSITORIO_AREAS.DOCUMENTO_BASE,
      clase: documento.tipo,
      claseLabel: titulo,
      fuente: DD_REPOSITORIO_FUENTES.PORTAL,
      fecha: documento.updatedAt,
      responsable: DD_REPOSITORIO_RESPONSABLE_EXPEDIENTE,
      estado: documento.estado,
    };
  },

  filaAdjunto(adjunto: DdMatrizAdjuntoDTO, detalle: DdMatrizEvaluacionDetalleDTO): DdRepositorioFila {
    const esCriterio = adjunto.categoria.startsWith(DD_MATRIZ_CRITERIO_PREFIJO);
    const codigo = esCriterio ? adjunto.categoria.slice(DD_MATRIZ_CRITERIO_PREFIJO.length) : "";
    const claseLabel = esCriterio
      ? (DD_MATRIZ_LISTAS.find((lista) => lista.codigo === codigo)?.label ?? codigo)
      : (DD_MATRIZ_ADJUNTO_CATEGORIA_LABELS[adjunto.categoria as keyof typeof DD_MATRIZ_ADJUNTO_CATEGORIA_LABELS] ??
        adjunto.categoria);
    return {
      id: `adj-${adjunto.id}`,
      tipo: DD_REPOSITORIO_TIPOS.EVIDENCIA,
      nombre: adjunto.nombre,
      url: adjunto.url,
      mimeType: adjunto.mimeType,
      formato: ddRepositorioVista.formatoArchivo(adjunto.nombre || adjunto.url, adjunto.mimeType),
      vinculoId: detalle.id,
      vinculoNombre: detalle.nombre,
      vinculoTipo: detalle.tipo,
      area: esCriterio
        ? DD_REPOSITORIO_AREAS.SIG
        : (AREA_POR_CATEGORIA[adjunto.categoria] ?? DD_REPOSITORIO_AREAS.MATRIZ),
      clase: adjunto.categoria,
      claseLabel,
      fuente: esCriterio ? DD_REPOSITORIO_FUENTES.EVIDENCIA : DD_REPOSITORIO_FUENTES.ADJUNTO,
      fecha: adjunto.createdAt,
      responsable: adjunto.creadoPor,
      estado: DD_DOCUMENTO_ESTADOS.CARGADO,
    };
  },

  construirFilas(
    expediente: DdExpedienteDTO | null,
    detalles: DdMatrizEvaluacionDetalleDTO[],
  ): DdRepositorioFila[] {
    const documentos = (expediente?.documentos ?? []).map((documento) => ddRepositorioVista.filaDocumento(documento));
    const evidencias = detalles.flatMap((detalle) =>
      detalle.adjuntos.map((adjunto) => ddRepositorioVista.filaAdjunto(adjunto, detalle)),
    );
    return [...documentos, ...evidencias];
  },

  valorFaceta(fila: DdRepositorioFila, faceta: DdRepositorioFaceta): string {
    switch (faceta) {
      case "areas":
        return fila.area;
      case "formatos":
        return fila.formato;
      case "vinculos":
        return fila.vinculoId;
      case "clases":
        return fila.clase;
      case "estados":
        return fila.estado;
    }
  },

  /** Aplica los filtros; `omitir` deja sin efecto una faceta (para contar sus opciones). */
  aplicarFiltros(
    filas: DdRepositorioFila[],
    filtros: DdRepositorioFiltros,
    ahora: number,
    omitir?: DdRepositorioFaceta,
  ): DdRepositorioFila[] {
    const termino = normalizar(filtros.busqueda);
    const dias = DD_REPOSITORIO_PERIODO_OPCIONES.find((opcion) => opcion.value === filtros.periodo)?.dias ?? null;
    const desde = dias === null ? null : ahora - dias * MS_DIA;
    const facetas: [DdRepositorioFaceta, string[]][] = [
      ["areas", filtros.areas],
      ["formatos", filtros.formatos],
      ["vinculos", filtros.vinculos],
      ["clases", filtros.clases],
      ["estados", filtros.estados],
    ];
    return filas.filter((fila) => {
      if (filtros.tipo === DD_REPOSITORIO_TABS.DOCUMENTOS && fila.tipo !== DD_REPOSITORIO_TIPOS.DOCUMENTO) return false;
      if (filtros.tipo === DD_REPOSITORIO_TABS.EVIDENCIAS && fila.tipo !== DD_REPOSITORIO_TIPOS.EVIDENCIA) return false;
      for (const [faceta, seleccion] of facetas) {
        if (faceta === omitir || seleccion.length === 0) continue;
        if (!seleccion.includes(ddRepositorioVista.valorFaceta(fila, faceta))) return false;
      }
      if (desde !== null) {
        const fecha = dateUtils.toMs(fila.fecha);
        if (fecha === null || fecha < desde) return false;
      }
      if (termino) {
        const texto = normalizar(
          [fila.nombre, fila.vinculoNombre, fila.claseLabel, fila.area, fila.fuente, fila.responsable].join(" "),
        );
        if (!texto.includes(termino)) return false;
      }
      return true;
    });
  },

  /** Opciones de una faceta con su conteo (ignora la seleccion de esa misma faceta). */
  opcionesFaceta(
    filas: DdRepositorioFila[],
    filtros: DdRepositorioFiltros,
    faceta: DdRepositorioFaceta,
    ahora: number,
    etiqueta: (fila: DdRepositorioFila) => string,
  ): DdRepositorioOpcion[] {
    const visibles = ddRepositorioVista.aplicarFiltros(filas, filtros, ahora, faceta);
    const mapa = new Map<string, DdRepositorioOpcion>();
    for (const fila of visibles) {
      const value = ddRepositorioVista.valorFaceta(fila, faceta);
      const actual = mapa.get(value);
      if (actual) actual.total += 1;
      else mapa.set(value, { value, label: etiqueta(fila), total: 1 });
    }
    /* Las opciones ya elegidas siguen visibles aunque otro filtro las deje en cero. */
    const seleccion = ddRepositorioVista.seleccionDe(filtros, faceta);
    for (const value of seleccion) {
      if (mapa.has(value)) continue;
      const fila = filas.find((item) => ddRepositorioVista.valorFaceta(item, faceta) === value);
      if (fila) mapa.set(value, { value, label: etiqueta(fila), total: 0 });
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "es"));
  },

  seleccionDe(filtros: DdRepositorioFiltros, faceta: DdRepositorioFaceta): string[] {
    return filtros[faceta];
  },

  ordenar(filas: DdRepositorioFila[], orden: DdRepositorioOrden): DdRepositorioFila[] {
    const copia = [...filas];
    if (orden === DD_REPOSITORIO_ORDENES.NOMBRE) {
      return copia.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    }
    const sentido = orden === DD_REPOSITORIO_ORDENES.ANTIGUOS ? 1 : -1;
    return copia.sort((a, b) => sentido * ((dateUtils.toMs(a.fecha) ?? 0) - (dateUtils.toMs(b.fecha) ?? 0)));
  },

  /**
   * Agrupa las filas ya filtradas y ordenadas. En la agrupacion por vinculo,
   * `vinculos` aporta los grupos vacios (para evidenciar lo que falta cargar).
   */
  agrupar(
    filas: DdRepositorioFila[],
    modo: DdRepositorioAgrupacion,
    opciones: { vinculos: { id: string; nombre: string; tipo: string }[]; incluirVinculosVacios: boolean },
  ): DdRepositorioGrupo[] {
    if (modo === DD_REPOSITORIO_AGRUPACIONES.NINGUNA) {
      return [{ clave: "todos", titulo: "Todos los archivos", subtitulo: null, filas }];
    }
    const grupos = new Map<string, DdRepositorioGrupo>();
    const agregar = (clave: string, titulo: string, subtitulo: string | null, fila: DdRepositorioFila | null) => {
      const grupo = grupos.get(clave) ?? { clave, titulo, subtitulo, filas: [] };
      if (fila) grupo.filas.push(fila);
      grupos.set(clave, grupo);
    };
    const tipoVinculo = (tipo: string) =>
      DD_MATRIZ_TIPO_VINCULO_LABELS[tipo as keyof typeof DD_MATRIZ_TIPO_VINCULO_LABELS] ?? tipo;

    if (modo === DD_REPOSITORIO_AGRUPACIONES.VINCULO) {
      if (opciones.incluirVinculosVacios) {
        agregar(DD_REPOSITORIO_VINCULO_EXPEDIENTE, DD_REPOSITORIO_VINCULO_EXPEDIENTE_LABEL, "Documentos que sube el cliente", null);
        for (const vinculo of opciones.vinculos) agregar(vinculo.id, vinculo.nombre, tipoVinculo(vinculo.tipo), null);
      }
      for (const fila of filas) {
        const subtitulo =
          fila.vinculoId === DD_REPOSITORIO_VINCULO_EXPEDIENTE
            ? "Documentos que sube el cliente"
            : tipoVinculo(fila.vinculoTipo);
        agregar(fila.vinculoId, fila.vinculoNombre, subtitulo, fila);
      }
      const orden = [DD_REPOSITORIO_VINCULO_EXPEDIENTE, ...opciones.vinculos.map((vinculo) => vinculo.id)];
      return [...grupos.values()].sort((a, b) => {
        const ia = orden.indexOf(a.clave);
        const ib = orden.indexOf(b.clave);
        return (ia < 0 ? orden.length : ia) - (ib < 0 ? orden.length : ib);
      });
    }

    for (const fila of filas) {
      if (modo === DD_REPOSITORIO_AGRUPACIONES.CLASE) agregar(fila.clase, fila.claseLabel, fila.area, fila);
      else agregar(fila.area, fila.area, null, fila);
    }
    return [...grupos.values()].sort((a, b) => a.titulo.localeCompare(b.titulo, "es"));
  },

  /** true si el archivo se cargo hace menos de `DD_REPOSITORIO_NUEVO_HORAS`. */
  esNuevo(fecha: string, ahora: number): boolean {
    const ms = dateUtils.toMs(fecha);
    return ms !== null && ahora - ms >= 0 && ahora - ms < DD_REPOSITORIO_NUEVO_HORAS * MS_HORA;
  },

  /** Texto corto de antiguedad ("hoy", "ayer", "hace 5 días", "hace 2 meses"). */
  fechaRelativa(fecha: string, ahora: number): string {
    const ms = dateUtils.toMs(fecha);
    if (ms === null) return "—";
    const dias = Math.floor((ahora - ms) / MS_DIA);
    if (dias <= 0) return "hoy";
    if (dias === 1) return "ayer";
    if (dias < 30) return `hace ${dias} días`;
    const meses = Math.floor(dias / 30);
    if (meses < 12) return `hace ${meses} ${meses === 1 ? "mes" : "meses"}`;
    const anios = Math.floor(meses / 12);
    return `hace ${anios} ${anios === 1 ? "año" : "años"}`;
  },

  /** Criterios del vinculo con evidencia cargada (el criterio opcional "Otros" no cuenta). */
  coberturaVinculo(detalle: DdMatrizEvaluacionDetalleDTO): DdRepositorioCobertura {
    const criterios = detalle.listas.filter((lista) => lista.codigo !== DD_MATRIZ_LISTA_OTROS);
    const conEvidencia = criterios.filter((lista) =>
      detalle.adjuntos.some((adjunto) => adjunto.categoria === `${DD_MATRIZ_CRITERIO_PREFIJO}${lista.codigo}`),
    );
    return {
      aplicables: criterios.length,
      conEvidencia: conEvidencia.length,
      faltantes: criterios
        .filter((lista) => !conEvidencia.some((item) => item.codigo === lista.codigo))
        .map((lista) => lista.label),
    };
  },

  /** Documentos base obligatorios ya cargados por el cliente. */
  coberturaDocumentosBase(expediente: DdExpedienteDTO | null): { requeridos: number; cargados: number; faltantes: string[] } {
    const documentos = expediente?.documentos ?? [];
    const faltantes = DD_DOCUMENTOS_REQUERIDOS.filter(
      (requerido) =>
        !documentos.some(
          (documento) => documento.tipo === requerido.tipo && documento.estado !== DD_DOCUMENTO_ESTADOS.PENDIENTE,
        ),
    ).map((requerido) => requerido.titulo);
    return {
      requeridos: DD_DOCUMENTOS_REQUERIDOS.length,
      cargados: DD_DOCUMENTOS_REQUERIDOS.length - faltantes.length,
      faltantes,
    };
  },

  etiquetaEstado(estado: string): string {
    return DD_DOCUMENTO_ESTADO_LABELS[estado] ?? estado;
  },
};
