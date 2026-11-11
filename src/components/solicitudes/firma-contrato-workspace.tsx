"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@nrivera-iimp/ui-kit-iimp";
import {
  CheckCircle2,
  Eraser,
  Loader2,
  Maximize2,
  MousePointer2,
  PenLine,
  Stamp,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/use-confirm";
import { dateUtils } from "@/lib/shared/utils/date";
import { RepresentantesAdicionalesEditor } from "@/components/empresa/representantes-adicionales-editor";
import { portalEmpresaService } from "@/lib/client/api/services/portal-empresa-service";
import {
  erroresRepresentantesAdicionales,
  representanteAdicionalDesdeDTO,
  representanteAdicionalPayload,
  type RepresentanteAdicionalErrores,
  type RepresentanteAdicionalForm,
} from "@/lib/shared/utils/representantes-adicionales";

export interface FirmanteFirma {
  key: string;
  nombre: string;
  nombres?: string;
  apellidos?: string;
  rol: string;
  firmaUrl: string | null;
  principal: boolean;
}

type MetodoFirma = "cursor" | "sello";

export interface SelloVectorialEnvio {
  esSello: boolean;
  nombres: string;
  apellidos: string;
  fecha: string;
  imagen?: string;
  secciones: Array<{ pagina: number; x: number; y: number; w: number; h: number }>;
}

interface Props {
  contratoUrl: string;
  firmantes: FirmanteFirma[];
  pngOriginales?: Record<string, string>;
  onPendienteAutomatico?: (resume: () => void) => void;
  onRepresentantesActualizados?: () => Promise<void>;
  onFinalizar: (sellos: SelloVectorialEnvio[]) => Promise<void>;
  onFaltaFirma?: (key: string) => void;
  onClose: () => void;
}

interface FirmaSlot {
  pageNumber: number;
  x: number;
  y: number;
  w: number;
  h: number;
  signerIndex: number;
  tipo: "contrato" | "declaracion";
}

const PAGE_ANCHO_A4 = 595.28;
const PAGE_ALTO_A4 = 841.89;

interface PdfPreviewState {
  doc: PDFDocumentProxy;
  pages: number[];
  slots: FirmaSlot[];
}

function slotDesdeImagen(
  pageNumber: number,
  pageWidth: number,
  pageHeight: number,
  imagen: { x: number; y: number; w: number; h: number },
  signerIndex: number,
  tipo: FirmaSlot["tipo"],
): FirmaSlot {
  return {
    pageNumber,
    x: imagen.x / pageWidth,
    y: (pageHeight - imagen.y - imagen.h) / pageHeight,
    w: imagen.w / pageWidth,
    h: imagen.h / pageHeight,
    signerIndex,
    tipo,
  };
}

interface PaginaPdfTexto {
  pageNumber: number;
  width: number;
  height: number;
  items: Array<{ str: string; transform: number[] }>;
  imagenes: Array<{ x: number; y: number; w: number; h: number }>;
}

const OP_TRANSFORM = 12;
const OP_PAINT_IMAGE = 85;

function slotRespaldo(
  pageNumber: number,
  signerIndex: number,
  tipo: FirmaSlot["tipo"],
): FirmaSlot {
  const fila = Math.floor(signerIndex / 2);
  const columna = signerIndex % 2;
  return {
    pageNumber,
    x: (tipo === "contrato" ? 0.38 : 0.12) + columna * 0.25,
    y: (tipo === "contrato" ? 0.55 : 0.48) + fila * 0.11,
    w: 0.19,
    h: 0.05,
    signerIndex,
    tipo,
  };
}

async function detectarFirmas(doc: PDFDocumentProxy, cantidadFirmantes: number): Promise<{ pages: number[]; slots: FirmaSlot[] }> {
  const maxPages = Math.min(doc.numPages, 30);
  const paginas: PaginaPdfTexto[] = [];

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const text = await page.getTextContent();
    const items = text.items
      .filter((item) => "str" in item)
      .map((item) => {
        const textItem = item as { str: string; transform: number[] };
        return { str: textItem.str.trim(), transform: textItem.transform };
      });
    const ops = await page.getOperatorList();
    const imagenes: Array<{ x: number; y: number; w: number; h: number }> = [];
    for (let i = 0; i < ops.fnArray.length; i += 1) {
      if (ops.fnArray[i] !== OP_PAINT_IMAGE) continue;
      for (let j = i - 1; j >= Math.max(0, i - 4); j -= 1) {
        if (ops.fnArray[j] === OP_TRANSFORM) {
          const t = ops.argsArray[j] as number[];
          imagenes.push({ x: t[4] ?? 0, y: t[5] ?? 0, w: t[0] ?? 0, h: t[3] ?? 0 });
          break;
        }
      }
    }
    paginas.push({ pageNumber, width: viewport.width, height: viewport.height, items, imagenes });
  }

  const textoDe = (p: PaginaPdfTexto) => p.items.map((item) => item.str).join(" ");

  /*
   * Página del contrato: la tabla de firmas del contrato va justo después
   * de "Lima, {fecha}" y contiene al Gerente General del IIMP.
   * Página de la declaración: contiene "Nombre y cargo".
   */
  const contrato =
    paginas.find((p) => p.items.some((item) => /^lima,?\s+\d/i.test(item.str)))
    ?? paginas.find((p) => /de vinatea/i.test(textoDe(p)))
    ?? paginas.find((p) => p.imagenes.some((imagen) => imagen.x >= 100 && imagen.w < 300 && imagen.h < 120))
    ?? paginas[Math.min(paginas.length - 1, 1)];
  const declaracion =
    paginas.find((p) => /nombre y cargo|name and position/i.test(textoDe(p)))
    ?? paginas.find((p) => /declaraci[oó]n de cumplimiento/i.test(textoDe(p)))
    ?? paginas[Math.min(paginas.length - 1, 15)];

  const pageContrato = contrato?.pageNumber ?? Math.min(doc.numPages, 2);
  const pageDeclaracion = declaracion?.pageNumber ?? Math.min(doc.numPages, 16);

  const imagenesContrato = (contrato?.imagenes ?? [])
    .filter((imagen) => imagen.x >= 100 && imagen.w < 300 && imagen.h < 120)
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const imagenesDeclaracion = (declaracion?.imagenes ?? [])
    .filter((imagen) => imagen.w < 300 && imagen.h < 120)
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const slots: FirmaSlot[] = [];
  for (let index = 0; index < cantidadFirmantes; index += 1) {
    const imagenContrato = imagenesContrato[index] ?? imagenesContrato[imagenesContrato.length - 1];
    if (imagenContrato && contrato) {
      slots.push(slotDesdeImagen(pageContrato, contrato.width, contrato.height, imagenContrato, index, "contrato"));
    } else {
      slots.push(slotRespaldo(pageContrato, index, "contrato"));
    }

    const imagenDeclaracion = imagenesDeclaracion[index] ?? imagenesDeclaracion[imagenesDeclaracion.length - 1];
    if (imagenDeclaracion && declaracion) {
      slots.push(slotDesdeImagen(pageDeclaracion, declaracion.width, declaracion.height, imagenDeclaracion, index, "declaracion"));
    } else {
      slots.push(slotRespaldo(pageDeclaracion, index, "declaracion"));
    }
  }

  const pages = Array.from({ length: doc.numPages }, (_, index) => index + 1);
  return { pages, slots };
}
function PaginaPdf({
  doc,
  pageNumber,
  slots,
  firmantes,
  firmasPorSlot,
  firmanteSeleccionado,
  slotSiguiente,
  onSeleccionarFirmante,
  arrastrando,
  posiciones,
  onDropFirma,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  slots: FirmaSlot[];
  firmantes: FirmanteFirma[];
  firmasPorSlot: Record<string, string>;
  firmanteSeleccionado: string | null;
  slotSiguiente: string | null;
  onSeleccionarFirmante: (key: string) => void;
  arrastrando: boolean;
  posiciones: Record<string, { x: number; y: number }>;
  onDropFirma: (index: number, tipo: FirmaSlot["tipo"], x?: number, y?: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const nodo = contenedorRef.current;
    if (!nodo || visible) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) {
          setVisible(true);
          observador.disconnect();
        }
      },
      { root: null, rootMargin: "900px 0px", threshold: 0 },
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let activo = true;
    let renderTask: { cancel: () => void } | null = null;
    void doc.getPage(pageNumber).then((page) => {
      if (!activo) return;
      const viewport = page.getViewport({ scale: 1.25 });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) return;
      renderTask = page.render({ canvas, canvasContext: context, viewport }) as { cancel: () => void };
      return renderTask;
    });
    return () => {
      activo = false;
      renderTask?.cancel();
    };
  }, [doc, pageNumber, visible]);

  const slotsPagina = slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => slot.pageNumber === pageNumber);

  const soltarEnPagina = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (slotsPagina.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const cercano = slotsPagina.reduce((mejor, actual) => {
      const centroActual = {
        x: actual.slot.x + actual.slot.w / 2,
        y: actual.slot.y + actual.slot.h / 2,
      };
      const centroMejor = {
        x: mejor.slot.x + mejor.slot.w / 2,
        y: mejor.slot.y + mejor.slot.h / 2,
      };
      const distanciaActual = Math.hypot(x - centroActual.x, y - centroActual.y);
      const distanciaMejor = Math.hypot(x - centroMejor.x, y - centroMejor.y);
      return distanciaActual < distanciaMejor ? actual : mejor;
    });
    onDropFirma(cercano.slot.signerIndex, cercano.slot.tipo, x, y);
  };

  return (
      <div
        ref={contenedorRef}
        data-pagina={pageNumber}
        className={`relative mx-auto w-full overflow-hidden rounded-md border bg-white shadow-sm aspect-[595.32/841.92] ${
          arrastrando ? "border-primary ring-2 ring-primary/30" : "border-border"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={soltarEnPagina}
      >
      {visible ? (
        <canvas ref={canvasRef} className="h-full w-full" />
      ) : (
        <div className="h-full w-full bg-white" />
      )}
      {slotsPagina.map(({ slot, index }) => {
        const firmante = firmantes[slot.signerIndex];
        if (!firmante) return null;
        const activo = firmanteSeleccionado === firmante.key;
        const firmaUrl = firmasPorSlot[`${slot.signerIndex}:${slot.tipo}`] ?? null;
        const esSiguiente = slotSiguiente === `${slot.signerIndex}:${slot.tipo}`;
        const posicion = posiciones[`${slot.signerIndex}:${slot.tipo}`]
          ?? { x: slot.x + slot.w / 2, y: slot.y + slot.h / 2 };

        const soltar = (event: React.DragEvent<HTMLButtonElement>) => {
          event.preventDefault();
          event.stopPropagation();
          const rect = event.currentTarget.parentElement?.getBoundingClientRect();
          const x = rect ? (event.clientX - rect.left) / rect.width : undefined;
          const y = rect ? (event.clientY - rect.top) / rect.height : undefined;
          onDropFirma(slot.signerIndex, slot.tipo, x, y);
        };

        if (firmaUrl) {
          return (
            <button
              key={`${firmante.key}-${slot.tipo}-${index}`}
              type="button"
              onClick={() => onSeleccionarFirmante(firmante.key)}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
              }}
              onDrop={soltar}
              aria-label={`Firma de ${firmante.nombre}`}
              className="absolute z-10 border-0 bg-transparent p-0"
              style={{
                left: `${posicion.x * 100}%`,
                top: `${posicion.y * 100}%`,
                width: `${slot.w * 100}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <img
                src={firmaUrl}
                alt={`Firma de ${firmante.nombre}`}
                className="pointer-events-none h-auto w-full"
              />
            </button>
          );
        }

        return (
          <button
            key={`${firmante.key}-${slot.tipo}-${index}`}
            type="button"
            onClick={() => onSeleccionarFirmante(firmante.key)}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDrop={soltar}
            className={`absolute flex flex-col items-center justify-center overflow-hidden rounded-sm border-2 px-1 text-center transition-colors ${
              arrastrando || esSiguiente
                ? "border-solid border-primary bg-primary/10"
                : activo
                  ? "border-dashed border-primary/80 bg-primary/5"
                  : "border-dashed border-sky-500/50 bg-transparent"
            } ${esSiguiente ? "animate-pulse" : ""}`}
            style={{
              left: `${slot.x * 100}%`,
              top: `${slot.y * 100}%`,
              width: `${slot.w * 100}%`,
              height: `${slot.h * 100}%`,
            }}
          >
            <span className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground">Firma {slot.signerIndex + 1} · {slot.tipo === "declaracion" ? "Declaración" : "Contrato"}</span>
            <span className="line-clamp-1 text-[7px] font-medium leading-tight text-muted-foreground">{firmante.nombre}</span>
            <span className={`mt-0.5 rounded-full px-1 text-[7px] font-bold uppercase tracking-wide ${esSiguiente ? "bg-primary/15 text-primary" : "bg-sky-100/90 text-sky-800"}`}>
              {esSiguiente ? "Firma esta sección" : "Suelta aquí"}
            </span>
          </button>
        );
      })}
      <span className="pointer-events-none absolute bottom-2 right-3 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-medium text-white">
        {pageNumber}
      </span>
    </div>
  );
}

