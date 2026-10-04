/**
 * Claves y datos de las alertas de la campana (in-app).
 * El texto vive en plantillas es/en (`./es`, `./en`) y se resuelve al listar
 * segun el idioma del destinatario; en BD se guarda un render en español como
 * respaldo para filas legacy o claves desconocidas.
 */
export const ALERTA_CLAVES = {
  NUEVA_SOLICITUD_REVISION: "nueva-solicitud-revision",
  SOLICITUD_MULTIPLE_CLIENTE: "solicitud-multiple-cliente",
  SOLICITUD_MULTIPLE_ADMIN: "solicitud-multiple-admin",
  TURNO_REVISION: "turno-revision",
  REVISION_COMPLETADA: "revision-completada",
  CONTRATO_FIRMADO_SUBIDO: "contrato-firmado-subido",
} as const;

export type AlertaClave = (typeof ALERTA_CLAVES)[keyof typeof ALERTA_CLAVES];

/** Datos que cada plantilla necesita para interpolar titulo y mensaje. */
export interface AlertaDatosMap {
  "nueva-solicitud-revision": { stands: string };
  "solicitud-multiple-cliente": { total: number; stands: string };
  "solicitud-multiple-admin": { total: number; stands: string };
  /** `area` es la clave de `REVISION_AREAS` (asociado | legal). */
  "turno-revision": { area: string; stands: string };
  "revision-completada": { stands: string };
  "contrato-firmado-subido": { stands: string };
}

export type AlertaDatos = AlertaDatosMap[AlertaClave];

/** Par titulo/mensaje ya resuelto para mostrar en la campana. */
export interface AlertaPlantilla {
  titulo: string;
  mensaje: string;
}
