import type { ActualizarPortalConfigData, PortalConfigEntity } from "@/domain/models/configuracion";

/** Persistencia de la configuracion publica del portal (registro unico). */
export interface IConfiguracionRepository {
  /** Configuracion guardada, o null si aun no existe (nunca se guardo). */
  obtenerPortal(): Promise<PortalConfigEntity | null>;
  /** Guarda (crea o reemplaza) la configuracion del portal. */
  guardarPortal(data: ActualizarPortalConfigData): Promise<PortalConfigEntity>;
  /** Correos internos configurados para avisos de nuevas solicitudes. */
  obtenerNotificacionesSolicitudes(): Promise<string[]>;
  /** Guarda solo la lista de correos internos de nuevas solicitudes. */
  guardarNotificacionesSolicitudes(emails: string[], updatedBy: string | null): Promise<string[]>;
}
