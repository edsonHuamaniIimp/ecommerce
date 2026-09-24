"use client";

import { useState, useEffect, useRef } from "react";
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@nrivera-iimp/ui-kit-iimp";
import { ShieldCheck, Store } from "lucide-react";
import { onlyDigits, onlyPhoneDigits } from "@/lib/shared/utils/form-validator";
import { maestraService } from "@/lib/client/api/services/maestra-service";
import { sunatService } from "@/lib/client/api/services/sunat-service";
import { BADGE_STYLES, MAESTRA_TABLAS, TIPOS_COMPROBANTE, TIPOS_DOCUMENTO } from "@/lib/shared/constants";
import type { MaestraItemDTO } from "@/types/dto/maestra";
import type { FormDatos } from "./interfaces";

const LABEL_CLASE = "text-[11px] font-medium text-muted-foreground";
const INPUT_CLASE =
  "h-9 border-border text-sm focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary";

interface Props {
  datos: FormDatos;
  onChange: (update: Partial<FormDatos>) => void;
  /** Etiqueta de los stands en reserva temporal (barra de resumen). */
  selectedLabels?: string;
}

export function StepDatos({ datos, onChange, selectedLabels }: Props) {
  const [comprobantes, setComprobantes] = useState<MaestraItemDTO[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [validado, setValidado] = useState(false);

  useEffect(() => {
    maestraService.listar(MAESTRA_TABLAS.COMPROBANTE_TIPO).then(setComprobantes).catch(() => {});
  }, []);

  const isFactura = datos.tipoComprobante === TIPOS_COMPROBANTE.FACTURA;
  const docLabel = isFactura ? TIPOS_DOCUMENTO.RUC : TIPOS_DOCUMENTO.DNI;
  const docMax = isFactura ? 11 : 8;
  const docPlaceholder = isFactura ? "20123456789" : "12345678";

  // Autocomplete: consulta SUNAT/RENIEC al completar el documento (solo al editar, no al cargar)
  const docEditedRef = useRef(false);
  useEffect(() => {
    const num = datos.numeroDocumento;
    if (!num || num.length !== docMax || !docEditedRef.current) return;
    docEditedRef.current = false;
    setLookupLoading(true);
    const lookup = isFactura
      ? sunatService.consultarRuc(num).then((r) => {
          if (r.razonSocial) {
            onChange({ razonSocial: r.razonSocial });
            setValidado(true);
          }
        })
      : sunatService.consultarDni(num).then((r) => {
          if (r.nombreCompleto) {
            onChange({ contacto: r.nombreCompleto });
            setValidado(true);
          }
        });
    lookup.finally(() => setLookupLoading(false));
  }, [datos.numeroDocumento, isFactura, docMax]); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiarComprobante = (valor: string) => {
    docEditedRef.current = false;
    setValidado(false);
    onChange({ tipoComprobante: valor, numeroDocumento: "", razonSocial: "", contacto: "" });
  };

  return (
    <div className="flex flex-col gap-4 pt-3">
      {selectedLabels && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary px-3 py-2.5 text-xs">
          <Store className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">Espacios en reserva temporal: </span>
            {selectedLabels}
          </span>
        </div>
      )}

      <div>
        <p className="mb-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
          Datos comerciales
        </p>
        <div className="space-y-2.5">
          <div className="space-y-1">
            <Label htmlFor="tipoComprobante" className={LABEL_CLASE}><span>Comprobante</span></Label>
            {comprobantes.length >= 2 ? (
              <div className="grid grid-cols-2 gap-2">
                {comprobantes.slice(0, 2).map((c) => {
                  const valor = c.nombre.toLowerCase();
                  const activo = datos.tipoComprobante === valor;
                  return (
                    <Button
                      key={c.itemId ?? c.id}
                      type="button"
                      variant={activo ? "default" : "outline"}
                      className={`h-auto justify-center rounded-lg px-3 py-2 text-xs ${
                        activo ? "bg-primary font-semibold text-primary-foreground" : "border-border font-medium text-muted-foreground"
                      }`}
                      onClick={() => cambiarComprobante(valor)}
                    >
                      <span>{c.nombre}</span>
                    </Button>
                  );
                })}
              </div>
            ) : (
              <Select value={datos.tipoComprobante} onValueChange={cambiarComprobante}>
                <SelectTrigger id="tipoComprobante" className="h-9 text-sm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {comprobantes.map((c) => (
                    <SelectItem key={c.itemId ?? c.id} value={c.nombre.toLowerCase()}><span>{c.nombre}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {datos.tipoComprobante && (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="numeroDocumento" className={LABEL_CLASE}><span>{docLabel}</span></Label>
                {lookupLoading && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${BADGE_STYLES.WARNING}`}>
                    Buscando en SUNAT...
                  </span>
                )}
                {!lookupLoading && validado && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${BADGE_STYLES.SUCCESS}`}>
                    <ShieldCheck className="h-3 w-3" />
                    Validado SUNAT
                  </span>
                )}
              </div>
              <Input
                id="numeroDocumento"
                placeholder={docPlaceholder}
                className={INPUT_CLASE}
                maxLength={docMax}
                inputMode="numeric"
                value={datos.numeroDocumento}
                onChange={(e) => {
                  docEditedRef.current = true;
                  setValidado(false);
                  onChange({ numeroDocumento: onlyDigits(e.target.value, docMax), tipoDocumento: docLabel });
                }}
              />
            </div>
          )}

          {isFactura && (
            <div className="space-y-1">
              <Label htmlFor="razonSocial" className={LABEL_CLASE}><span>Razon social</span></Label>
              <Input id="razonSocial" placeholder="Ej. Corporacion Minera S.A." className={INPUT_CLASE} maxLength={150}
                value={datos.razonSocial} onChange={(e) => onChange({ razonSocial: e.target.value })} />
              <p className="text-[10px] text-muted-foreground">
                Dato validado automaticamente con el padron de contribuyentes de SUNAT.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="direccion" className={LABEL_CLASE}><span>Direccion fiscal</span></Label>
            <Input id="direccion" placeholder="Av. Principal 123, Distrito, Provincia" className={INPUT_CLASE} maxLength={200}
              value={datos.direccion} onChange={(e) => onChange({ direccion: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[9px] font-medium tracking-widest text-muted-foreground uppercase">Contacto comercial y tecnico</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="space-y-2.5">
        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <Label htmlFor="contacto" className={LABEL_CLASE}><span>Persona de contacto</span></Label>
            <Input id="contacto" placeholder="Nombre y apellido" className={INPUT_CLASE} maxLength={100}
              value={datos.contacto} onChange={(e) => onChange({ contacto: e.target.value })} />
          </div>
          <div className="flex-1 space-y-1">
            <Label htmlFor="telefono" className={LABEL_CLASE}><span>Telefono</span></Label>
            <Input id="telefono" placeholder="999 888 777" className={INPUT_CLASE} maxLength={9} inputMode="numeric"
              value={datos.telefono} onChange={(e) => onChange({ telefono: onlyPhoneDigits(e.target.value) })} />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="emailReserva" className={LABEL_CLASE}><span>Correo electronico</span></Label>
          <Input id="emailReserva" type="email" placeholder="contacto@empresa.pe" className={INPUT_CLASE} maxLength={150}
            value={datos.email} onChange={(e) => onChange({ email: e.target.value })} />
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-primary/10 bg-primary/5 px-3 py-2.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <span>Tus datos seran vinculados al contrato marco del evento y validados por el area legal del IIMP.</span>
      </div>
    </div>
  );
}
