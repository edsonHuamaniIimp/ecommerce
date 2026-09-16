import { getSession } from "@/lib/server/auth";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";

const KBS_URL = process.env.AUSPICIOS_API_URL ?? process.env.KBSERVICIOS_URL ?? "";
const API_KEY = process.env.KBSERVICIOS_API_KEY ?? "";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

  try {
    const { code, codeEvent } = (await request.json()) as { code: number; codeEvent: number };
    if (!code || !codeEvent) return error(API_ERROR_CODES.VALIDATION, "code y codeEvent requeridos", 400);

    const res = await fetch(`${KBS_URL}/rest/listauspicio`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ code, codeEvent }),
    });

    if (!res.ok) return error(API_ERROR_CODES.INTERNAL, `Error externo: ${res.status}`, 502);
    const data = await res.json();
    return success(data);
  } catch (e) {
    return error(API_ERROR_CODES.INTERNAL, e instanceof Error ? e.message : "Error al consultar auspicios", 500);
  }
}
