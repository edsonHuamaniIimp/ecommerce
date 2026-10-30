"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@nrivera-iimp/ui-kit-iimp";
import { CheckCircle2, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { TelefonoInput } from "@/components/shared/telefono-input";
import { sunatService } from "@/lib/client/api/services/sunat-service";
import { MAX_REPRESENTANTES_ADICIONALES, TIPOS_DOCUMENTO_PERSONA, TIPOS_DOCUMENTO_PERSONA_LABELS } from "@/lib/shared/constants";
import {
  representanteAdicionalVacio,
  type RepresentanteAdicionalErrores,
  type RepresentanteAdicionalForm,
} from "@/lib/shared/utils/representantes-adicionales";

interface Props {
  value: RepresentanteAdicionalForm[];
  onChange: (value: RepresentanteAdicionalForm[]) => void;
  errores?: RepresentanteAdicionalErrores[];
  titulo?: string;
  descripcion?: string;
  max?: number;
  ocultarEncabezado?: boolean;
}

const INPUT = "h-9 text-xs";

function Error({ mensaje }: { mensaje?: string }) {
  return mensaje ? <p className="text-[10px] font-medium text-destructive">{mensaje}</p> : null;
}

function FilaRepresentante({
  rep,
  indice,
  error,
  onCambio,
  onQuitar,
}: {
  rep: RepresentanteAdicionalForm;
  indice: number;
  error: RepresentanteAdicionalErrores;
  onCambio: (cambio: Partial<RepresentanteAdicionalForm>) => void;
  onQuitar: () => void;
}) {
  const [consultando, setConsultando] = useState(false);
  const [validado, setValidado] = useState(false);
  const nombreRef = useRef(rep.nombre);
  const cambioRef = useRef(onCambio);

  useEffect(() => { nombreRef.current = rep.nombre; }, [rep.nombre]);
  useEffect(() => { cambioRef.current = onCambio; }, [onCambio]);

  useEffect(() => {
    const documento = rep.documento.trim();
    if (rep.tipoDocumento !== TIPOS_DOCUMENTO_PERSONA.DNI || !/^\d{8}$/.test(documento)) return;
    let vigente = true;
    void (async () => {
      setConsultando(true);
      setValidado(false);
      try {
        const r = await sunatService.consultarDni(documento);
        if (!vigente) return;
        if (r?.nombreCompleto && !nombreRef.current.trim()) {
          cambioRef.current({ nombre: r.nombreCompleto });
        }
        setValidado(Boolean(r?.nombreCompleto));
      } finally {
        if (vigente) setConsultando(false);
      }
    })();
    return () => { vigente = false; };
  }, [rep.tipoDocumento, rep.documento]);

  const esDni = rep.tipoDocumento === TIPOS_DOCUMENTO_PERSONA.DNI;

  return (
    <div className="min-w-0 space-y-2 rounded-lg border border-border bg-secondary/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-foreground">Representante adicional {indice + 1}</p>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-destructive" onClick={onQuitar}>
          <Trash2 className="mr-1 h-3 w-3" />
          <span>Quitar</span>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-1">
          <Label htmlFor={`rep-adicional-tipo-${indice}`} className="text-[11px] font-medium text-muted-foreground"><span>Tipo de documento</span> <span className="text-destructive">*</span></Label>
          <Select value={rep.tipoDocumento} onValueChange={(v) => { setValidado(false); onCambio({ tipoDocumento: v, documento: "" }); }}>
            <SelectTrigger id={`rep-adicional-tipo-${indice}`} className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.values(TIPOS_DOCUMENTO_PERSONA).map((tipo) => (
                <SelectItem key={tipo} value={tipo}><span>{TIPOS_DOCUMENTO_PERSONA_LABELS[tipo] ?? tipo}</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`rep-adicional-doc-${indice}`} className="text-[11px] font-medium text-muted-foreground"><span>Numero de documento</span> <span className="text-destructive">*</span></Label>
          <Input
            id={`rep-adicional-doc-${indice}`}
            className={`font-mono ${INPUT}`}
            maxLength={esDni ? 8 : 15}
            value={rep.documento}
            onChange={(e) => onCambio({
              documento: e.target.value.replace(esDni ? /\D/g : /[^0-9A-Za-z]/g, "").slice(0, esDni ? 8 : 15),
            })}
          />
          <Error mensaje={error.documento} />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] font-medium text-muted-foreground"><span>Busqueda RENIEC</span></Label>
          <div className="flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-[11px] text-muted-foreground">
            {consultando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : validado ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Search className="h-3.5 w-3.5" />}
            <span>{!esDni ? "Solo DNI" : consultando ? "Buscando..." : validado ? "Validado" : "Automatica"}</span>
          </div>
          {validado && <p className="text-[10px] font-medium text-success">Datos encontrados</p>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`rep-adicional-nombre-${indice}`} className="text-[11px] font-medium text-muted-foreground"><span>Nombre completo</span> <span className="text-destructive">*</span></Label>
          <Input id={`rep-adicional-nombre-${indice}`} className={INPUT} maxLength={200} value={rep.nombre} onChange={(e) => onCambio({ nombre: e.target.value })} />
          <Error mensaje={error.nombre} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`rep-adicional-email-${indice}`} className="text-[11px] font-medium text-muted-foreground"><span>Correo</span> <span className="text-destructive">*</span></Label>
          <Input id={`rep-adicional-email-${indice}`} type="email" className={INPUT} maxLength={200} value={rep.correo} onChange={(e) => onCambio({ correo: e.target.value })} />
          <Error mensaje={error.correo} />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] font-medium text-muted-foreground"><span>Celular</span> <span className="text-destructive">*</span></Label>
          <TelefonoInput value={rep.celular} onChange={(v) => onCambio({ celular: v })} error={error.celular} />
          <Error mensaje={error.celular} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`rep-adicional-dir-${indice}`} className="text-[11px] font-medium text-muted-foreground"><span>Direccion</span> <span className="text-destructive">*</span></Label>
          <Input id={`rep-adicional-dir-${indice}`} className={INPUT} maxLength={100} value={rep.direccion} onChange={(e) => onCambio({ direccion: e.target.value })} />
          <Error mensaje={error.direccion} />
        </div>
      </div>
    </div>
  );
}

