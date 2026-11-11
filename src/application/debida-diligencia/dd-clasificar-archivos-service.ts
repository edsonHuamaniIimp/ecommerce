import type { DdClasificarArchivosRequestDTO, DdClasificarArchivosResponseDTO, DdClasificarArchivosSugerenciaDTO } from "@/types/dto/debida-diligencia";
import type { DdSession } from "@/application/debida-diligencia/debida-diligencia-service";
import type { DdClasificadorSugerencia, IDdClasificadorArchivosClient } from "@/domain/ports/dd-clasificador-archivos-client";
import { DomainError } from "@/domain/errors/domain-error";
import {
  API_ERROR_CODES,
  DD_REPOSITORIO_IMPORT_CATEGORIAS,
  PERMISSIONS,
} from "@/lib/shared/constants";
import { clasificarNombreArchivo } from "@/lib/shared/utils/dd-repositorio-import";

/** Sugiere vínculo/categoría para archivos usando solo sus nombres. */
export class DdClasificarArchivosApplicationService {
  constructor(private readonly clienteIA: IDdClasificadorArchivosClient) {}

  async clasificar(
    dto: DdClasificarArchivosRequestDTO,
    session: DdSession,
  ): Promise<DdClasificarArchivosResponseDTO> {
    if (!session.permissions.includes(PERMISSIONS.DD_MATRIZ)) {
      throw new DomainError("No autorizado para clasificar evidencias", API_ERROR_CODES.FORBIDDEN, 403);
    }

    const locales = this.clasificarPorReglas(dto);
    if (!this.clienteIA.disponible()) {
      return { origen: "reglas", sugerencias: locales };
    }

    try {
      const sugerenciasIA = await this.clienteIA.clasificar({
        empresa: dto.empresa,
        vinculos: dto.vinculos,
        archivos: dto.archivos,
      });
      if (!sugerenciasIA?.length) return { origen: "reglas", sugerencias: locales };

      const categoriasValidas = new Set<string>(DD_REPOSITORIO_IMPORT_CATEGORIAS.map((item) => item.value));
      const vinculosValidos = new Set(dto.vinculos.map((vinculo) => vinculo.id));
      const porIndice = new Map<number, DdClasificadorSugerencia>();
      for (const sugerencia of sugerenciasIA) {
        if (!Number.isInteger(sugerencia.indice)) continue;
        if (!vinculosValidos.has(sugerencia.vinculoId ?? "")) continue;
        if (!categoriasValidas.has(sugerencia.categoria)) continue;
        porIndice.set(sugerencia.indice, sugerencia);
      }

      const sugerencias: DdClasificarArchivosSugerenciaDTO[] = dto.archivos.map((_, indice) => {
        const ia = porIndice.get(indice);
        const local = locales[indice];
        if (!ia || !local) {
          return local ?? {
            indice,
            vinculoId: dto.vinculos[0]?.id ?? null,
            categoria: DD_REPOSITORIO_IMPORT_CATEGORIAS[0].value,
            confianza: 0,
            motivo: "Sin coincidencia.",
          };
        }
        return {
          indice,
          vinculoId: ia.vinculoId,
          categoria: ia.categoria,
          confianza: Math.max(0, Math.min(1, ia.confianza)),
          motivo: ia.motivo,
        };
      });

      return { origen: porIndice.size > 0 ? "ia" : "reglas", sugerencias };
    } catch {
      return { origen: "reglas", sugerencias: locales };
    }
  }

  private clasificarPorReglas(dto: DdClasificarArchivosRequestDTO): DdClasificarArchivosSugerenciaDTO[] {
    return dto.archivos.map((archivo, indice) => {
      const clasificacion = clasificarNombreArchivo(archivo.nombre, dto.vinculos);
      return {
        indice,
        vinculoId: clasificacion.vinculoId,
        categoria: clasificacion.categoria,
        confianza: 0.45,
        motivo: clasificacion.motivo,
      };
    });
  }
}
