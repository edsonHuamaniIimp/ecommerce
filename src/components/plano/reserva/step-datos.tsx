"use client";

import { useState, useEffect, useRef } from "react";
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@nrivera-iimp/ui-kit-iimp";
import { onlyDigits, onlyPhoneDigits } from "@/lib/shared/utils/form-validator";
import { maestraService } from "@/lib/client/api/services/maestra-service";
import { sunatService } from "@/lib/client/api/services/sunat-service";
import { MAESTRA_TABLAS, TIPOS_COMPROBANTE, TIPOS_DOCUMENTO } from "@/lib/shared/constants";
import type { MaestraItemDTO } from "@/types/dto/maestra";
import type { FormDatos } from "./interfaces";

interface Props {
  datos: FormDatos;
  onChange: (update: Partial<FormDatos>) => void;
}

export function StepDatos({ datos, onChange }: Props) {
  const [comprobantes, setComprobantes] = useState<MaestraItemDTO[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);

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
          if (r.razonSocial) onChange({ razonSocial: r.razonSocial });
        })
      : sunatService.consultarDni(num).then((r) => {
          if (r.nombreCompleto) onChange({ contacto: r.nombreCompleto });
        });
    lookup.finally(() => setLookupLoading(false));
  }, [datos.numeroDocumento, isFactura, docMax]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Datos comerciales</p>
        <div className="space-y-2.5">

          <div className="space-y-1">
            <Label htmlFor="tipoComprobante" className="text-[11px] text-slate-500"><span>Comprobante</span></Label>
              <Select value={datos.tipoComprobante} onValueChange={(v) => { docEditedRef.current = false; onChange({ tipoComprobante: v, numeroDocumento: "", razonSocial: "", contacto: "" }); }}>
              <SelectTrigger id="tipoComprobante" className="h-9 text-sm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {comprobantes.map((c) => (
                  <SelectItem key={c.itemId ?? c.id} value={c.nombre.toLowerCase()}><span>{c.nombre}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {datos.tipoComprobante && (
            <div className="space-y-1">
              <Label htmlFor="numeroDocumento" className="text-[11px] text-slate-500">
                <span>{docLabel}</span>
                {lookupLoading && <span className="ml-1 text-emerald-500 animate-pulse">· Buscando...</span>}
              </Label>
              <Input
                id="numeroDocumento"
                placeholder={docPlaceholder}
                className="h-9 text-sm"
                maxLength={docMax}
                inputMode="numeric"
                value={datos.numeroDocumento}
                onChange={(e) => {
                  docEditedRef.current = true;
                  onChange({ numeroDocumento: onlyDigits(e.target.value, docMax), tipoDocumento: docLabel });
                }}
              />
            </div>
          )}

          {isFactura && (
            <div className="space-y-1">
              <Label htmlFor="razonSocial" className="text-[11px] text-slate-500"><span>Razon social</span></Label>
              <Input id="razonSocial" placeholder="Ej. Corporacion Minera S.A." className="h-9 text-sm" maxLength={150}
                value={datos.razonSocial} onChange={(e) => onChange({ razonSocial: e.target.value })} />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="direccion" className="text-[11px] text-slate-500"><span>Direccion fiscal</span></Label>
            <Input id="direccion" placeholder="Av. Principal 123, Distrito, Provincia" className="h-9 text-sm" maxLength={200}
              value={datos.direccion} onChange={(e) => onChange({ direccion: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-slate-100" />
        <span className="text-[9px] font-medium uppercase tracking-widest text-slate-350">Contacto</span>
        <div className="h-px flex-1 bg-slate-100" />
      </div>

      <div className="space-y-2.5">
        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <Label htmlFor="contacto" className="text-[11px] text-slate-500"><span>Persona de contacto</span></Label>
            <Input id="contacto" placeholder="Nombre y apellido" className="h-9 text-sm" maxLength={100}
              value={datos.contacto} onChange={(e) => onChange({ contacto: e.target.value })} />
          </div>
          <div className="flex-1 space-y-1">
            <Label htmlFor="telefono" className="text-[11px] text-slate-500"><span>Telefono</span></Label>
            <Input id="telefono" placeholder="999 888 777" className="h-9 text-sm" maxLength={9} inputMode="numeric"
              value={datos.telefono} onChange={(e) => onChange({ telefono: onlyPhoneDigits(e.target.value) })} />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="emailReserva" className="text-[11px] text-slate-500"><span>Correo electronico</span></Label>
          <Input id="emailReserva" type="email" placeholder="contacto@empresa.pe" className="h-9 text-sm" maxLength={150}
            value={datos.email} onChange={(e) => onChange({ email: e.target.value })} />
        </div>
      </div>
    </div>
  );
}
