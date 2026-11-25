import type {
  DdAsistenteRespuestaIa,
  DdAsistenteSolicitudIa,
  IDdAsistenteIaClient,
} from "@/domain/ports/dd-asistente-ia-client";
import { DD_ASISTENTE, DD_ASISTENTE_MIME, DD_ASISTENTE_MODELOS_DEFECTO } from "@/lib/shared/constants";

interface RespuestaOpenAI {
  choices?: { message?: { content?: string | null } }[];
}

const TEMPERATURA = 0.2;

/** Asistente de observaciones con OpenAI (respaldo cuando no hay clave de Gemini). */
export class OpenAiAsistenteIaClient implements IDdAsistenteIaClient {
  private readonly apiKey = process.env.OPENAI_API_KEY?.trim();
  private readonly modelo = process.env.OPENAI_ASISTENTE_MODEL?.trim() || DD_ASISTENTE_MODELOS_DEFECTO.OPENAI;

  disponible(): boolean {
    return Boolean(this.apiKey);
  }

  async generar(solicitud: DdAsistenteSolicitudIa): Promise<DdAsistenteRespuestaIa | null> {
    if (!this.apiKey) return null;

    const archivos = solicitud.archivos.map((archivo) => {
      const dataUrl = `data:${archivo.mimeType};base64,${Buffer.from(archivo.bytes).toString("base64")}`;
      return archivo.mimeType === DD_ASISTENTE_MIME.PDF
        ? { type: "file", file: { filename: archivo.nombre, file_data: dataUrl } }
        : { type: "image_url", image_url: { url: dataUrl } };
    });

    const respuesta = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.modelo,
        temperature: TEMPERATURA,
        max_tokens: DD_ASISTENTE.MAX_TOKENS_RESPUESTA,
        messages: [
          { role: "system", content: solicitud.instrucciones },
          {
            role: "user",
            content: [
              ...archivos,
              ...solicitud.textos.map((texto) => ({ type: "text", text: texto.texto })),
              { type: "text", text: `Indicacion del usuario: ${solicitud.prompt}` },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(solicitud.timeoutMs),
    });

    if (!respuesta.ok) return null;
    const body = (await respuesta.json()) as RespuestaOpenAI;
    const texto = body.choices?.[0]?.message?.content?.trim();
    return texto ? { texto, modelo: `OpenAI ${this.modelo}` } : null;
  }
}
