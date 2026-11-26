import {
  API_ERROR_CODES,
  DD_CONFIG_CIERRE_ESTADOS,
  DD_CONFIG_VIGENCIAS,
  PERMISSIONS,
} from "@/lib/shared/constants";
import { DomainError } from "@/domain/errors/domain-error";
import type {
  DdAuditoriaItem,
  DdConfiguracionEntity,
} from "@/domain/models/dd-configuracion";
import type { IDdConfiguracionRepository } from "@/domain/ports/dd-configuracion-repository";

interface DdConfiguracionInput {
  plazoDiasHabiles: number;
  estadoCierreAutomatico: string;
  exigirEvidencia: boolean;
  permitirNaSinEvidencia: boolean;
  revalidacionDeclaracion: boolean;
  noAptoBloqueaEmpresa: boolean;
  legalSoloDerivacionSig: boolean;
  vigenciaMeses: number;
  permitirReutilizacionVinculo: boolean;
  asistenteIaHabilitado: boolean;
  /** Regla «Exigir observación en criterios con hallazgo» de la Matriz DD. */
  exigirObservacionCriterio: boolean;
  manualUrl: string | null;
  reglamentoUrl: string | null;
  plantillaInformeUrl: string | null;
  linkListasUrl: string | null;
}

/** Valores por defecto mientras no se guarde la configuracion (fila `default` ausente). */
export const CONFIG_DEFAULT: DdConfiguracionEntity = {
  plazoDiasHabiles: 3,
  estadoCierreAutomatico: DD_CONFIG_CIERRE_ESTADOS.SIN_RESPUESTA,
  exigirEvidencia: true,
  permitirNaSinEvidencia: true,
  revalidacionDeclaracion: true,
  noAptoBloqueaEmpresa: true,
  legalSoloDerivacionSig: true,
  vigenciaMeses: 6,
  permitirReutilizacionVinculo: true,
  asistenteIaHabilitado: false,
  exigirObservacionCriterio: true,
  manualUrl: null,
  reglamentoUrl: null,
  plantillaInformeUrl: null,
  linkListasUrl: null,
  updatedBy: null,
  updatedAt: null,
};

function url(value: string | null, label: string): string | null {
  const text = value?.trim();
  if (!text) return null;
  if (!/^https?:\/\/.+/i.test(text)) {
    throw new DomainError(
      `La URL de ${label} debe iniciar con http:// o https://`,
      API_ERROR_CODES.VALIDATION,
      400,
    );
  }
  return text;
}

export class DdConfiguracionApplicationService {
  constructor(private readonly repo: IDdConfiguracionRepository) {}

  autorizar(session: { permissions: string[] }): void {
    if (
      !session.permissions.includes(PERMISSIONS.ADMIN_FULL) &&
      !session.permissions.includes(PERMISSIONS.DD_ADMIN)
    ) {
      throw new DomainError(
        "Sin permiso para administrar Debida Diligencia",
        API_ERROR_CODES.FORBIDDEN,
        403,
      );
    }
  }

  async obtener(): Promise<DdConfiguracionEntity> {
    return (await this.repo.obtener()) ?? CONFIG_DEFAULT;
  }

  async actualizar(
    input: DdConfiguracionInput,
    session: { email: string; permissions: string[] },
  ): Promise<DdConfiguracionEntity> {
    this.autorizar(session);
    if (!Number.isInteger(input.plazoDiasHabiles) || input.plazoDiasHabiles < 1 || input.plazoDiasHabiles > 30) {
      throw new DomainError(
        "El plazo debe ser un número entero entre 1 y 30 días hábiles",
        API_ERROR_CODES.VALIDATION,
        400,
      );
    }
    if (!Object.values(DD_CONFIG_CIERRE_ESTADOS).includes(input.estadoCierreAutomatico as never)) {
      throw new DomainError("Estado de cierre automático inválido", API_ERROR_CODES.VALIDATION, 400);
    }
    if (!DD_CONFIG_VIGENCIAS.some((opcion) => opcion.meses === input.vigenciaMeses)) {
      throw new DomainError("Vigencia predeterminada inválida", API_ERROR_CODES.VALIDATION, 400);
    }

    const config = await this.repo.guardar({
      ...input,
      manualUrl: url(input.manualUrl, "Manual del Exhibidor"),
      reglamentoUrl: url(input.reglamentoUrl, "Reglamento de Stands"),
      plantillaInformeUrl: url(input.plantillaInformeUrl, "Plantilla de informe"),
      linkListasUrl: url(input.linkListasUrl, "Listas restrictivas"),
      updatedBy: session.email,
    });
    await this.repo.registrarAuditoria(
      "configuracion:actualizar",
      session.email,
      "Actualizó la configuración de Debida Diligencia",
    );
    return config;
  }

  async listarAuditoria(session: { permissions: string[] }): Promise<DdAuditoriaItem[]> {
    this.autorizar(session);
    return this.repo.listarAuditoria(20);
  }
}