function crearSello(nombres: string, apellidos: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 440;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#1b365d";
  ctx.lineWidth = 10;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
  ctx.fillStyle = "#1b365d";
  ctx.textAlign = "center";
  ctx.font = "600 42px Arial, Helvetica, sans-serif";
  ctx.fillText("Firmado digitalmente por", canvas.width / 2, 114);
  ctx.font = "700 56px Arial, Helvetica, sans-serif";
  ctx.fillText((nombres || "-").trim().toUpperCase(), canvas.width / 2, 208, 1140);
  ctx.fillText((apellidos || "-").trim().toUpperCase(), canvas.width / 2, 280, 1140);
  ctx.font = "500 32px Arial, Helvetica, sans-serif";
  ctx.fillStyle = "#475569";
  ctx.fillText(dateUtils.formatDateTime(new Date()), canvas.width / 2, 362);
  return canvas.toDataURL("image/png");
}
function LienzoFirma({
  onCambio,
  tamano = "normal",
}: {
  onCambio: (hayTrazo: boolean, dataUrl: string) => void;
  tamano?: "normal" | "grande";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujandoRef = useRef(false);
  const hayTrazoRef = useRef(false);
  const [hayTrazo, setHayTrazo] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 640;
    canvas.height = 220;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
  }, []);

  const posicion = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const iniciar = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(event.pointerId);
    const p = posicion(event);
    dibujandoRef.current = true;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const mover = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dibujandoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const p = posicion(event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    hayTrazoRef.current = true;
    setHayTrazo(true);
  };

  const terminar = () => {
    dibujandoRef.current = false;
    const canvas = canvasRef.current;
    if (canvas && hayTrazoRef.current) {
      onCambio(true, canvas.toDataURL("image/png"));
    }
  };

  const limpiar = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hayTrazoRef.current = false;
    setHayTrazo(false);
    onCambio(false, "");
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        className={`w-full touch-none rounded-lg border-2 border-dashed border-border bg-white ${tamano === "grande" ? "h-[360px]" : "h-[190px]"}`}
        onPointerDown={iniciar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerCancel={terminar}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground">
          {hayTrazo ? "Firma capturada con el cursor" : "Usa el cursor para dibujar tu firma"}
        </span>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 rounded-full px-2.5 text-[10px]" onClick={limpiar}>
          <Eraser className="h-3 w-3" />
          <span>Limpiar</span>
        </Button>
      </div>
    </div>
  );
}

