import "server-only";

import { DomainError } from "@/domain/errors/domain-error";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { getStorage } from "@/lib/server/storage";
import { ddArchivoUtils } from "@/lib/shared/utils/debida-diligencia-archivo";
import type {
  DdDocumentoAValidar,
  DdInformeLegalAValidar,
  IDebidaDiligenciaDocumentoValidator,
} from "@/domain/ports/debida-diligencia-documento-validator";

/** Valida que el documento exista en storage y que su contenido real sea PDF/JPG/PNG. */
export class DebidaDiligenciaDocumentoValidator implements IDebidaDiligenciaDocumentoValidator {
  async validarInformeLegal(documento: DdInformeLegalAValidar): Promise<void> {
    const filename = ddArchivoUtils.nombreDesdeUrl(documento.url);
    if (!filename) {
      throw new DomainError(
        "La URL del informe legal no es válida. Vuelva a cargarlo.",
        API_ERROR_CODES.VALIDATION,
        400,
      );
    }
    const archivo = await getStorage().read(filename);
    if (!archivo) {
      throw new DomainError(
        "El informe legal no existe en el almacenamiento. Vuelva a cargarlo.",
        API_ERROR_CODES.VALIDATION,
        400,
      );
    }
    const error = ddArchivoUtils.validarInformeLegal({
      nombre: documento.nombre,
      size: archivo.bytes.byteLength,
      bytes: archivo.bytes,
    });
    if (error) {
      throw new DomainError(`Informe legal: ${error}`, API_ERROR_CODES.VALIDATION, 400);
    }
  }

  async validarDocumento(documento: DdDocumentoAValidar): Promise<void> {
    const filename = ddArchivoUtils.nombreDesdeUrl(documento.url);
    if (!filename) {
      throw new DomainError(
        `La URL del documento "${documento.nombre}" no es válida. Vuelva a cargarlo.`,
        API_ERROR_CODES.VALIDATION,
        400,
      );
    }

    const archivo = await getStorage().read(filename);
    if (!archivo) {
      throw new DomainError(
        `El documento "${documento.nombre}" no existe en el almacenamiento. Vuelva a cargarlo.`,
        API_ERROR_CODES.VALIDATION,
        400,
      );
    }

    const error = ddArchivoUtils.validar({
      nombre: documento.nombre,
      size: archivo.bytes.byteLength,
      bytes: archivo.bytes,
    });
    if (error) {
      throw new DomainError(
        `Documento "${documento.nombre}": ${error}`,
        API_ERROR_CODES.VALIDATION,
        400,
      );
    }
  }
}
