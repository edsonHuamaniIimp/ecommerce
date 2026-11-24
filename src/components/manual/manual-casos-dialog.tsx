"use client";

import { useState } from "react";
import Image from "next/image";
import { BookOpen, ExternalLink, Lightbulb } from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@nrivera-iimp/ui-kit-iimp";
import { MANUAL_CASOS_ORDEN, type ManualCaso } from "@/lib/shared/constants";
import { MANUALES_COMPLETOS, MANUALES_POR_CASO } from "./manual-casos-contenido";

/** Ancho/alto nominal de las capturas (1440x1000 recortadas); next/image necesita un tamano base. */
const CAPTURA_ANCHO = 1440;
const CAPTURA_ALTO = 900;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Casos que aplican a la solicitud (vacio = indice general). */
  casos: readonly ManualCaso[];
  /** Referencia para el titulo (stands de la solicitud). */
  referencia?: string | null;
}

/**
 * Manual contextual de "Mis reservas": abre directamente la guia del caso de la solicitud
 * (observacion del Asociado o del area legal, firma, pago...) con capturas paso a paso, y
 * permite consultar el resto de manuales.
 */
export function ManualCasosDialog({ open, onOpenChange, casos, referencia }: Props) {
  const otros = MANUAL_CASOS_ORDEN.filter((c) => !casos.includes(c));
  const [seleccionado, setSeleccionado] = useState<ManualCaso>(casos[0] ?? MANUAL_CASOS_ORDEN[0]!);
  const activo = casos.includes(seleccionado) || otros.includes(seleccionado) ? seleccionado : casos[0] ?? MANUAL_CASOS_ORDEN[0]!;
  const manual = MANUALES_POR_CASO[activo];

  const BotonCaso = ({ caso, destacado }: { caso: ManualCaso; destacado: boolean }) => (
    <Button
      type="button"
      variant={caso === activo ? "default" : "ghost"}
      size="sm"
      className={`h-auto w-full justify-start whitespace-normal px-2.5 py-2 text-left text-xs ${destacado && caso !== activo ? "font-semibold" : ""}`}
      onClick={() => setSeleccionado(caso)}
    >
      <span>{MANUALES_POR_CASO[caso].titulo}</span>
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:w-full">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" />
            <span>{casos.length > 0 ? "Manual para tu solicitud" : "Manuales de ayuda"}</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            {casos.length > 0
              ? `Guía paso a paso según el estado de tu solicitud${referencia ? ` (stands ${referencia})` : ""}.`
              : "Elige el caso que necesitas consultar."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <nav className="max-h-40 shrink-0 space-y-3 overflow-y-auto border-b border-border p-3 md:max-h-none md:w-64 md:border-b-0 md:border-r">
            {casos.length > 0 && (
              <div className="space-y-1">
                <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-primary">Para tu solicitud</p>
                {casos.map((c) => <BotonCaso key={c} caso={c} destacado />)}
              </div>
            )}
            <div className="space-y-1">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {casos.length > 0 ? "Otros casos" : "Casos"}
              </p>
              {otros.map((c) => <BotonCaso key={c} caso={c} destacado={false} />)}
            </div>
            <div className="space-y-1">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Manuales completos</p>
              {MANUALES_COMPLETOS.map((m) => (
                <Button key={m.href} asChild variant="ghost" size="sm" className="h-auto w-full justify-start gap-1.5 px-2.5 py-1.5 text-xs">
                  <a href={m.href} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span>{m.label}</span>
                  </a>
                </Button>
              ))}
            </div>
          </nav>

          <article className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto p-5">
            <div className="space-y-1.5">
              <Badge className="pointer-events-none border-primary/20 bg-primary/10 text-[10px] text-primary">
                <span>{manual.origen}</span>
              </Badge>
              <h3 className="text-base font-semibold text-foreground">{manual.titulo}</h3>
              <p className="text-sm text-muted-foreground">{manual.resumen}</p>
            </div>

            <ol className="space-y-4">
              {manual.pasos.map((paso, i) => (
                <li key={`${manual.caso}-${i}`} className="space-y-2">
                  <p className="flex gap-2 text-sm text-foreground">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                      {i + 1}
                    </span>
                    <span>{paso.texto}</span>
                  </p>
                  {paso.imagen && (
                    <a href={paso.imagen} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-border">
                      <Image
                        src={paso.imagen}
                        alt={paso.alt ?? paso.texto}
                        width={CAPTURA_ANCHO}
                        height={CAPTURA_ALTO}
                        className="h-auto w-full"
                        unoptimized
                      />
                    </a>
                  )}
                </li>
              ))}
            </ol>

            {manual.importante.length > 0 && (
              <div className="space-y-1 rounded-lg border border-warning/40 bg-warning/10 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Lightbulb className="h-3.5 w-3.5 text-warning" />
                  <span>Importante</span>
                </p>
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-foreground">
                  {manual.importante.map((t) => <li key={t}>{t}</li>)}
                </ul>
              </div>
            )}

            {manual.manualCompleto && (
              <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-full text-xs">
                <a href={manual.manualCompleto.href} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3 w-3" />
                  <span>{manual.manualCompleto.label}</span>
                </a>
              </Button>
            )}
          </article>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Icono de manual para la tarjeta de una solicitud; resalta cuando hay un caso que atender. */
export function ManualCasosBoton({
  casos,
  referencia,
}: {
  casos: readonly ManualCaso[];
  referencia?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const hayCaso = casos.length > 0;
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={hayCaso ? "Manual para esta solicitud" : "Manuales de ayuda"}
            className={`relative h-8 w-8 shrink-0 p-0 ${hayCaso ? "border-primary/40 text-primary" : ""}`}
            onClick={() => setOpen(true)}
          >
            <BookOpen className="h-4 w-4" />
            {hayCaso && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <span>{hayCaso ? `Manual: ${MANUALES_POR_CASO[casos[0]!].titulo}` : "Manuales de ayuda"}</span>
        </TooltipContent>
      </Tooltip>
      {open && <ManualCasosDialog open={open} onOpenChange={setOpen} casos={casos} referencia={referencia} />}
    </>
  );
}

/** Boton "Manuales" del encabezado: abre el indice de todos los casos. */
export function ManualesAyudaBoton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <BookOpen className="h-4 w-4" />
        <span>Manuales</span>
      </Button>
      {open && <ManualCasosDialog open={open} onOpenChange={setOpen} casos={[]} />}
    </>
  );
}