export function FirmaContratoWorkspace({
  contratoUrl,
  firmantes,
  pngOriginales,
  onPendienteAutomatico,
  onRepresentantesActualizados,
  onFinalizar,
  onFaltaFirma,
  onClose,
}: Props) {
  const { confirm, confirmDialog } = useConfirm();
  const [pdf, setPdf] = useState<PdfPreviewState | null>(null);
  const [cargandoPdf, setCargandoPdf] = useState(true);
  const [errorPdf, setErrorPdf] = useState<string | null>(null);
  const [firmanteKey, setFirmanteKey] = useState<string | null>(null);
  const [metodo, setMetodo] = useState<MetodoFirma>("cursor");
  const [modoElegido, setModoElegido] = useState<MetodoFirma | "automatico" | null>(null);
  const [lienzo, setLienzo] = useState<{ hayTrazo: boolean; dataUrl: string }>({ hayTrazo: false, dataUrl: "" });
  const [ampliarLienzoOpen, setAmpliarLienzoOpen] = useState(false);
  const [lienzoVersion, setLienzoVersion] = useState(0);
  const [repsOpen, setRepsOpen] = useState(false);
  const [repsSaving, setRepsSaving] = useState(false);
  const [repsForm, setRepsForm] = useState<RepresentanteAdicionalForm[]>([]);
  const [repsErrores, setRepsErrores] = useState<RepresentanteAdicionalErrores[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [cambiarFirmaOpen, setCambiarFirmaOpen] = useState(false);
  const [firmasSlots, setFirmasSlots] = useState<Record<string, string>>({});
  const [selloPorFirmante, setSelloPorFirmante] = useState<Record<string, boolean>>({});
  const continuarAutomaticoRef = useRef(false);
  const [posiciones, setPosiciones] = useState<Record<string, { x: number; y: number }>>({});
  const [error, setError] = useState<string | null>(null);

  const claveSlot = (index: number, tipo: FirmaSlot["tipo"]) => `${index}:${tipo}`;
  const firmaSlotDe = (index: number, tipo: FirmaSlot["tipo"]) => firmasSlots[claveSlot(index, tipo)] ?? null;
  const slotsDeFirmante = (index: number) =>
    (firmaSlotDe(index, "contrato") ? 1 : 0) + (firmaSlotDe(index, "declaracion") ? 1 : 0);
  const firmanteCompleto = (index: number) => slotsDeFirmante(index) === 2;
  const slotsFirmados = firmantes.reduce(
    (acc, _f, index) => acc + slotsDeFirmante(index),
    0,
  );
  const slotsTotales = firmantes.length * 2;
  const firmanteKeyEfectiva = firmanteKey && firmantes.some((f) => f.key === firmanteKey)
    ? firmanteKey
    : firmantes.find((_f, index) => !firmanteCompleto(index))?.key ?? firmantes[0]?.key ?? null;
  const firmanteIndex = firmantes.findIndex((f) => f.key === firmanteKeyEfectiva);
  const firmante = firmanteIndex >= 0 ? firmantes[firmanteIndex] ?? null : null;
  const firmasCompletas = firmantes.length > 0 && firmantes.every((_f, index) => firmanteCompleto(index));

  const siguienteSlot = (() => {
    const indice = firmanteIndex >= 0 ? firmanteIndex : firmantes.findIndex((_f, i) => !firmanteCompleto(i));
    if (indice < 0) return null;
    if (!firmaSlotDe(indice, "contrato")) return claveSlot(indice, "contrato");
    if (!firmaSlotDe(indice, "declaracion")) return claveSlot(indice, "declaracion");
    const siguiente = firmantes.findIndex((_f, i) => i !== indice && !firmanteCompleto(i));
    return siguiente >= 0 ? claveSlot(siguiente, "contrato") : null;
  })();
  const slotSiguienteInfo = pdf?.slots.find((slot) => `${slot.signerIndex}:${slot.tipo}` === siguienteSlot) ?? null;

  useEffect(() => {
    let activo = true;
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = await pdfjs.getDocument({ url: contratoUrl }).promise;
        if (!activo) {
          void doc.destroy();
          return;
        }
        const { pages, slots } = await detectarFirmas(doc, Math.max(1, firmantes.length));
        if (!activo) {
          void doc.destroy();
          return;
        }
        setPdf({ doc, pages, slots });
      } catch (err) {
        if (activo) setErrorPdf(err instanceof Error ? err.message : "No se pudo cargar el contrato.");
      } finally {
        if (activo) setCargandoPdf(false);
      }
    })();
    return () => {
      activo = false;
    };
  }, [contratoUrl, firmantes.length]);

  useEffect(() => {
    const doc = pdf?.doc;
    return () => {
      if (doc) void doc.destroy();
    };
  }, [pdf]);

  useEffect(() => {
    if (!pdf || !slotSiguienteInfo) return;
    const elemento = document.querySelector(`[data-pagina="${slotSiguienteInfo.pageNumber}"]`);
    elemento?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [slotSiguienteInfo, pdf]);

  const [selloUrl, setSelloUrl] = useState(() => {
    const inicial = firmantes.find((f) => !f.firmaUrl) ?? firmantes[0];
    return inicial ? crearSello(inicial.nombres?.trim() || inicial.nombre, inicial.apellidos?.trim() || "") : "";
  });

  const seleccionarFirmante = (key: string) => {
    const elegido = firmantes.find((f) => f.key === key);
    setFirmanteKey(key);
    if (elegido) {
      setSelloUrl(crearSello(elegido.nombres?.trim() || elegido.nombre, elegido.apellidos?.trim() || ""));
    }
  };

  const seleccionarSiguientePendiente = (desdeKey: string) => {
    const indice = firmantes.findIndex((f) => f.key === desdeKey);
    if (indice < 0) return;
    for (let k = 1; k <= firmantes.length; k += 1) {
      const i = (indice + k) % firmantes.length;
      const candidato = firmantes[i];
      if (!candidato) continue;
      if (candidato.key !== desdeKey && !firmanteCompleto(i)) {
        seleccionarFirmante(candidato.key);
        return;
      }
    }
  };

  const etiquetaSlot = (tipo: FirmaSlot["tipo"]) => (tipo === "declaracion" ? "Declaración" : "Contrato");

  const guardarFirmaPara = async (
    target: FirmanteFirma,
    tipoSlot: FirmaSlot["tipo"],
    dataUrl: string,
    metodo: MetodoFirma,
  ) => {
    if (!dataUrl || guardando) return;
    const indice = firmantes.findIndex((f) => f.key === target.key);
    const ok = await confirm({
      title: `Confirmar firma de ${target.nombre}`,
      description: `Vas a usar esta firma ${metodo === "cursor" ? "dibujada con el cursor" : "digital generada"} en la sección ${etiquetaSlot(tipoSlot)} del contrato. Verifica que sea correcta.`,
      confirmLabel: "Usar esta firma",
    });
    if (!ok) return;
    setGuardando(true);
    setError(null);
    try {
      const actualizado = { ...firmasSlots, [claveSlot(indice, tipoSlot)]: dataUrl };
      setFirmasSlots(actualizado);
      setSelloPorFirmante((prev) => ({ ...prev, [target.key]: metodo === "sello" }));
      toast.success(`Firma de ${target.nombre} registrada (${etiquetaSlot(tipoSlot)}).`);
      const completo = Boolean(actualizado[claveSlot(indice, "contrato")] && actualizado[claveSlot(indice, "declaracion")]);
      if (completo) seleccionarSiguientePendiente(target.key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la firma.");
    } finally {
      setGuardando(false);
    }
  };

  const elegirModo = (tipo: MetodoFirma) => {
    setModoElegido(tipo);
    setMetodo(tipo);
  };

  const solicitarCambioTipo = async () => {
    if (slotsFirmados > 0) {
      const ok = await confirm({
        title: "Cambiar tipo de firmado",
        description: `Se borrarán las ${slotsFirmados} sección(es) capturada(s) del ciclo actual.`,
        confirmLabel: "Cambiar tipo",
      });
      if (!ok) return;
      setFirmasSlots({});
      setPosiciones({});
      setSelloPorFirmante({});
      setLienzo({ hayTrazo: false, dataUrl: "" });
    }
    continuarAutomaticoRef.current = false;
    setModoElegido(null);
  };

  const abrirReps = async () => {
    setRepsOpen(true);
    setRepsErrores([]);
    try {
      const datos = await portalEmpresaService.misDatos();
      setRepsForm((datos.representantesAdicionales ?? []).map(representanteAdicionalDesdeDTO));
    } catch (err) {
      setRepsForm([]);
      setError(err instanceof Error ? err.message : "No se pudieron cargar los representantes.");
    }
  };

  const guardarReps = async () => {
    const errores = erroresRepresentantesAdicionales(repsForm);
    if (errores.some((e) => Object.keys(e).length > 0)) {
      setRepsErrores(errores);
      return;
    }
    setRepsSaving(true);
    setError(null);
    try {
      await portalEmpresaService.guardarRepresentantes(repsForm.map(representanteAdicionalPayload));
      await onRepresentantesActualizados?.();
      setFirmasSlots({});
      setPosiciones({});
      setSelloPorFirmante({});
      setLienzo({ hayTrazo: false, dataUrl: "" });
      setModoElegido(null);
      setRepsOpen(false);
      toast.success("Representantes actualizados. Contrato regenerado con los nuevos firmantes.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron actualizar los representantes.");
    } finally {
      setRepsSaving(false);
    }
  };

  const aplicarFirma = async () => {
    if (!firmante) return;
    const indice = firmantes.findIndex((f) => f.key === firmante.key);
    const pendientes = (["contrato", "declaracion"] as const).filter((tipo) => !firmaSlotDe(indice, tipo));
    if (pendientes.length === 0) {
      setError(`${firmante.nombre} ya firmó sus dos secciones.`);
      return;
    }
    const dataUrl = metodo === "cursor" ? lienzo.dataUrl : selloUrl;
    if (!dataUrl || (metodo === "cursor" && !lienzo.hayTrazo)) {
      setError("Dibuja tu firma con el cursor antes de continuar.");
      return;
    }
    const pendiente = pendientes[0];
    if (!pendiente) return;
    await guardarFirmaPara(firmante, pendiente, dataUrl, metodo);
  };

  const firmarAutomaticamente = async () => {
    if (finalizando || guardando) return;

    const firmantesAuto: FirmanteFirma[] = firmantes;
    if (slotsFirmados > 0) {
      const ok = await confirm({
        title: "Firmar automáticamente (PNG cargadas)",
        description: "Se borrarán las firmas capturadas en el ciclo (cursor o sello). El contrato se firmará únicamente con los PNG que subió el cliente. Si algún representante no tiene su PNG subido, deberás subirlo primero.",
        confirmLabel: "Borrar y continuar",
      });
      if (!ok) return;
      setFirmasSlots({});
      setPosiciones({});
      setSelloPorFirmante({});
      setLienzo({ hayTrazo: false, dataUrl: "" });
    }

    const sinPng = firmantesAuto.filter((f) => !(pngOriginales?.[f.key]));
    if (sinPng.length > 0) {
      setError(`Para firmar automáticamente, sube la firma PNG de: ${sinPng.map((f) => f.nombre).join(", ")}.`);
      continuarAutomaticoRef.current = true;
      setCambiarFirmaOpen(true);
      onPendienteAutomatico?.(reanudarAutomatico);
      return;
    }
    const ok = await confirm({
      title: "Firmar contrato automáticamente",
      description: (
        <>
          <span>Se estamparán las firmas PNG cargadas de {firmantesAuto.length} representante(s) (principal y adicionales) en las {slotsTotales} secciones del contrato, en los lugares que define la plantilla. No se usa la firma digital generada. La firma se ingresa de inmediato y esta acción NO se puede revertir.</span>
          <br />
          <br />
          <span>Firmas PNG que se usarán:</span>
          {firmantesAuto.map((f, indice) => (
            <span key={f.key}>
              <br />
              {indice + 1}. {f.nombre} — firma PNG cargada
              <img
                src={pngOriginales?.[f.key] ?? undefined}
                alt={`Firma de ${f.nombre}`}
                className="mt-1 h-16 max-w-full rounded border border-border bg-white object-contain"
              />
            </span>
          ))}
          <br />
          <span>¿Deseas cambiar dichas firmas?</span>
        </>
      ),
      confirmLabel: "Firmar definitivamente",
      cancelLabel: "Cambiar firmas",
    });
    if (!ok) {
      continuarAutomaticoRef.current = true;
      setCambiarFirmaOpen(true);
      onPendienteAutomatico?.(reanudarAutomatico);
      return;
    }
    setFinalizando(true);
    setError(null);
    try {
      await onFinalizar([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo firmar el contrato.");
    } finally {
      setFinalizando(false);
    }
  };

  const reanudarAutomatico = () => {
    continuarAutomaticoRef.current = false;
    setCambiarFirmaOpen(false);
    setError(null);
    void firmarAutomaticamente();
  };

  const soltarFirmaEnSlot = async (
    index: number,
    tipo: FirmaSlot["tipo"],
    x?: number,
    y?: number,
  ) => {
    const target = firmantes[index];
    setArrastrando(false);
    if (!target) return;
    if (x !== undefined && y !== undefined) {
      setPosiciones((prev) => ({ ...prev, [claveSlot(index, tipo)]: { x, y } }));
    }
    seleccionarFirmante(target.key);
    setMetodo("sello");
    await guardarFirmaPara(target, tipo, crearSello(target.nombres?.trim() || target.nombre, target.apellidos?.trim() || ""), "sello");
  };

  const construirSellos = (): SelloVectorialEnvio[] =>
    firmantes.map((f, index) => {
      const esSello = selloPorFirmante[f.key] === true;
      const slots = esSello ? (pdf?.slots ?? []).filter((slot) => slot.signerIndex === index) : [];
      const imagen = esSello
        ? undefined
        : firmaSlotDe(index, "contrato") ?? firmaSlotDe(index, "declaracion") ?? undefined;
      return {
        esSello,
        nombres: f.nombres?.trim() || f.nombre,
        apellidos: f.apellidos?.trim() || "",
        fecha: dateUtils.formatDateTime(new Date()),
        imagen,
        secciones: slots.map((slot) => ({
          pagina: slot.pageNumber,
          x: slot.x * PAGE_ANCHO_A4,
          y: (1 - (slot.y + slot.h)) * PAGE_ALTO_A4,
          w: slot.w * PAGE_ANCHO_A4,
          h: slot.h * PAGE_ALTO_A4,
        })),
      };
    });

  const finalizar = async () => {
    const sinFirma = firmantes.filter((_f, index) => !firmanteCompleto(index));
    if (sinFirma.length > 0) {
      setError(`Falta la firma de: ${sinFirma.map((f) => f.nombre).join(", ")}. Captúrala con cursor o sello antes de firmar.`);
      return;
    }
    const ok = await confirm({
      title: "Firmar contrato",
      description: `Las firmas se estamparán en las ${slotsTotales} secciones del contrato (páginas de firma del contrato y de la declaración). Confirma que las firmas son correctas.`,
      confirmLabel: "Firmar contrato",
    });
    if (!ok) return;
    setFinalizando(true);
    setError(null);
    try {
      await onFinalizar(construirSellos());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo firmar el contrato.");
    } finally {
      setFinalizando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !guardando && !finalizando) onClose(); }}>
      <DialogContent className="flex h-[96vh] max-h-[96vh] w-[98vw] max-w-[98vw] flex-col gap-0 overflow-hidden !p-0 sm:max-w-[98vw]">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-3 text-left">
          <div className={`flex items-start justify-between gap-4 pr-8 ${modoElegido === null ? "pointer-events-none opacity-40" : ""}`}>
            <div>
              <DialogTitle className="text-sm font-semibold text-foreground">Firma del contrato</DialogTitle>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Revisa el contrato y firma en las secciones marcadas. Hay {firmantes.length} firmante(s) y {slotsTotales} sección(es) por firmar.
              </p>
            </div>
            <Badge className="pointer-events-none shrink-0 gap-1 bg-primary/10 text-[10px] text-primary">
              <PenLine className="h-3 w-3" />
              <span>{slotsFirmados}/{slotsTotales} en preview</span>
            </Badge>
          </div>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[4fr_1fr]">
          <div className={`min-h-0 overflow-y-auto border-b border-border bg-secondary/30 p-4 lg:border-b-0 lg:border-r ${modoElegido === null ? "pointer-events-none opacity-30" : ""}`}>
            {cargandoPdf ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Cargando contrato...</span>
              </div>
            ) : errorPdf ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-destructive">{errorPdf}</div>
            ) : pdf ? (
              <div className="space-y-4">
                <p className="rounded-md border border-info/30 bg-info/10 px-3 py-2 text-[11px] text-muted-foreground">
                  Zonas de firma de referencia en las páginas {[...new Set(pdf.slots.map((slot) => slot.pageNumber))].sort((a, b) => a - b).join(" y ")}. El contrato incluye todas sus páginas (con anexos): arrastra el sello y suéltalo donde debe quedar; la firma se coloca en ese punto, no en el centro del recuadro.
                </p>
                {pdf.pages.map((pageNumber) => (
                  <PaginaPdf
                    key={pageNumber}
                    doc={pdf.doc}
                    pageNumber={pageNumber}
                    slots={pdf.slots}
                    firmantes={firmantes}
                    firmasPorSlot={firmasSlots}
                    firmanteSeleccionado={firmanteKeyEfectiva}
                    slotSiguiente={siguienteSlot}
                    onSeleccionarFirmante={seleccionarFirmante}
                    arrastrando={arrastrando}
                    posiciones={posiciones}
                    onDropFirma={(index, tipo, x, y) => { void soltarFirmaEnSlot(index, tipo, x, y); }}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <aside className="min-h-0 overflow-y-auto bg-background p-4">
            <div className="space-y-4">
              <div className={modoElegido === null ? "pointer-events-none opacity-40" : ""}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Firmantes</p>
                <div className="mt-2 space-y-1.5">
                  {firmantes.map((f, index) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => seleccionarFirmante(f.key)}
                      className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                        f.key === firmanteKeyEfectiva ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/60"
                      }`}
                    >
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${firmanteCompleto(index) ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {firmanteCompleto(index) ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-semibold text-foreground">{f.nombre}</span>
                        <span className="block truncate text-[9px] text-muted-foreground">{f.rol}</span>
                      </span>
                      <span className="shrink-0 text-[9px] font-semibold text-muted-foreground">{slotsDeFirmante(index)}/2</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-2 w-full text-left text-[10px] font-medium text-primary underline underline-offset-2"
                  onClick={() => { void abrirReps(); }}
                >
                  ¿Necesitas quitar o agregar un firmante adicional?
                </button>
              </div>

              {firmante && (
                <>
                  <div className={`rounded-lg border border-border bg-secondary/40 p-2.5 ${modoElegido === null ? "pointer-events-none opacity-40" : ""}`}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Firma seleccionada</p>
                    <p className="mt-1 text-xs font-semibold text-foreground">{firmante.nombre}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      Secciones firmadas: {slotsDeFirmante(firmanteIndex)}/2
                    </p>
                    {slotSiguienteInfo && (
                      <p className="mt-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-[10px] font-medium text-primary">
                        Siguiente: Firma {slotSiguienteInfo.signerIndex + 1} · {slotSiguienteInfo.tipo === "declaracion" ? "Declaración" : "Contrato"} (página {slotSiguienteInfo.pageNumber})
                      </p>
                    )}
                    {(firmaSlotDe(firmanteIndex, "contrato") ?? firmaSlotDe(firmanteIndex, "declaracion")) && (
                      <img
                        src={firmaSlotDe(firmanteIndex, "contrato") ?? firmaSlotDe(firmanteIndex, "declaracion") ?? ""}
                        alt={`Firma de ${firmante.nombre}`}
                        className="mt-2 h-12 w-full rounded border border-border bg-white object-contain"
                      />
                    )}
                  </div>

                  {modoElegido === null ? (
                    <div className="space-y-1.5 rounded-lg border border-primary/40 bg-primary/5 p-2 ring-2 ring-primary/40">
                      <p className="pb-0.5 text-center text-[9px] font-bold uppercase tracking-wide text-primary">
                        Paso 1: elige el tipo de firmado
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        className="h-9 w-full gap-1.5 text-[11px]"
                        onClick={() => elegirModo("cursor")}
                      >
                        <MousePointer2 className="h-3.5 w-3.5" />
                        <span>Con cursor</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-9 w-full gap-1.5 text-[11px]"
                        onClick={() => elegirModo("sello")}
                      >
                        <Stamp className="h-3.5 w-3.5" />
                        <span>Firma digital</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-9 w-full gap-1.5 text-[11px]"
                        disabled={guardando || finalizando}
                        onClick={() => {
                          setModoElegido("automatico");
                          void firmarAutomaticamente();
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Firmar automáticamente</span>
                      </Button>
                    </div>
                  ) : modoElegido === "automatico" ? (
                    <p className="rounded-md border border-primary/30 bg-primary/5 px-2.5 py-2 text-center text-[10px] text-primary">
                      Modo seleccionado: Firmar automáticamente (usa los PNG subidos).
                    </p>
                  ) : (
                    <>
                      {metodo === "cursor" ? (
                        <div className="space-y-2 rounded-lg border-2 border-primary/40 bg-primary/5 p-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[9px] font-bold uppercase tracking-wide text-primary">
                              Paso 2 · Dibuja tu firma con el cursor
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 shrink-0 gap-1 rounded-full px-2.5 text-[10px]"
                              onClick={() => setAmpliarLienzoOpen(true)}
                            >
                              <Maximize2 className="h-3 w-3" />
                              <span>Ampliar</span>
                            </Button>
                          </div>
                          {lienzo.hayTrazo ? (
                            <img
                              src={lienzo.dataUrl}
                              alt="Firma capturada con el cursor"
                              className="h-[190px] w-full rounded-lg border border-border bg-white object-contain"
                            />
                          ) : (
                            <LienzoFirma
                              key={lienzoVersion}
                              onCambio={(hayTrazo, dataUrl) => setLienzo({ hayTrazo, dataUrl })}
                            />
                          )}
                          {lienzo.hayTrazo && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-medium text-primary">Firma capturada con el cursor</span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 shrink-0 gap-1 rounded-full px-2.5 text-[10px]"
                                onClick={() => {
                                  setLienzo({ hayTrazo: false, dataUrl: "" });
                                  setLienzoVersion((v) => v + 1);
                                }}
                              >
                                <Eraser className="h-3 w-3" />
                                <span>Limpiar</span>
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <img
                            src={selloUrl}
                            alt={`Sello digital de ${firmante.nombre}`}
                            draggable
                            onDragStart={(event) => {
                              setArrastrando(true);
                              event.dataTransfer.effectAllowed = "copy";
                              event.dataTransfer.setData("text/plain", firmante.key);
                              const imagen = event.currentTarget;
                              event.dataTransfer.setDragImage(imagen, imagen.offsetWidth / 2, imagen.offsetHeight / 2);
                            }}
                            onDragEnd={() => setArrastrando(false)}
                            className="w-full cursor-grab select-none rounded-lg border-2 border-primary/40 bg-white active:cursor-grabbing"
                            title="Arrastra este sello a una zona de firma del contrato"
                          />
                          <p className="rounded-md border border-primary/30 bg-primary/5 px-2 py-1.5 text-[10px] font-medium text-primary">
                            Arrastra este rectángulo y suéltalo en cualquier parte del contrato; se ajustará a la firma más cercana.
                          </p>
                        </div>
                      )}

                      <Button
                        type="button"
                        className="w-full gap-1.5 text-xs"
                        disabled={guardando || (metodo === "cursor" && !lienzo.hayTrazo)}
                        onClick={() => { void aplicarFirma(); }}
                      >
                        {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenLine className="h-3.5 w-3.5" />}
                        <span>
                          {guardando
                            ? "Guardando..."
                            : !firmaSlotDe(firmanteIndex, "contrato")
                              ? "Usar esta firma en: Contrato"
                              : !firmaSlotDe(firmanteIndex, "declaracion")
                                ? "Usar esta firma en: Declaración"
                                : "Usar esta firma"}
                        </span>
                      </Button>
                    </>
                  )}

                  {modoElegido !== null && (
                    <button
                      type="button"
                      disabled={guardando || finalizando}
                      className="w-full text-center text-[10px] font-medium text-primary underline underline-offset-2 disabled:opacity-50"
                      onClick={() => { void solicitarCambioTipo(); }}
                    >
                      ¿Necesitas cambiar de tipo de firmado?
                    </button>
                  )}
                </>
              )}

              {error && <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-[11px] text-destructive">{error}</p>}

              {modoElegido !== null && modoElegido !== "automatico" && (
                <div className="border-t border-border pt-3">
                  <Button
                    type="button"
                    className="w-full gap-1.5 text-xs"
                    disabled={!firmasCompletas || finalizando}
                    onClick={() => { void finalizar(); }}
                  >
                    {finalizando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    <span>{finalizando ? "Firmando..." : "Firmar contrato"}</span>
                  </Button>
                  {!firmasCompletas && (
                    <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                      Faltan {slotsTotales - slotsFirmados} sección(es) para continuar.
                    </p>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>

        <DialogFooter className="shrink-0 border-t border-border px-5 py-3 sm:justify-between">
          <p className="text-[10px] text-muted-foreground">
            El contrato se firmará solo cuando todas las firmas estén registradas.
          </p>
          <Button type="button" variant="outline" size="sm" className="text-xs" disabled={guardando || finalizando} onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>

      <Dialog open={repsOpen} onOpenChange={(open) => { if (!repsSaving) setRepsOpen(open); }}>
        <DialogContent className="overflow-hidden rounded-xl border-border sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Representantes adicionales</DialogTitle>
          </DialogHeader>
          {repsSaving ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm font-semibold text-foreground">Recreando el contrato...</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Se está regenerando el contrato para adaptarse a la cantidad de representantes legales. Esto puede tardar unos segundos.
              </p>
            </div>
          ) : (
            <>
              <div className="max-h-[60vh] overflow-y-auto pr-1">
                <RepresentantesAdicionalesEditor
                  value={repsForm}
                  onChange={setRepsForm}
                  errores={repsErrores}
                />
              </div>
              <DialogFooter className="gap-2 sm:justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => setRepsOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" size="sm" onClick={() => { void guardarReps(); }}>
                  Guardar representantes
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={ampliarLienzoOpen} onOpenChange={setAmpliarLienzoOpen}>
        <DialogContent className="overflow-hidden rounded-xl border-border sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dibuja tu firma</DialogTitle>
          </DialogHeader>
          <LienzoFirma
            tamano="grande"
            onCambio={(hayTrazo, dataUrl) => setLienzo({ hayTrazo, dataUrl })}
          />
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAmpliarLienzoOpen(false)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cambiarFirmaOpen} onOpenChange={setCambiarFirmaOpen}>
        <DialogContent className="overflow-hidden rounded-xl border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar firmas de representantes</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            <p className="text-xs text-muted-foreground">
              Sube la firma PNG de cada representante. Cuando termines, cierra esta ventana y vuelve a pulsar Firmar automáticamente.
            </p>
            {firmantes.map((f) => {
              const png = pngOriginales?.[f.key];
              return (
              <div key={f.key} className="flex min-w-0 items-center gap-3 rounded-lg border border-border p-2.5">
                {png ? (
                  <img
                    src={png}
                    alt={`Firma de ${f.nombre}`}
                    className="h-12 w-24 shrink-0 overflow-hidden rounded border border-border bg-white object-contain"
                  />
                ) : (
                  <span className="flex h-12 w-24 shrink-0 items-center justify-center rounded border border-dashed border-border text-[9px] text-muted-foreground">
                    Sin firma
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-foreground">{f.nombre}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">{f.rol}</span>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-[10px]"
                  onClick={() => onFaltaFirma?.(f.key)}
                >
                  {png ? "Cambiar firma" : "Subir firma"}
                </Button>
              </div>
              );
            })}
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (continuarAutomaticoRef.current && firmantes.every((f) => Boolean(pngOriginales?.[f.key]))) {
                  reanudarAutomatico();
                  return;
                }
                setCambiarFirmaOpen(false);
              }}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </Dialog>
  );
}
