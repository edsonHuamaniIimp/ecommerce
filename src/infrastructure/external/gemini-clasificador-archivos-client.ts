import type {
  DdClasificadorSugerencia,
  IDdClasificadorArchivosClient,
} from "@/domain/ports/dd-clasificador-archivos-client";
import {
  DD_CLASIFICADOR_ARCHIVOS_INSTRUCCIONES,
  categoriasClasificadorArchivos,
} from "@/lib/shared/utils/dd-clasificador-archivos";

interface RespuestaGemini {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
}

/**
 * Clasificar nombres de archivo no requiere razonamiento profundo. Con el "thinking" por defecto del
 * modelo 12 archivos tardaban ~50 s (mas que el timeout) y siempre se caia al clasificador por reglas.
 * Con nivel "low" tarda ~9 s.
 */
const THINKING_LEVEL = "low";
/** Margen para lotes grandes (hasta 100 archivos). */
const TIMEOUT_MS = 45_000;

function limpiarJson(texto: string): string {
  return texto.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

/**
 * Cliente opcional de Gemini para clasificar archivos usando SOLO sus nombres.
 * Si no hay API key configurada, la aplicacion usa el clasificador local.
 */
export class GeminiClasificadorArchivosClient implements IDdClasificadorArchivosClient {
  private readonly apiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY)?.trim();
  private readonly modelo = process.env.GEMINI_CLASSIFIER_MODEL?.trim() || "gemini-3.8-flash";

  disponible(): boolean {
    return Boolean(this.apiKey);
  }

  async clasificar(datos: {
    empresa: { id: string; razonSocial: string; ruc: string };
    vinculos: { id: string; nombre: string; tipo: string }[];
    archivos: { nombre: string }[];
  }): Promise<DdClasificadorSugerencia[] | null> {
    if (!this.apiKey) return null;

    const categorias = categoriasClasificadorArchivos();

    const respuesta = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.modelo)}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: `${DD_CLASIFICADOR_ARCHIVOS_INSTRUCCIONES} La confianza debe estar entre 0 y 1.`,
              },
            ],
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: JSON.stringify({
                    empresa: datos.empresa,
                    vinculos: datos.vinculos,
                    categorias,
                    archivos: datos.archivos,
                  }),
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
            thinkingConfig: { thinkingLevel: THINKING_LEVEL },
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );

    if (!respuesta.ok) return null;
    const body = (await respuesta.json()) as RespuestaGemini;
    const contenido = body.candidates?.[0]?.content?.parts
      ?.map((parte) => parte.text ?? "")
      .join("");

    if (!contenido) return null;

    try {
      const parsed = JSON.parse(limpiarJson(contenido)) as { sugerencias?: unknown };
      if (!Array.isArray(parsed.sugerencias)) return null;
      return parsed.sugerencias.filter((item): item is DdClasificadorSugerencia => {
        if (typeof item !== "object" || item === null) return false;
        const sugerencia = item as Partial<DdClasificadorSugerencia>;
        return typeof sugerencia.indice === "number" &&
          (typeof sugerencia.vinculoId === "string" || sugerencia.vinculoId === null) &&
          typeof sugerencia.categoria === "string" &&
          typeof sugerencia.confianza === "number" &&
          typeof sugerencia.motivo === "string";
      });
    } catch {
      return null;
    }
  }
}
