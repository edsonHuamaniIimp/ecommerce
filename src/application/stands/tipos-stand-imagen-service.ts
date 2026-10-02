import type { ITipoStandImagenRepository } from "@/domain/ports/tipo-stand-imagen-repository";
import type { TipoStandImagenItem } from "@/domain/models/tipo-stand-imagen";
import { DomainError } from "@/lib/server/router";
import { API_ERROR_CODES, PERMISSIONS, TIPOS_STAND_CATALOGO } from "@/lib/shared/constants";
import { claveTipoStand } from "@/lib/shared/utils/tipo-stand";

/**
 * Imagen referencial por tipo de stand (RF-08): una imagen por tipo, aplicada a
 * todos los stands de ese tipo en el mapa y en la bandeja de stands.
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

  /** Catalogo completo (tipos del catalogo) con su imagen referencial, null = sin subir. */
  async listar(): Promise<TipoStandImagenItem[]> {
    const filas = await this.repo.listar();
    const porTipo = new Map(filas.map((f) => [claveTipoStand(f.tipo) ?? f.tipo, f.imagenUrl]));
    return TIPOS_STAND_CATALOGO.map((t) => ({
      tipo: t.key,
      label: t.label,
      imagenUrl: porTipo.get(t.key) ?? null,
    }));
  }

  /** Sube/reemplaza la imagen de un tipo (aplica a todos los stands del tipo). */
  async guardar(tipo: string, imagenUrl: string): Promise<void> {
    const clave = this.validarTipo(tipo);
    if (!imagenUrl.trim()) {
      throw new DomainError("La imagen es obligatoria", API_ERROR_CODES.VALIDATION, 400);
    }
    await this.repo.upsert(clave, imagenUrl.trim());
  }

  /** Quita la imagen referencial del tipo. */
  async eliminar(tipo: string): Promise<void> {
    const clave = this.validarTipo(tipo);
    await this.repo.eliminar(clave);
  }

  private validarTipo(tipo: string): string {
    const clave = claveTipoStand(tipo);
    if (!clave || !TIPOS_STAND_CATALOGO.some((t) => t.key === clave)) {
      throw new DomainError(`Tipo de stand invalido: ${tipo}`, API_ERROR_CODES.VALIDATION, 400);
    }
    return clave;
  }
}
