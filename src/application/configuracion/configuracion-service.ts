import { API_ERROR_CODES, PERMISSIONS, REGEX_EMAIL } from "@/lib/shared/constants";
import { DomainError } from "@/lib/server/router";
import type { IConfiguracionRepository } from "@/domain/ports/configuracion-repository";
import type { PortalConfigEntity } from "@/domain/models/configuracion";

/** Configuracion sin guardar: el portal oculta los enlaces vacios. */
const PORTAL_VACIO: PortalConfigEntity = {
  mesaAyudaEmail: null,
  contactoEmail: null,
  manualUrl: null,
  reglamentoUrl: null,
  holdReservaMinutos: 25,
  updatedBy: null,
  updatedAt: null,
};

/** Datos editables de la configuracion del portal. */
export interface PortalConfigInput {
  mesaAyudaEmail?: string | null;
  contactoEmail?: string | null;
  manualUrl?: string | null;
  reglamentoUrl?: string | null;
  holdReservaMinutos?: number;
}

/** Texto limpio (trim) o null si queda vacio. */
function limpiar(valor?: string | null): string | null {
  const texto = (valor ?? "").trim();
  return texto.length > 0 ? texto : null;
}

/** Correo opcional (vacio = null, con formato valido si viene). */
function correo(valor: string | null | undefined, campo: string): string | null {
  const limpio = limpiar(valor);
  if (limpio && !REGEX_EMAIL.test(limpio)) {
    throw new DomainError(`Correo invalido en ${campo}`, API_ERROR_CODES.VALIDATION, 400);
  }
  return limpio;
}

/** URL http(s) opcional (vacia = null). */
function url(valor: string | null | undefined, campo: string): string | null {
  const limpio = limpiar(valor);
  if (limpio && !/^https?:\/\/.+/i.test(limpio)) {
    throw new DomainError(`URL invalida en ${campo}: debe iniciar con http:// o https://`, API_ERROR_CODES.VALIDATION, 400);
  }
  return limpio;
}

/** Duracion del hold en minutos: entero entre 1 y 120. */
function minutosHold(valor: number | undefined): number {
  const minutos = valor ?? 25;
  if (!Number.isInteger(minutos) || minutos < 1 || minutos > 120) {
    throw new DomainError("Los minutos de bloqueo deben ser un entero entre 1 y 120", API_ERROR_CODES.VALIDATION, 400);
  }
  return minutos;
}

/**
 * Configuracion publica del portal (login/presala): enlaces y contactos que el
 * administrador mantiene desde /dashboard/configuracion.
 */
export class ConfiguracionApplicationService {
  constructor(private readonly repo: IConfiguracionRepository) {}

  /** Autorizacion de gestion de la configuracion del portal (portal:manage o admin). */
  autorizarGestion(userPermissions: string[]): void {
    if (!userPermissions.includes(PERMISSIONS.ADMIN_FULL) && !userPermissions.includes(PERMISSIONS.PORTAL_MANAGE)) {
      throw new DomainError("Sin permiso para configurar el portal", API_ERROR_CODES.FORBIDDEN, 403);
    }
  }

  /** Configuracion vigente (vacia si nunca se guardo). */
  async obtenerPortal(): Promise<PortalConfigEntity> {
    return (await this.repo.obtenerPortal()) ?? PORTAL_VACIO;
  }

  /** Guarda la configuracion validando correos y URLs. */
  async actualizarPortal(input: PortalConfigInput, actualizadoPor: string | null): Promise<PortalConfigEntity> {
    return this.repo.guardarPortal({
      mesaAyudaEmail: correo(input.mesaAyudaEmail, "Mesa de Ayuda"),
      contactoEmail: correo(input.contactoEmail, "Contacto"),
      manualUrl: url(input.manualUrl, "Manual del Exhibidor"),
      reglamentoUrl: url(input.reglamentoUrl, "Reglamento de Stands"),
      holdReservaMinutos: minutosHold(input.holdReservaMinutos),
      updatedBy: limpiar(actualizadoPor),
    });
  }
}
