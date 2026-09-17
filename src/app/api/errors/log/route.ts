import { getSession } from "@/lib/server/auth";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { errorLogger } from "@/lib/server/error-logger";
import type { Prisma } from "@prisma/client";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message: string;
      stack?: string;
      digest?: string;
      url?: string;
      metadata?: Prisma.InputJsonValue;
    };

    if (!body.message) {
      return error(API_ERROR_CODES.VALIDATION, "message requerido", 400);
    }

    const session = await getSession().catch(() => null);

    await errorLogger.log({
      message: body.message,
      stack: body.stack,
      digest: body.digest,
      url: body.url,
      userId: session?.sub ?? undefined,
      metadata: body.metadata,
    });

    return success({ ok: true });
  } catch {
    return error(API_ERROR_CODES.INTERNAL, "Error al registrar", 500);
  }
}
