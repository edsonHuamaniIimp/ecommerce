import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { resolve, sep } from "path";
import { MIME_CONTENT_TYPES, MIME_CONTENT_TYPE_DEFAULT } from "@/lib/shared/constants";

export const runtime = "nodejs";

const UPLOADS_DIR = "public/uploads";

function contentTypeDe(nombre: string): string {
  const ext = nombre.split(".").pop()?.toLowerCase() ?? "";
  return MIME_CONTENT_TYPES[ext] ?? MIME_CONTENT_TYPE_DEFAULT;
}

/**
 * Sirve los archivos subidos (`/uploads/*`) leyendolos del filesystem.
 * Necesario en el contenedor ECS: el server standalone de Next no sirve archivos
 * PUBLICOS agregados en runtime (p. ej. el volumen EFS en `public/uploads`).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string[] }> },
): Promise<NextResponse> {
  const { slug } = await context.params;
  const base = resolve(process.cwd(), UPLOADS_DIR);
  const filePath = resolve(base, ...slug);

  if (filePath !== base && !filePath.startsWith(base + sep)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const data = await readFile(filePath);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentTypeDe(filePath),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
