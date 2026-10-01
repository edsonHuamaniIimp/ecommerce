"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { planoVisitaCache } from "@/lib/client/stores/plano-visita-cache";

/** Renderiza la pagina 1 de un PDF a canvas (sin el chrome del visor nativo). */
export function PdfCanvas({ url, className, alt = "Documento PDF", onListo, onError }: {
  url: string;
  className?: string;
  alt?: string;
  onListo?: (anchoAlto?: number) => void;
  onError?: () => void;
}) {
  const contRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<{ url: string; promise: Promise<PDFDocumentProxy> } | null>(null);
  const onListoRef = useRef(onListo);
  const onErrorRef = useRef(onError);
  const [ancho, setAncho] = useState(0);
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");
  const [algunaVez, setAlgunaVez] = useState(false);

  useEffect(() => { onListoRef.current = onListo; }, [onListo]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    const cont = contRef.current;
    if (!cont) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      if (w <= 0) return;
      setAncho((prev) => (Math.abs(w - prev) > 1 ? w : prev));
    });
    ro.observe(cont);
    return () => ro.disconnect();
  }, []);

  // El documento queda cacheado a nivel de sesion: al volver al macro no se re-descarga ni se re-parsea.
  useEffect(() => {
    if (!ancho) return;
    let cancelado = false;
    let tarea: { cancel: () => void } | null = null;

    void (async () => {
      try {
        setEstado("cargando");
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        if (!docRef.current || docRef.current.url !== url) {
          let promesa = planoVisitaCache.pdfObtener(url);
          if (!promesa) {
            promesa = pdfjs.getDocument({ url }).promise;
            planoVisitaCache.pdfMarcar(url, promesa);
          }
          docRef.current = { url, promise: promesa };
        }
        const documento = await docRef.current.promise;
        const pagina = await documento.getPage(1);
        if (cancelado) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const base = pagina.getViewport({ scale: 1 });
        const viewport = pagina.getViewport({ scale: ancho / base.width });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const render = pagina.render({
          canvas,
          canvasContext: ctx,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        });
        tarea = render;
        await render.promise;
        if (!cancelado) {
          setEstado("listo");
          setAlgunaVez(true);
          onListoRef.current?.(viewport.width / viewport.height);
        }
      } catch {
        if (!cancelado) {
          setEstado("error");
          onErrorRef.current?.();
        }
      }
    })();

    return () => {
      cancelado = true;
      tarea?.cancel();
    };
  }, [url, ancho]);

  return (
    <div ref={contRef} className={className}>
      {estado === "error" ? (
        <p className="flex h-40 items-center justify-center p-4 text-center text-xs text-muted-foreground">
          No se pudo renderizar el PDF.
        </p>
      ) : (
        <>
          {estado === "cargando" && !algunaVez && (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          <canvas
            ref={canvasRef}
            aria-label={alt}
            role="img"
            className={`block h-auto w-full ${estado === "listo" || algunaVez ? "" : "hidden"}`}
          />
        </>
      )}
    </div>
  );
}
