import {
  API_ERROR_CODES,
  MAX_STANDS_RESERVA_DEFAULT,
  MAX_STANDS_RESERVA_LIMITE,
  MAX_STANDS_RESERVA_MIN,
  PERMISSIONS,
  REGEX_EMAIL,
} from "@/lib/shared/constants";
import { DomainError } from "@/lib/server/router";
import type { IConfiguracionRepository } from "@/domain/ports/configuracion-repository";
import type { PortalConfigEntity } from "@/domain/models/configuracion";
import { dateUtils } from "@/lib/shared/utils/date";

/** Configuracion sin guardar: el portal oculta los enlaces vacios. */
const PORTAL_VACIO: PortalConfigEntity = {
  mesaAyudaEmail: null,
  contactoEmail: null,
  manualUrl: null,
  reglamentoUrl: null,
  holdReservaMinutos: 25,
  maxStandsReserva: MAX_STANDS_RESERVA_DEFAULT,
  mantenimientoActivo: false,
  mantenimientoInicio: null,
  mantenimientoFin: null,
  mantenimientoPermiteCerrar: false,
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
  maxStandsReserva?: number;
  mantenimientoActivo?: boolean;
  mantenimientoInicio?: string | null;
  mantenimientoFin?: string | null;
  mantenimientoPermiteCerrar?: boolean;
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

/** Maximo de stands por reserva: entero entre el minimo y el tope configurable. */
function maximoStands(valor: number | undefined): number {
  const maximo = valor ?? MAX_STANDS_RESERVA_DEFAULT;
  if (
    !Number.isInteger(maximo) ||
    maximo < MAX_STANDS_RESERVA_MIN ||
    maximo > MAX_STANDS_RESERVA_LIMITE
  ) {
    throw new DomainError(
      `El maximo de stands debe ser un entero entre ${MAX_STANDS_RESERVA_MIN} y ${MAX_STANDS_RESERVA_LIMITE}`,
      API_ERROR_CODES.VALIDATION,
      400,
    );
  }
  return maximo;
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

  /** Guarda la configuracion validando correos, URLs y la ventana de mantenimiento. */
  async actualizarPortal(input: PortalConfigInput, actualizadoPor: string | null): Promise<PortalConfigEntity> {
    const mantenimientoInicio = dateUtils.toDate(input.mantenimientoInicio);
    const mantenimientoFin = dateUtils.toDate(input.mantenimientoFin);
    const mantenimientoActivo = input.mantenimientoActivo ?? false;
    if (mantenimientoActivo && (!mantenimientoInicio || !mantenimientoFin)) {
      throw new DomainError(
        "El modo mantenimiento requiere fecha de inicio y fin",
        API_ERROR_CODES.VALIDATION,
        400,
      );
    }
    if (mantenimientoInicio && mantenimientoFin && !dateUtils.isBefore(mantenimientoInicio, mantenimientoFin)) {
      throw new DomainError(
        "La fecha de fin debe ser posterior a la de inicio",
        API_ERROR_CODES.VALIDATION,
        400,
      );
    }

    return this.repo.guardarPortal({
      mesaAyudaEmail: correo(input.mesaAyudaEmail, "Mesa de Ayuda"),
      contactoEmail: correo(input.contactoEmail, "Contacto"),
      manualUrl: url(input.manualUrl, "Manual del Exhibidor"),
      reglamentoUrl: url(input.reglamentoUrl, "Reglamento de Stands"),
      holdReservaMinutos: minutosHold(input.holdReservaMinutos),
      maxStandsReserva: maximoStands(input.maxStandsReserva),
      mantenimientoActivo,
      mantenimientoInicio,
      mantenimientoFin,
      mantenimientoPermiteCerrar: input.mantenimientoPermiteCerrar ?? false,
      updatedBy: limpiar(actualizadoPor),
    });
  }
}
