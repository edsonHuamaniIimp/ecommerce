import type { ITipoStandImagenRepository } from "@/domain/ports/tipo-stand-imagen-repository";
import type { TipoStandImagenItem } from "@/domain/models/tipo-stand-imagen";
import { DomainError } from "@/lib/server/router";
import { API_ERROR_CODES, PERMISSIONS, TIPOS_STAND_CATALOGO } from "@/lib/shared/constants";
import { claveTipoStand } from "@/lib/shared/utils/tipo-stand";

/**
 * Imagen referencial por tipo de stand (RF-08): una imagen por tipo y EVENTO,
 * con respaldo global (`eventoId` null). La del evento pisa a la global.
 */
export class TiposStandImagenApplicationService {
  constructor(private readonly repo: ITipoStandImagenRepository) {}

  /** Permiso de gestion de stands (o admin total). */
  autorizarGestion(permissions: string[] = []): void {
    const permitido =
      permissions.includes(PERMISSIONS.STANDS_MANAGE) || permissions.includes(PERMISSIONS.ADMIN_FULL);
    if (!permitido) {
      throw new DomainError("Sin permiso para gestionar la imagen por tipo de stand", API_ERROR_CODES.FORBIDDEN, 403);
    }
  }

  /** Catalogo completo del evento (pisa la global); null = sin imagen. */
  async listar(eventoId: string | null): Promise<TipoStandImagenItem[]> {
    const filas = await this.repo.listar();
    const global = new Map<string, string>();
    const porEvento = new Map<string, string>();
    for (const fila of filas) {
      const clave = claveTipoStand(fila.tipo) ?? fila.tipo;
      if (!fila.eventoId) global.set(clave, fila.imagenUrl);
      else if (fila.eventoId === eventoId) porEvento.set(clave, fila.imagenUrl);
    }
    return TIPOS_STAND_CATALOGO.map((t) => ({
      tipo: t.key,
      label: t.label,
      imagenUrl: porEvento.get(t.key) ?? global.get(t.key) ?? null,
    }));
  }

  /** Sube/reemplaza la imagen de un tipo para el evento (aplica a todos sus stands). */
  async guardar(tipo: string, imagenUrl: string, eventoId: string | null): Promise<void> {
    const clave = this.validarTipo(tipo);
    if (!imagenUrl.trim()) {
      throw new DomainError("La imagen es obligatoria", API_ERROR_CODES.VALIDATION, 400);
    }
    await this.repo.upsert(clave, imagenUrl.trim(), eventoId);
  }

  /** Quita la imagen referencial del tipo en el evento (el global, si existe, vuelve a aplicar). */
  async eliminar(tipo: string, eventoId: string | null): Promise<void> {
    const clave = this.validarTipo(tipo);
    await this.repo.eliminar(clave, eventoId);
  }

  private validarTipo(tipo: string): string {
    const clave = claveTipoStand(tipo);
    if (!clave || !TIPOS_STAND_CATALOGO.some((t) => t.key === clave)) {
      throw new DomainError(`Tipo de stand invalido: ${tipo}`, API_ERROR_CODES.VALIDATION, 400);
    }
    return clave;
  }
}
