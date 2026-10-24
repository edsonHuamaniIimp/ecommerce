import {
  DD_ACTIVIDADES_ECONOMICAS,
  DD_ACTIVIDAD_OTRO,
  DD_DIAS_POR_VENCER,
  DD_DOCUMENTO_ESTADOS,
  DD_DOCUMENTOS,
  DD_DOCUMENTOS_REQUERIDOS,
  DD_ESTADOS,
  DD_ESTADOS_EVALUACION,
  DD_MENSAJES,
  DD_ORIGENES,
  DD_RESULTADOS,
  DD_PORCENTAJE_MAX,
  DD_PORCENTAJE_PARTICIPACION_MIN,
  REGEX_EMAIL,
  REGEX_NACIONALIDAD,
  DD_ESTADO_SIN_INICIAR_LABEL,
  DD_REPUTACION_ESTADO_LABELS,
  DD_REPUTACION_ESTADOS,
  DD_REPUTACION_TIPOS,
  DD_REPUTACION_RESULTADO_A_ESTADO,
  DD_VIGENCIA_MESES,
  DD_VINCULO_LABELS,
  type DdDocumentoTipo,
  type DdEstado,
  type DdEstadoEvaluacion,
  type DdReputacionEstado,
  type DdReputacionResultado,
  type DdReputacionTipo,
  type DdResultado,
} from "@/lib/shared/constants";
import { dateUtils } from "./date";

/** Resultado de vigencia calculado (no es un estado persistido). */
export const DD_VIGENCIAS = {
  VIGENTE: "vigente",
  POR_VENCER: "por_vencer",
  VENCIDA: "vencida",
  SIN_VIGENCIA: "sin_vigencia",
} as const;

export type DdVigencia = (typeof DD_VIGENCIAS)[keyof typeof DD_VIGENCIAS];

/** Estados en los que el cliente puede editar y reenviar el formulario. */
const ESTADOS_EDITABLES: DdEstado[] = [
  DD_ESTADOS.BORRADOR,
  DD_ESTADOS.PENDIENTE,
  DD_ESTADOS.OBSERVADA,
];

