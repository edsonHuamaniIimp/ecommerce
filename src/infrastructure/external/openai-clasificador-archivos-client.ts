import type {
  DdClasificadorSugerencia,
  IDdClasificadorArchivosClient,
} from "@/domain/ports/dd-clasificador-archivos-client";
import { DD_REPOSITORIO_IMPORT_CATEGORIAS } from "@/lib/shared/constants";

interface RespuestaOpenAI {
  choices?: { message?: { content?: string } }[];
}

function limpiarJson(texto: string): string {
  return texto.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

/**
 * Cliente opcional de IA para clasificar archivos usando SOLO sus nombres.
 * Si no hay API key configurada, la aplicación usa el clasificador local.
 */
export class OpenAiClasificadorArchivosClient implements IDdClasificadorArchivosClient {
  private readonly apiKey = process.env.OPENAI_API_KEY?.trim();
  private readonly modelo = process.env.OPENAI_CLASSIFIER_MODEL?.trim() || "gpt-4o-mini";

  disponible(): boolean {
    return Boolean(this.apiKey);
  }

  async clasificar(datos: {
    empresa: { id: string; razonSocial: string; ruc: string };
    vinculos: { id: string; nombre: string; tipo: string }[];
    archivos: { nombre: string }[];
  }): Promise<DdClasificadorSugerencia[] | null> {
    if (!this.apiKey) return null;

    const categorias = DD_REPOSITORIO_IMPORT_CATEGORIAS.map((item) => ({
      value: item.value,
      label: item.label,
    }));

    const respuesta = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.modelo,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Eres un asistente de clasificación documental. Recibirás SOLO nombres de archivos, nunca su contenido. " +
              "Asigna cada archivo a uno de los vínculos y categorías permitidas. " +
              "No inventes IDs. Devuelve JSON con la forma {\"sugerencias\":[{\"indice\":0,\"vinculoId\":\"...\",\"categoria\":\"...\",\"confianza\":0.0,\"motivo\":\"...\"}]}. " +
              "La confianza debe estar entre 0 y 1. Si no estás seguro, usa el primer vínculo y confianza baja.",
          },
          {
            role: "user",
            content: JSON.stringify({
              empresa: datos.empresa,
              vinculos: datos.vinculos,
              categorias,
              archivos: datos.archivos,
            }),
          },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!respuesta.ok) return null;
    const body = (await respuesta.json()) as RespuestaOpenAI;
    const contenido = body.choices?.[0]?.message?.content;
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
