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
      path?: string;
      userAgent?: string;
      metadata?: Prisma.InputJsonValue;
    };

    if (!body.message) {
      return error(API_ERROR_CODES.VALIDATION, "message requerido", 400);
    }

    const session = await getSession().catch(() => null);
    const metadata = {
      ...(body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : {}),
      ...(body.path ? { path: body.path } : {}),
      ...(body.userAgent ? { userAgent: body.userAgent } : {}),
    };

    await errorLogger.log({
      message: body.message,
      stack: body.stack,
      digest: body.digest,
      url: body.url,
      userId: session?.sub ?? undefined,
      metadata,
    });

    return success({ ok: true });
  } catch {
    return error(API_ERROR_CODES.INTERNAL, "Error al registrar", 500);
  }
}
