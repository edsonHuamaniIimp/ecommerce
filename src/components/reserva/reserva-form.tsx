"use client";

import { useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@nrivera-iimp/ui-kit-iimp";
import type { PlanoStand, TipoComprobante } from "@/types/reserva";
import type { ReservaCreateInput } from "@/lib/client/api/services/types";
import { TIPOS_COMPROBANTE } from "@/lib/shared/constants";

interface ReservaFormProps {
  selectedStands: PlanoStand[];
  onClear: () => void;
  onReservar: (input: ReservaCreateInput) => Promise<void>;
  error?: string | null;
}

export function ReservaForm({ selectedStands, onClear, onReservar, error }: ReservaFormProps) {
  const [empresa, setEmpresa] = useState("");
  const [docValue, setDocValue] = useState("");
  const [comprobante, setComprobante] = useState<TipoComprobante>(TIPOS_COMPROBANTE.FACTURA);
  const [cuotas, setCuotas] = useState(1);
  const [loading, setLoading] = useState(false);

  const total = selectedStands.reduce((s, st) => s + st.monto, 0);
  const moneda = selectedStands[0]?.moneda ?? "USD";

  const handleSubmit = async () => {
    setLoading(true);
    const input: ReservaCreateInput = {
      eventoId: "",
      standIds: selectedStands.map((s) => s.id),
      empresaRef: docValue ? docValue : empresa,
      empresaNombre: empresa,
      facturacion: {
        tipoComprobante: comprobante,
        razonSocial: comprobante === TIPOS_COMPROBANTE.FACTURA ? empresa : "",
        ruc: comprobante === TIPOS_COMPROBANTE.FACTURA ? docValue : "",
        nombre: comprobante === TIPOS_COMPROBANTE.BOLETA ? empresa : "",
        numeroDocumento: comprobante === TIPOS_COMPROBANTE.BOLETA ? docValue : "",
        direccion: "",
        correo: "",
      },
      cuotas: Array.from({ length: cuotas }, (_, i) => ({
        numero: i + 1,
        porcentaje: Math.round(100 / cuotas),
        fechaPago: null,
      })),
    };
    try {
      await onReservar(input);
    } finally {
      setLoading(false);
    }
  };

  if (selectedStands.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <span>Reserva</span>
          </CardTitle>
          <CardDescription>
            <span>Selecciona uno o más stands en el plano para comenzar.</span>
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span>Reserva</span>
        </CardTitle>
        <CardDescription>
          <span>
            {selectedStands.length} stand(s) seleccionado(s) — Total:{" "}
            <strong>{total.toLocaleString("en-US")} {moneda}</strong>
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Stands summary */}
        <div className="space-y-1 rounded-md border bg-muted/30 p-3">
          {selectedStands.map((st) => (
            <div key={st.id} className="flex justify-between text-sm">
              <span>
                Stand {st.numero} ({st.tipoStand} · {st.medidas})
              </span>
              <span className="font-medium">
                {st.monto.toLocaleString("en-US")} {st.moneda}
              </span>
            </div>
          ))}
          <Separator />
          <div className="flex justify-between text-sm font-bold">
            <span>Total</span>
            <span>{total.toLocaleString("en-US")} {moneda}</span>
          </div>
        </div>

        {/* Empresa */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">
            <span>Datos de la empresa</span>
          </legend>
          <div className="space-y-1.5">
            <Label htmlFor="empresa">
              <span>Razón social / Nombre</span>
            </Label>
            <Input id="empresa" placeholder="Ej. Corporación Minera S.A." value={empresa} onChange={(e) => setEmpresa(e.target.value)} disabled={loading} />
          </div>
        </fieldset>

        {/* Tipo comprobante */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">
            <span>Comprobante</span>
          </legend>
          <RadioGroup
            value={comprobante}
            onValueChange={(v) => setComprobante(v as TipoComprobante)}
            className="flex gap-6"
            disabled={loading}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value={TIPOS_COMPROBANTE.FACTURA} id="factura" />
              <Label htmlFor="factura">
                <span>Factura</span>
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value={TIPOS_COMPROBANTE.BOLETA} id="boleta" />
              <Label htmlFor="boleta">
                <span>Boleta</span>
              </Label>
            </div>
          </RadioGroup>
          {comprobante === TIPOS_COMPROBANTE.FACTURA ? (
            <div className="space-y-1.5">
              <Label htmlFor="ruc">
                <span>RUC</span>
              </Label>
              <Input id="ruc" placeholder="20123456789" value={docValue} onChange={(e) => setDocValue(e.target.value)} disabled={loading} />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="documento">
                <span>N.º Documento</span>
              </Label>
              <Input id="documento" placeholder="DNI/CE" value={docValue} onChange={(e) => setDocValue(e.target.value)} disabled={loading} />
            </div>
          )}
        </fieldset>

        {/* Cuotas */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">
            <span>Cuotas</span>
          </legend>
          <Select value={String(cuotas)} onValueChange={(v) => setCuotas(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  <span>{n} cuota{n > 1 ? "s" : ""}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {cuotas > 1 && (
            <div className="space-y-1 text-xs text-muted-foreground">
              {Array.from({ length: cuotas }, (_, i) => {
                const pct = Math.round(100 / cuotas);
                const m = Math.round((total * pct) / 100);
                return (
                  <div key={i} className="flex justify-between">
                    <span>Cuota {i + 1}</span>
                    <span>{pct}% — {m.toLocaleString("en-US")} {moneda}</span>
                  </div>
                );
              })}
            </div>
          )}
        </fieldset>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" onClick={handleSubmit} disabled={loading || !empresa.trim()}>
            <span>{loading ? "Enviando..." : "Registrar reserva"}</span>
          </Button>
          <Button variant="outline" className="flex-1" disabled>
            <span>Descargar contrato</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear} disabled={loading}>
            <span>Limpiar</span>
          </Button>
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <span>{error}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
