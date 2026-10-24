"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@nrivera-iimp/ui-kit-iimp";
import { ArrowLeft, CheckCircle2, Download, FileText, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { debidaDiligenciaService } from "@/lib/client/api/services/debida-diligencia-service";
import {
  BYTES_POR_MB,
  DD_DOCUMENTO_ACCEPT_VIGENCIA,
  DD_DOCUMENTO_MAX_BYTES,
  DD_DOCUMENTO_VIGENCIA,
  DD_DOCUMENTOS,
  DD_RUTAS,
} from "@/lib/shared/constants";
import { ddArchivoUtils } from "@/lib/shared/utils/debida-diligencia-archivo";
import { dateUtils } from "@/lib/shared/utils/date";
import type { DdExpedienteDTO } from "@/types/dto/debida-diligencia";

function ContenidoRegularizacion() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const expedienteId = searchParams.get("expedienteId") ?? "";
  const inputRef = useRef<HTMLInputElement>(null);
  const [expediente, setExpediente] = useState<DdExpedienteDTO | null>(null);
  const [loading, setLoading] = useState(Boolean(expedienteId));
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    if (!expedienteId) return;
    let activo = true;
    debidaDiligenciaService
      .detalle(expedienteId)
      .then((data) => {
        if (activo) setExpediente(data);
      })
      .catch((error) => {
        if (activo) {
          toast.error(error instanceof Error ? error.message : "No se pudo cargar la DD");
        }
      })
      .finally(() => {
        if (activo) setLoading(false);
      });
    return () => {
      activo = false;
    };
  }, [expedienteId]);

  const yaCargada = expediente?.documentos.some(
    (documento) => documento.tipo === DD_DOCUMENTOS.DECLARACION_VIGENCIA,
  );

  const seleccionarArchivo = async (file: File) => {
    if (!expediente) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const error = ddArchivoUtils.validar(
      { nombre: file.name, size: bytes.byteLength, bytes },
      { soloPdf: true },
    );
    if (error) {
      toast.error(error);
      return;
    }

    setSubiendo(true);
    try {
      const subido = await debidaDiligenciaService.subirDocumento(
        DD_DOCUMENTOS.DECLARACION_VIGENCIA,
        file,
      );
      await debidaDiligenciaService.regularizarVigencia({
        expedienteId: expediente.id,
        nombre: subido.nombre,
        url: subido.url,
      });
      toast.success("Declaración de vigencia cargada");
      router.push(DD_RUTAS.BASE);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar la declaración");
    } finally {
      setSubiendo(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-96 w-full rounded-xl" />;
  }

  if (!expedienteId || !expediente) {
    return (
      <Card>
        <CardContent className="space-y-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No se encontró la debida diligencia para regularizar.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href={DD_RUTAS.BASE}>Volver a Mi debida diligencia</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">
          Paso 4 · Documentos
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
          Declaración jurada de vigencia de información
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {expediente.empresa.razonSocial} · {expediente.evento.nombre}
        </p>
      </div>

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-base font-bold text-primary">
            {DD_DOCUMENTO_VIGENCIA.titulo}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{DD_DOCUMENTO_VIGENCIA.ayuda}</p>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
            <p>
              DD {expediente.codigo} · Vigente hasta{" "}
              <strong className="text-foreground">
                {dateUtils.format(expediente.fechaVencimiento)}
              </strong>
            </p>
          </div>

          {yaCargada ? (
            <div className="flex items-start gap-2 rounded-lg border border-success/40 bg-success/5 p-3 text-xs text-success">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>La declaración de vigencia ya está cargada en esta DD.</span>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
                  <a href={DD_DOCUMENTO_VIGENCIA.formatoUrl} download>
                    <Download className="h-3.5 w-3.5" />
                    <span>Descargar formato</span>
                  </a>
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  Solo PDF. Máximo {DD_DOCUMENTO_MAX_BYTES / BYTES_POR_MB} MB.
                </span>
              </div>

              <input
                ref={inputRef}
                type="file"
                accept={DD_DOCUMENTO_ACCEPT_VIGENCIA}
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void seleccionarArchivo(file);
                }}
              />
              <Button
                type="button"
                className="gap-1.5"
                disabled={subiendo}
                onClick={() => inputRef.current?.click()}
              >
                {subiendo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                <span>{subiendo ? "Cargando..." : "Subir declaración de vigencia"}</span>
              </Button>
            </>
          )}

          <div className="flex items-center gap-2 border-t border-border pt-3">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
              <Link href={DD_RUTAS.BASE}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Volver a Mi debida diligencia
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DeclaracionVigenciaPage() {
  return (
    <main className="flex-1 py-6">
      <div className="mx-auto w-full max-w-3xl">
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
          <ContenidoRegularizacion />
        </Suspense>
      </div>
    </main>
  );
}
