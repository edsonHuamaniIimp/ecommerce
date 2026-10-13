import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { resolve, sep } from "path";
import { getStorage } from "@/lib/server/storage";
import { MIME_CONTENT_TYPES, MIME_CONTENT_TYPE_DEFAULT } from "@/lib/shared/constants";

export const runtime = "nodejs";

const UPLOADS_DIR = "public/uploads";

function contentTypeDe(nombre: string): string {
  const ext = nombre.split(".").pop()?.toLowerCase() ?? "";
  return MIME_CONTENT_TYPES[ext] ?? MIME_CONTENT_TYPE_DEFAULT;
}

/**
 * Sirve los archivos subidos (`/uploads/*`) a traves del puerto de storage
 * (S3 en prod; local/EFS = filesystem). Fallback al filesystem para los archivos
 * que aun no se hayan copiado a S3 durante la migracion.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string[] }> },
): Promise<NextResponse> {
  const { slug } = await context.params;
  const clave = slug.join("/");

  /* 1) Storage (S3 con STORAGE_PROVIDER=s3; filesystem con local). */
  try {
    const archivo = await getStorage().read(clave);
    if (archivo) {
      return new NextResponse(new Uint8Array(archivo.bytes), {
        headers: {
          "Content-Type": archivo.contentType ?? contentTypeDe(clave),
          "Cache-Control": "public, max-age=86400",
        },
      });
    }
  } catch {
    /* cae al filesystem local */
  }

  /* 2) Filesystem local (volumen EFS durante la transicion a S3). */
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
