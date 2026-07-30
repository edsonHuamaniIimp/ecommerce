"use client";

import { Input, Label } from "@nrivera-iimp/ui-kit-iimp";
import type { FormDatos } from "./types";

interface Props {
  datos: FormDatos;
  onChange: (update: Partial<FormDatos>) => void;
  selectedLabels: string;
  selectedCount: number;
}

export function StepDatos({ datos, onChange, selectedLabels, selectedCount }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
        <span className="font-semibold text-slate-700">Stands seleccionados:</span>{" "}
        {selectedLabels} · {selectedCount} bloque(s)
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="razonSocial"><span>Razon social</span></Label>
        <Input id="razonSocial" placeholder="Ej. Corporacion Minera S.A."
          value={datos.razonSocial} onChange={(e) => onChange({ razonSocial: e.target.value })} />
      </div>
      <div className="flex gap-3">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="ruc"><span>RUC</span></Label>
          <Input id="ruc" placeholder="20123456789"
            value={datos.ruc} onChange={(e) => onChange({ ruc: e.target.value })} />
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="contacto"><span>Persona de contacto</span></Label>
          <Input id="contacto" placeholder="Nombre y apellido"
            value={datos.contacto} onChange={(e) => onChange({ contacto: e.target.value })} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="emailReserva"><span>Correo electronico</span></Label>
        <Input id="emailReserva" type="email" placeholder="contacto@empresa.pe"
          value={datos.email} onChange={(e) => onChange({ email: e.target.value })} />
      </div>
    </div>
  );
}
