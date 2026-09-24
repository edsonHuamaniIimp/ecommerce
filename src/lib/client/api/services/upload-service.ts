import 'client-only';

import { internalApi } from "./internal-api";

interface UploadResponse {
  url: string;
}

export const uploadService = {
  /** Sube un archivo y devuelve su URL publica. */
  async subir(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    const data = await internalApi.postForm<UploadResponse>("/api/upload", formData);
    if (!data?.url) throw new Error("Error al subir el archivo");
    return data.url;
  },
};
