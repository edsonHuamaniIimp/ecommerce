import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { resolve, sep } from "path";
import { getSession } from "@/lib/server/auth";
import { validarIntegracionM2M } from "@/lib/server/integracion-m2m";
import { getStorage } from "@/lib/server/storage";
import { decidirAccesoUpload, requiereEmpresaDelUsuario, uploadsProtegidosActivo } from "@/lib/server/uploads-acceso";
import { clasificarArchivoDd, empresaIdDeUsuario } from "@/infrastructure/persistence/dd-archivo-acceso-repository";
import { MIME_CONTENT_TYPES, MIME_CONTENT_TYPE_DEFAULT } from "@/lib/shared/constants";

export const runtime = "nodejs";

const UPLOADS_DIR = "public/uploads";

/** Cabeceras comunes; los documentos de DD no se guardan en caches compartidas (CDN, proxies). */
function cabeceras(contentType: string, privado: boolean): Record<string, string> {
  return {
    "Content-Type": contentType,
    "Cache-Control": privado ? "private, no-store" : "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  };
}

/**
 * Control de acceso de los documentos de Debida Diligencia (solo con `UPLOADS_PROTEGIDOS=true`).
 * Cualquier otro archivo sigue siendo publico. Ante un fallo de la consulta se deniega (nunca se filtra).
 */
async function verificarAcceso(request: Request, clave: string): Promise<{ privado: boolean; respuesta?: NextResponse }> {
  if (!uploadsProtegidosActivo()) return { privado: false };
  try {
    const clasificacion = await clasificarArchivoDd(clave);
    if (clasificacion.tipo === "ninguno") return { privado: false };
    const session = await getSession();
    const empresaIdUsuario =
      session && requiereEmpresaDelUsuario(clasificacion, session) ? await empresaIdDeUsuario(session.email) : null;
    const decision = decidirAccesoUpload(clasificacion, { session, m2m: validarIntegracionM2M(request), empresaIdUsuario });
    if (decision.permitido) return { privado: true };
    return {
      privado: true,
      respuesta: new NextResponse(decision.status === 401 ? "No autorizado" : "Sin acceso", {
        status: decision.status,
        headers: { "Cache-Control": "private, no-store" },
      }),
    };
  } catch {
    return { privado: true, respuesta: new NextResponse("No disponible", { status: 503, headers: { "Cache-Control": "private, no-store" } }) };
  }
}

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
  request: Request,
  context: { params: Promise<{ slug: string[] }> },
): Promise<NextResponse> {
  const { slug } = await context.params;
  const clave = slug.join("/");

  const { privado, respuesta } = await verificarAcceso(request, clave);
  if (respuesta) return respuesta;

  /* 1) Storage (S3 con STORAGE_PROVIDER=s3; filesystem con local). */
  try {
    const archivo = await getStorage().read(clave);
    if (archivo) {
      return new NextResponse(new Uint8Array(archivo.bytes), {
        headers: cabeceras(archivo.contentType ?? contentTypeDe(clave), privado),
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
      headers: cabeceras(contentTypeDe(filePath), privado),
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
