import { TIPOS_DOCUMENTO, TIPOS_DOCUMENTO_EMPRESA, TIPOS_DOCUMENTO_PERSONA } from "@/lib/shared/constants";
import type { IEmpresaClient } from "@/domain/ports/empresa-client";
import type { IPersonaClient } from "@/domain/ports/persona-client";
import type { IUsuarioRepository } from "@/domain/ports/usuario-repository";

/** Acepta el codigo ("1"/"6") o la etiqueta del wizard ("DNI"/"RUC"). */
function normalizarTipoDocumento(tipo: string): string {
  if (tipo === TIPOS_DOCUMENTO.RUC) return TIPOS_DOCUMENTO_EMPRESA.RUC;
  if (tipo === TIPOS_DOCUMENTO.DNI) return TIPOS_DOCUMENTO_PERSONA.DNI;
  return tipo;
}

/** Datos con los que se prellena el paso "Tus datos" del wizard de reserva. */
export interface PrellenadoReserva {
  contacto?: string;
  direccion?: string;
  telefono?: string;
  correo?: string;
}

/**
 * Prellenado del wizard de reserva con datos internos (servicio-persona).
 * Privacidad (criterio elegido): solo se devuelven datos si el documento consultado
 * corresponde al propio usuario logueado (su `sie_code` de persona o su `id_empresa`
 * SIE), nunca informacion de terceros. Best-effort: cualquier fallo devuelve {}.
 */
export class PrellenadoReservaApplicationService {
  constructor(
    private readonly usuarioRepo: IUsuarioRepository,
    private readonly personaClient: IPersonaClient,
    private readonly empresaClient: IEmpresaClient,
  ) {}

  async prellenar(email: string | null | undefined, tipoDocumento: string, numeroDocumento: string): Promise<PrellenadoReserva> {
    const correoUsuario = String(email ?? "").trim().toLowerCase();
    const numero = String(numeroDocumento ?? "").trim();
    const tipo = normalizarTipoDocumento(String(tipoDocumento ?? "").trim());
    if (!correoUsuario || !numero || !tipo) return {};

    try {
      const vinculacion = await this.usuarioRepo.findVinculacionPorEmail(correoUsuario);
      if (!vinculacion) return {};

      if (tipo === TIPOS_DOCUMENTO_EMPRESA.RUC) {
        if (!vinculacion.idEmpresa) return {};
        const empresa = await this.empresaClient.buscarPorDocumento(TIPOS_DOCUMENTO_EMPRESA.RUC, numero);
        if (!empresa?.sie_code || empresa.sie_code !== vinculacion.idEmpresa) return {};
        return {
          ...(empresa.direccion ? { direccion: empresa.direccion } : {}),
          ...(empresa.telefono ? { telefono: empresa.telefono } : {}),
          ...(empresa.correo ? { correo: empresa.correo } : {}),
        };
      }

      if (!vinculacion.sieCode) return {};
      const persona = await this.personaClient.buscarPorDocumento(numero, tipo);
      if (!persona?.sie_code || persona.sie_code !== vinculacion.sieCode) return {};
      const contacto = persona.nombre_completo
        ?? [persona.nombres, persona.apellido_paterno, persona.apellido_materno].filter(Boolean).join(" ");
      return {
        ...(contacto ? { contacto } : {}),
        ...(persona.direccion ? { direccion: persona.direccion } : {}),
        ...(persona.celular ? { telefono: persona.celular } : {}),
        ...(persona.correo ? { correo: persona.correo } : {}),
      };
    } catch {
      return {};
    }
  }
}
