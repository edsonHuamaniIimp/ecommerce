import { DomainError } from "@/domain/errors/domain-error";
import type {
  DdAsistenteRespuestaIa,
  DdAsistenteSolicitudIa,
  IDdAsistenteIaClient,
} from "@/domain/ports/dd-asistente-ia-client";
import {
  API_ERROR_CODES,
  DD_ASISTENTE,
  DD_ASISTENTE_MENSAJES,
  DD_ASISTENTE_MODELOS_DEFECTO,
} from "@/lib/shared/constants";

interface RespuestaGemini {
  candidates?: {
    content?: {
      parts?: { text?: string; thought?: boolean }[];
    };
  }[];
}

/** Resultado de un intento con un modelo. */
interface Intento {
  texto: string | null;
  /** El modelo estaba saturado, fallo temporalmente o no respondio a tiempo. */
  saturado: boolean;
}

/** Redactar una observacion no requiere razonamiento profundo; "low" mantiene la respuesta en segundos. */
const THINKING_LEVEL = "low";
const TEMPERATURA = 0.2;
/** Respuestas que indican saturacion o falla temporal del modelo. */
const ESTADOS_SATURADO = new Set([429, 500, 502, 503, 504]);
/** Por debajo de este tiempo restante no se lanza otro modelo. */
const INTENTO_MIN_MS = 3_000;

/** Principal y respaldos (GEMINI_ASISTENTE_MODELOS_RESPALDO separados por coma), sin repetir. */
function modelosConfigurados(): string[] {
  const principal = process.env.GEMINI_ASISTENTE_MODEL?.trim() || DD_ASISTENTE_MODELOS_DEFECTO.GEMINI;
  const respaldos = (process.env.GEMINI_ASISTENTE_MODELOS_RESPALDO ?? DD_ASISTENTE_MODELOS_DEFECTO.GEMINI_RESPALDO)
    .split(",")
    .map((modelo) => modelo.trim())
    .filter(Boolean);
  return [...new Set([principal, ...respaldos])];
}

const esperar = (ms: number) => new Promise<null>((resolve) => setTimeout(() => resolve(null), ms));

/**
 * Asistente de observaciones con Gemini. Los PDF e imagenes viajan en la misma peticion
 * (inlineData); el texto extraido (OCR o Word) viaja como texto.
 *
 * Gemini se satura a ratos (503) o deja peticiones colgadas. Por eso los modelos se lanzan
 * escalonados: si el actual no responde en ESCALON_RESPALDO_MS, se lanza el siguiente en
 * paralelo (o de inmediato si el actual fallo) y gana la primera respuesta con texto.
 */
export class GeminiAsistenteIaClient implements IDdAsistenteIaClient {
  private readonly apiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY)?.trim();
  private readonly modelos = modelosConfigurados();

  disponible(): boolean {
    return Boolean(this.apiKey);
  }

  async generar(solicitud: DdAsistenteSolicitudIa): Promise<DdAsistenteRespuestaIa | null> {
    if (!this.apiKey) return null;
    const cuerpo = this.cuerpo(solicitud);
    const vence = Date.now() + solicitud.timeoutMs;
    const controladores: AbortController[] = [];
    const enCurso = new Map<number, Promise<{ indice: number; intento: Intento }>>();
    let siguiente = 0;
    let saturado = false;

    const quedanModelos = () => siguiente < this.modelos.length && vence - Date.now() >= INTENTO_MIN_MS;
    const lanzar = () => {
      const indice = siguiente++;
      const controlador = new AbortController();
      controladores.push(controlador);
      const limite = setTimeout(() => controlador.abort(), Math.max(0, vence - Date.now()));
      enCurso.set(
        indice,
        this.intentar(this.modelos[indice]!, cuerpo, controlador.signal)
          .finally(() => clearTimeout(limite))
          .then((intento) => ({ indice, intento })),
      );
    };

    try {
      lanzar();
      while (enCurso.size > 0) {
        const escalon = quedanModelos() ? [esperar(DD_ASISTENTE.ESCALON_RESPALDO_MS)] : [];
        const primero = await Promise.race([...enCurso.values(), ...escalon]);
        if (primero === null) {
          /* El modelo actual tarda: se suma el siguiente en paralelo. */
          lanzar();
          continue;
        }
        enCurso.delete(primero.indice);
        if (primero.intento.texto) {
          return { texto: primero.intento.texto, modelo: `Gemini ${this.modelos[primero.indice]}` };
        }
        saturado ||= primero.intento.saturado;
        /* Fallo rapido: el siguiente modelo de inmediato, sin esperar el escalon. */
        if (quedanModelos()) lanzar();
      }
    } finally {
      /* Cancela los intentos que siguen en curso (ya hay respuesta o se acabo el plazo). */
      for (const controlador of controladores) controlador.abort();
    }

    if (saturado) {
      throw new DomainError(DD_ASISTENTE_MENSAJES.IA_SATURADA, API_ERROR_CODES.SERVICE_UNAVAILABLE, 503);
    }
    return null;
  }

  private cuerpo(solicitud: DdAsistenteSolicitudIa): string {
    return JSON.stringify({
      systemInstruction: { parts: [{ text: solicitud.instrucciones }] },
      contents: [
        {
          role: "user",
          parts: [
            ...solicitud.archivos.map((archivo) => ({
              inlineData: { mimeType: archivo.mimeType, data: Buffer.from(archivo.bytes).toString("base64") },
            })),
            ...solicitud.textos.map((texto) => ({ text: texto.texto })),
            { text: `Indicacion del usuario: ${solicitud.prompt}` },
          ],
        },
      ],
      generationConfig: {
        temperature: TEMPERATURA,
        maxOutputTokens: DD_ASISTENTE.MAX_TOKENS_RESPUESTA,
        thinkingConfig: { thinkingLevel: THINKING_LEVEL },
      },
    });
  }

  private async intentar(modelo: string, cuerpo: string, signal: AbortSignal): Promise<Intento> {
    try {
      const respuesta = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`,
        {
          method: "POST",
          headers: { "x-goog-api-key": this.apiKey!, "Content-Type": "application/json" },
          body: cuerpo,
          signal,
        },
      );
      if (!respuesta.ok) return { texto: null, saturado: ESTADOS_SATURADO.has(respuesta.status) };
      const body = (await respuesta.json()) as RespuestaGemini;
      const texto = body.candidates?.[0]?.content?.parts
        ?.filter((parte) => !parte.thought)
        .map((parte) => parte.text ?? "")
        .join("")
        .trim();
      return { texto: texto || null, saturado: false };
    } catch {
      /* Sin respuesta a tiempo, cancelado o error de red. */
      return { texto: null, saturado: true };
    }
  }
}