/** Editor repetible de representantes legales adicionales (no incluye al principal). */
export function RepresentantesAdicionalesEditor({
  value,
  onChange,
  errores = [],
  titulo = "Representantes legales adicionales",
  descripcion = "El representante principal sigue siendo el titular de la cuenta. Agrega aqui a los demas representantes que deben figurar en el contrato.",
  max = MAX_REPRESENTANTES_ADICIONALES,
  ocultarEncabezado = false,
}: Props) {
  const actualizar = (indice: number, cambio: Partial<RepresentanteAdicionalForm>) => {
    onChange(value.map((rep, i) => (i === indice ? { ...rep, ...cambio } : rep)));
  };

  return (
    <div className="space-y-3">
      {!ocultarEncabezado && (
        <div>
          <p className="text-xs font-semibold text-foreground">{titulo}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{descripcion}</p>
        </div>
      )}

      <div className="space-y-3">
        {value.map((rep, indice) => (
          <FilaRepresentante
            key={rep.id ?? `nuevo-${indice}`}
            rep={rep}
            indice={indice}
            error={errores[indice] ?? {}}
            onCambio={(cambio) => actualizar(indice, cambio)}
            onQuitar={() => onChange(value.filter((_, i) => i !== indice))}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 rounded-full text-xs"
        disabled={value.length >= max}
        onClick={() => onChange([...value, representanteAdicionalVacio()])}
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Agregar representante legal</span>
      </Button>
    </div>
  );
}