/** Utilidades puras del modulo Debida Diligencia (frontend y backend). */
export const ddUtils = {
  /** Etiquetas legibles de los vinculos comerciales seleccionados. */
  etiquetaVinculos(vinculos: string[] | null | undefined): string {
    return (vinculos ?? [])
      .map((vinculo) => DD_VINCULO_LABELS[vinculo] ?? vinculo)
      .join(", ");
  },

  /** true si el expediente admite edicion del cliente. */
  puedeEditar(estado: string | null | undefined): boolean {
    return !estado || ESTADOS_EDITABLES.includes(estado as DdEstado);
  },

  /** Validacion del paso 1: consentimientos obligatorios. */
  validarConsentimientos(datos: { aceptaDatos: boolean; aceptaVerificacion: boolean }): string | null {
    if (!datos.aceptaDatos) return DD_MENSAJES.CONSENT_DATOS;
    if (!datos.aceptaVerificacion) return DD_MENSAJES.CONSENT_VERIFICACION;
    return null;
  },

  /** Validacion del paso 2: datos de la empresa. */
  validarEmpresa(datos: {
    tipoRelacionComercial: string[];
    actividadEconomica: string;
    actividadEconomicaOtro: string;
    paisConstitucion: string;
    sitioWeb: string;
    emailRepresentante: string;
  }): string | null {
    if (datos.tipoRelacionComercial.length === 0) return "Seleccione al menos un tipo de relación comercial con el IIMP.";
    if (!datos.actividadEconomica) return "Seleccione la actividad económica principal.";
    if (!DD_ACTIVIDADES_ECONOMICAS.includes(datos.actividadEconomica as never)) {
      return "Seleccione una actividad económica válida del catálogo.";
    }
    if (datos.actividadEconomica === DD_ACTIVIDAD_OTRO && !datos.actividadEconomicaOtro.trim()) {
      return DD_MENSAJES.ACTIVIDAD_OTRO;
    }
    if (!datos.paisConstitucion.trim()) return "Ingrese el país de constitución.";
    if (!datos.sitioWeb.trim()) return "Ingrese el sitio web de la empresa.";
    if (!REGEX_EMAIL.test(datos.emailRepresentante.trim())) {
      return "Ingrese un correo válido para el representante legal.";
    }
    return null;
  },

  /** Validacion del paso 3: representante y beneficiarios. */
  validarRepresentante(datos: {
    representanteNombre: string;
    representanteDocumento: string;
    representanteNacionalidad: string;
    beneficiarios: { nombre: string; documento: string; nacionalidad: string; porcentaje: string }[];
  }): string | null {
    if (!datos.representanteNombre.trim()) return "Ingrese el nombre del representante legal.";
    if (!datos.representanteDocumento.trim()) return "Ingrese el documento del representante legal.";
    if (!datos.representanteNacionalidad.trim()) return "Ingrese la nacionalidad del representante legal.";
    if (!REGEX_NACIONALIDAD.test(datos.representanteNacionalidad.trim())) {
      return "Ingrese una nacionalidad válida para el representante legal.";
    }
    for (const [indice, beneficiario] of datos.beneficiarios.entries()) {
      if (
        !beneficiario.nombre.trim() ||
        !beneficiario.documento.trim() ||
        !beneficiario.nacionalidad.trim() ||
        !beneficiario.porcentaje.trim()
      ) {
        return `Complete los datos del beneficiario ${indice + 1}.`;
      }
      if (!REGEX_NACIONALIDAD.test(beneficiario.nacionalidad.trim())) {
        return `Ingrese una nacionalidad válida para el beneficiario ${indice + 1}.`;
      }
      const porcentaje = Number(beneficiario.porcentaje);
      if (
        Number.isNaN(porcentaje) ||
        porcentaje < DD_PORCENTAJE_PARTICIPACION_MIN ||
        porcentaje > DD_PORCENTAJE_MAX
      ) {
        return `El porcentaje del beneficiario ${indice + 1} debe estar entre ${DD_PORCENTAJE_PARTICIPACION_MIN}% y ${DD_PORCENTAJE_MAX}%.`;
      }
    }
    return null;
  },

  /** Validacion del paso 4: documentos obligatorios y declaracion jurada. */
  validarDocumentos(datos: {
    documentos: { tipo: string; url: string; estado?: string }[];
    declaraVerdad: boolean;
    requiereDeclaracionVigencia?: boolean;
  }): string | null {
    const faltantes = ddUtils.documentosFaltantes(datos.documentos);
    if (faltantes.includes(DD_DOCUMENTOS.DECLARACION_JURADA)) {
      return DD_MENSAJES.DECLARACION_JURADA_OBLIGATORIA;
    }
    if (faltantes.length > 0) {
      return DD_MENSAJES.DOCUMENTOS_OBLIGATORIOS;
    }
    if (
      datos.requiereDeclaracionVigencia &&
      !datos.documentos.some(
        (documento) => documento.tipo === DD_DOCUMENTOS.DECLARACION_VIGENCIA,
      )
    ) {
      return DD_MENSAJES.DECLARACION_VIGENCIA_OBLIGATORIA;
    }
    if (datos.documentos.some((documento) => documento.estado === DD_DOCUMENTO_ESTADOS.OBSERVADO)) {
      return "Sube una nueva versión de los documentos observados antes de enviar.";
    }
    if (!datos.declaraVerdad) {
      return DD_MENSAJES.DECLARACION_VERACIDAD;
    }
    return null;
  },

  /** Suma la vigencia (por defecto 6 meses) a una fecha. */
  sumarMeses(fecha: Date, meses: number = DD_VIGENCIA_MESES): Date {
    return dateUtils.addMonths(fecha, meses);
  },

  /**
   * Fecha de cese efectiva de una DD aprobada. La vigencia siempre cuenta
   * desde la aprobacion; si no hay fecha guardada se deriva de `fechaAprobacion`.
   */
  fechaVencimientoEfectiva(
    estado: string,
    fechaVencimiento: Date | string | null | undefined,
    fechaAprobacion: Date | string | null | undefined,
  ): Date | null {
    if (estado !== DD_ESTADOS.APROBADA) return null;
    if (fechaVencimiento && dateUtils.isValid(fechaVencimiento)) {
      return new Date(fechaVencimiento);
    }
    if (fechaAprobacion && dateUtils.isValid(fechaAprobacion)) {
      return ddUtils.sumarMeses(new Date(fechaAprobacion));
    }
    return null;
  },

  /** Vigencia de una DD aprobada: vigente, por vencer (30 dias) o vencida. */
  estadoVigencia(
    estado: string,
    fechaVencimiento: Date | string | null | undefined,
    ahora: Date = dateUtils.now(),
    fechaAprobacion?: Date | string | null,
  ): DdVigencia {
    if (estado !== DD_ESTADOS.APROBADA) return DD_VIGENCIAS.SIN_VIGENCIA;
    const vence = ddUtils.fechaVencimientoEfectiva(estado, fechaVencimiento, fechaAprobacion);
    if (!vence) return DD_VIGENCIAS.VENCIDA;
    if (!dateUtils.isBefore(ahora, vence)) return DD_VIGENCIAS.VENCIDA;
    const dias = dateUtils.diffInDays(ahora, vence) ?? 0;
    return dias <= DD_DIAS_POR_VENCER ? DD_VIGENCIAS.POR_VENCER : DD_VIGENCIAS.VIGENTE;
  },

  /** Resultado institucional de la evaluacion. */
  resultadoEvaluacion(estado: string, observacionesAbiertas = 0): DdResultado {
    if (estado === DD_ESTADOS.APROBADA) {
      return observacionesAbiertas > 0
        ? DD_RESULTADOS.APTO_CON_OBSERVACIONES
        : DD_RESULTADOS.APTO;
    }
    if (estado === DD_ESTADOS.RECHAZADA) return DD_RESULTADOS.NO_APTO;
    return DD_RESULTADOS.PENDIENTE;
  },

  /** Vigencia institucional de una evaluacion concluida. */
  estadoEvaluacion(
    estado: string,
    fechaVencimiento: Date | string | null | undefined,
    ahora: Date = dateUtils.now(),
    fechaAprobacion?: Date | string | null,
  ): DdEstadoEvaluacion | null {
    if (estado === DD_ESTADOS.APROBADA) {
      return ddUtils.estadoVigencia(estado, fechaVencimiento, ahora, fechaAprobacion) ===
        DD_VIGENCIAS.VENCIDA
        ? DD_ESTADOS_EVALUACION.REQUIERE_NUEVA_EVALUACION
        : DD_ESTADOS_EVALUACION.VIGENTE;
    }
    if (estado === DD_ESTADOS.OBSERVADA || estado === DD_ESTADOS.RECHAZADA) {
      return DD_ESTADOS_EVALUACION.REQUIERE_NUEVA_EVALUACION;
    }
    return null;
  },

  /** Vigencia de una evaluacion externa (APTO / APTO CON OBSERVACIONES). */
  estadoEvaluacionExterna(
    resultado: DdResultado,
    fechaVencimiento: Date | string | null | undefined,
    ahora: Date = dateUtils.now(),
  ): DdEstadoEvaluacion | null {
    if (
      resultado !== DD_RESULTADOS.APTO &&
      resultado !== DD_RESULTADOS.APTO_CON_OBSERVACIONES
    ) {
      return null;
    }
    if (!fechaVencimiento || !dateUtils.isValid(fechaVencimiento)) {
      return DD_ESTADOS_EVALUACION.REQUIERE_NUEVA_EVALUACION;
    }
    return dateUtils.isBefore(ahora, fechaVencimiento)
      ? DD_ESTADOS_EVALUACION.VIGENTE
      : DD_ESTADOS_EVALUACION.REQUIERE_NUEVA_EVALUACION;
  },

  /** Dias restantes de vigencia (0 si ya vencio; null si no esta aprobada). */
  diasVigenciaRestantes(
    estado: string,
    fechaVencimiento: Date | string | null | undefined,
    ahora: Date = dateUtils.now(),
    fechaAprobacion?: Date | string | null,
  ): number | null {
    if (estado !== DD_ESTADOS.APROBADA) return null;
    const vence = ddUtils.fechaVencimientoEfectiva(estado, fechaVencimiento, fechaAprobacion);
    if (!vence) return 0;
    return Math.max(0, dateUtils.diffInDays(ahora, vence) ?? 0);
  },

  /** Alcance habilitado segun el resultado. */
  alcanceResultado(resultado: DdResultado): string | null {
    if (resultado === DD_RESULTADOS.APTO) return "general";
    if (resultado === DD_RESULTADOS.APTO_CON_OBSERVACIONES) return "vinculo_especifico";
    return null;
  },

  /** Estado del documento de declaracion de vigencia (null si aun no existe). */
  estadoDeclaracionVigencia(
    documentos: { tipo: string; estado: string }[] | null | undefined,
  ): string | null {
    return (
      documentos?.find((documento) => documento.tipo === DD_DOCUMENTOS.DECLARACION_VIGENCIA)
        ?.estado ?? null
    );
  },

  /** La DD aprobada/vigente requiere validar su declaracion de vigencia. */
  requiereRevalidacionDeclaracion(
    expediente: {
      eventoId: string;
      estado: string;
      origen: string;
      fechaAprobacion: Date | string | null;
      fechaVencimiento: Date | string | null;
      documentos: { tipo: string; estado: string }[];
    },
    eventoActivoId?: string,
    ahora: Date = dateUtils.now(),
  ): boolean {
    if (!eventoActivoId || expediente.eventoId === eventoActivoId) return false;
    if (expediente.origen !== DD_ORIGENES.IMPORTADO) return false;
    if (expediente.estado !== DD_ESTADOS.APROBADA) return false;
    if (
      ddUtils.estadoVigencia(
        expediente.estado,
        expediente.fechaVencimiento,
        ahora,
        expediente.fechaAprobacion,
      ) === DD_VIGENCIAS.VENCIDA
    ) {
      return false;
    }
    return (
      ddUtils.estadoDeclaracionVigencia(expediente.documentos) !==
      DD_DOCUMENTO_ESTADOS.APROBADO
    );
  },

  /** El cliente puede subir la declaracion cuando falta o quedo observada. */
  puedeCargarDeclaracionVigencia(
    expediente: {
      eventoId: string;
      estado: string;
      origen: string;
      fechaAprobacion: Date | string | null;
      fechaVencimiento: Date | string | null;
      documentos: { tipo: string; estado: string }[];
    },
    eventoActivoId?: string,
  ): boolean {
    if (!ddUtils.requiereRevalidacionDeclaracion(expediente, eventoActivoId)) return false;
    const estado = ddUtils.estadoDeclaracionVigencia(expediente.documentos);
    return estado === null || estado === DD_DOCUMENTO_ESTADOS.OBSERVADO;
  },

  /** true si la evaluacion permite contratar en el evento consultado. */
  aptoParaContratar(
    resultado: DdResultado,
    estadoEvaluacion: DdEstadoEvaluacion | null,
    declaraVerdad: boolean,
    esImportado = false,
  ): boolean {
    return (
      (declaraVerdad || esImportado) &&
      estadoEvaluacion === DD_ESTADOS_EVALUACION.VIGENTE &&
      (resultado === DD_RESULTADOS.APTO ||
        resultado === DD_RESULTADOS.APTO_CON_OBSERVACIONES)
    );
  },

  /** Tipos de documento que faltan cargar. */
  documentosFaltantes(documentos: { tipo: string }[]): DdDocumentoTipo[] {
    const cargados = new Set(documentos.map((d) => d.tipo));
    return DD_DOCUMENTOS_REQUERIDOS.map((d) => d.tipo).filter((tipo) => !cargados.has(tipo));
  },

  /** Errores que impiden enviar el expediente a revision. */
  erroresDeEnvio(expediente: {
    aceptaDatos: boolean;
    aceptaVerificacion: boolean;
    declaraVerdad: boolean;
    tipoRelacionComercial: string[];
    actividadEconomica: string | null;
    actividadEconomicaOtro: string | null;
    paisConstitucion: string | null;
    sitioWeb: string | null;
    emailRepresentante: string | null;
    representanteNombre: string | null;
    representanteTipoDocumento: string | null;
    representanteDocumento: string | null;
    representanteNacionalidad: string | null;
    beneficiarios?: { nacionalidad: string }[];
    documentos: { tipo: string; estado?: string }[];
  }): string[] {
    const errores: string[] = [];
    if (!expediente.aceptaDatos) errores.push(DD_MENSAJES.CONSENT_DATOS);
    if (!expediente.aceptaVerificacion) errores.push(DD_MENSAJES.CONSENT_VERIFICACION);
    if (!expediente.declaraVerdad) errores.push(DD_MENSAJES.DECLARACION_VERACIDAD);
    if (expediente.tipoRelacionComercial.length === 0) {
      errores.push("Seleccione al menos un tipo de relación comercial con el IIMP.");
    }
    if (!expediente.actividadEconomica) errores.push("Seleccione la actividad económica principal.");
    if (
      expediente.actividadEconomica &&
      !DD_ACTIVIDADES_ECONOMICAS.includes(expediente.actividadEconomica as never)
    ) {
      errores.push("Seleccione una actividad económica válida del catálogo.");
    }
    if (expediente.actividadEconomica === DD_ACTIVIDAD_OTRO && !expediente.actividadEconomicaOtro?.trim()) {
      errores.push(DD_MENSAJES.ACTIVIDAD_OTRO);
    }
    if (!expediente.paisConstitucion?.trim()) errores.push("Ingrese el país de constitución de la empresa.");
    if (!expediente.sitioWeb?.trim()) errores.push("Ingrese el sitio web de la empresa.");
    if (!expediente.emailRepresentante?.trim() || !REGEX_EMAIL.test(expediente.emailRepresentante)) {
      errores.push("Ingrese un correo válido para el representante legal.");
    }
    if (!expediente.representanteNombre?.trim()) errores.push("Ingrese el nombre del representante legal.");
    if (!expediente.representanteTipoDocumento?.trim()) {
      errores.push("Seleccione el tipo de documento del representante legal.");
    }
    if (!expediente.representanteDocumento?.trim()) {
      errores.push("Ingrese el número de documento del representante legal.");
    }
    if (!expediente.representanteNacionalidad?.trim()) {
      errores.push("Ingrese la nacionalidad del representante legal.");
    } else if (!REGEX_NACIONALIDAD.test(expediente.representanteNacionalidad.trim())) {
      errores.push("Ingrese una nacionalidad válida para el representante legal.");
    }
    for (const [indice, beneficiario] of (expediente.beneficiarios ?? []).entries()) {
      if (!REGEX_NACIONALIDAD.test(beneficiario.nacionalidad.trim())) {
        errores.push(`Ingrese una nacionalidad válida para el beneficiario ${indice + 1}.`);
      }
    }
    const faltantes = ddUtils.documentosFaltantes(expediente.documentos);
    if (faltantes.includes(DD_DOCUMENTOS.DECLARACION_JURADA)) {
      errores.push(DD_MENSAJES.DECLARACION_JURADA_OBLIGATORIA);
    }
    const otrosFaltantes = faltantes.filter(
      (tipo) => tipo !== DD_DOCUMENTOS.DECLARACION_JURADA,
    );
    if (otrosFaltantes.length > 0) {
      const titulos = otrosFaltantes
        .map((tipo) => DD_DOCUMENTOS_REQUERIDOS.find((d) => d.tipo === tipo)?.titulo ?? tipo)
        .join(", ");
      errores.push(`Faltan documentos obligatorios: ${titulos}.`);
    }
    const observados = expediente.documentos.filter(
      (d) => d.estado === DD_DOCUMENTO_ESTADOS.OBSERVADO,
    );
    if (observados.length > 0) errores.push("Reemplace los documentos observados antes de reenviar.");
    return errores;
  },

  /** Nombres a evaluar por Comunicaciones (empresa, representante y beneficiarios). */
  nombresARevisar(expediente: {
    empresa: { razonSocial: string };
    representanteNombre: string | null;
    beneficiarios: { nombre: string }[];
  }): string[] {
    const nombres = [
      expediente.empresa.razonSocial,
      expediente.representanteNombre,
      ...expediente.beneficiarios.map((b) => b.nombre),
    ]
      .map((nombre) => nombre?.trim() ?? "")
      .filter((nombre) => nombre.length > 0);
    return [...new Set(nombres)];
  },

  /** Roles a los que pertenece un nombre derivado. */
  rolesNombreARevisar(
    expediente: {
      empresa: { razonSocial: string };
      representanteNombre: string | null;
      beneficiarios: { nombre: string }[];
    },
    nombre: string,
  ): DdReputacionTipo[] {
    const buscado = nombre.trim();
    const roles: DdReputacionTipo[] = [];
    if (buscado === expediente.empresa.razonSocial.trim()) {
      roles.push(DD_REPUTACION_TIPOS.EMPRESA);
    }
    if (expediente.representanteNombre?.trim() === buscado) {
      roles.push(DD_REPUTACION_TIPOS.REPRESENTANTE);
    }
    if (expediente.beneficiarios.some((b) => b.nombre.trim() === buscado)) {
      roles.push(DD_REPUTACION_TIPOS.BENEFICIARIO);
    }
    return roles.length > 0 ? roles : [DD_REPUTACION_TIPOS.NOMBRE];
  },

  /** Estado persistido de un caso reputacional segun el resultado elegido. */
  estadoReputacion(resultado: string, cerrar: boolean): DdReputacionEstado | undefined {
    return cerrar
      ? DD_REPUTACION_ESTADOS.CERRADA
      : DD_REPUTACION_RESULTADO_A_ESTADO[resultado as DdReputacionResultado];
  },

  /** Etiqueta legible de un estado de reputacion. */
  etiquetaReputacion(estado: string): string {
    return DD_REPUTACION_ESTADO_LABELS[estado] ?? estado;
  },

  /** Etiqueta para empresas sin expediente. */
  etiquetaSinIniciar(): string {
    return DD_ESTADO_SIN_INICIAR_LABEL;
  },
};
