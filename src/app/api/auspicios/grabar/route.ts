import { getSession } from "@/lib/auth";
import { success, error } from "@/lib/api-response";
import { API_ERROR_CODES } from "@/lib/constants";

const KBS_URL = process.env.KBSERVICIOS_URL ?? "";
const API_KEY = process.env.KBSERVICIOS_API_KEY ?? "";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

  try {
    const body = await request.json();
    const res = await fetch(`${KBS_URL}/rest/saveauspicio`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify(body),
    });

    if (!res.ok) return error(API_ERROR_CODES.INTERNAL, `Error externo: ${res.status}`, 502);
    const data = await res.json();
    return success(data);
  } catch (e) {
    return error(API_ERROR_CODES.INTERNAL, e instanceof Error ? e.message : "Error al grabar auspicio", 500);
  }
}
