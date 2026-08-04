"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Badge } from "@nrivera-iimp/ui-kit-iimp";
import { Send, Gem, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/lib/api/services/auth-service";

interface Auspicio {
  nombre: string;
  tipo: string;
  moneda: string;
  codigo: number;
}

type Moneda = "US$" | "S/";

export default function AuspiciosPage() {
  const [tipoEvento, setTipoEvento] = useState<number | null>(null);
  const [codigoEvento, setCodigoEvento] = useState<number | null>(null);
  const [eventoNombre, setEventoNombre] = useState("");
  const [loading, setLoading] = useState(true);
  const [auspicios, setAuspicios] = useState<Auspicio[]>([]);
  const [registering, setRegistering] = useState(false);

  const [form, setForm] = useState({
    tipoDocumento: "6",
    numDocumento: "",
    empresa: "",
    direccion: "",
    telefono: "",
    email: "",
    sieCod: "",
    tipoFacturacion: "01",
    tipDocFacturacion: "6",
    numDocFacturacion: "",
    razonSocial: "",
    dirFacturacion: "",
    nombreContactoFact: "",
    correoContactoFact: "",
  });

  const [tarifas, setTarifas] = useState<Array<{ codAuspicio: number; moneda: Moneda; importe: string }>>([]);

  useEffect(() => {
    authService.getSession().then((s) => {
      if (s.tipoEvento && s.codigoEvento) {
        setTipoEvento(Number(s.tipoEvento));
        setCodigoEvento(Number(s.codigoEvento));
        setEventoNombre(s.eventoNombre ?? "");
      }
    });
  }, []);

  useEffect(() => {
    if (tipoEvento === null || codigoEvento === null) return;
    setLoading(true);
    fetch("/api/auspicios/listar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: tipoEvento, codeEvent: codigoEvento }),
    })
      .then((res) => res.json())
      .then((json: { success: boolean; data?: { auspicios?: Auspicio[] }; message?: string }) => {
        if (!json.success || !json.data?.auspicios) {
          toast.error(json.message ?? "Error al listar auspicios");
          return;
        }
        setAuspicios(json.data.auspicios);
        setTarifas(json.data.auspicios.map((a) => ({ codAuspicio: a.codigo, moneda: a.moneda as Moneda, importe: "" })));
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Error de conexion"))
      .finally(() => setLoading(false));
  }, [tipoEvento, codigoEvento]);

  const updateTarifa = (idx: number, field: "importe", val: string) => {
    setTarifas((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], importe: val };
      return next;
    });
  };

  const handleRegister = async () => {
    if (!form.numDocumento || !form.empresa) {
      toast.error("RUC/DNI y empresa son requeridos");
      return;
    }
    const tarifasValidas = tarifas.filter((t) => t.importe && Number(t.importe) > 0);
    if (tarifasValidas.length === 0) {
      toast.error("Agrega al menos una tarifa con importe");
      return;
    }

    setRegistering(true);
    try {
      const res = await fetch("/api/auspicios/grabar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: tipoEvento,
          codeEvent: codigoEvento,
          ...form,
          Tarifas: tarifasValidas.map((t) => ({
            codAuspicio: t.codAuspicio,
            moneda: t.moneda,
            importe: Number(t.importe),
          })),
        }),
      });
      const json = (await res.json()) as { success: boolean; message?: string };
      if (json.success) toast.success("Auspicio registrado correctamente");
      else toast.error(json.message ?? "Error al registrar");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error de conexion");
    }
    setRegistering(false);
  };

  if (loading) {
    return (
      <main className="flex-1 py-6">
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex-1 py-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gem className="h-5 w-5" />
            <span>Auspicios</span>
            {eventoNombre && (
              <Badge variant="secondary" className="text-[10px] ml-2">
                {eventoNombre}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {auspicios.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
              <Gem className="h-8 w-8 text-slate-300" />
              <p>No se encontraron auspicios para este evento.</p>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full mt-2"
                onClick={() => {
                  setLoading(true);
                  fetch("/api/auspicios/listar", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code: tipoEvento, codeEvent: codigoEvento }),
                  })
                    .then((res) => res.json())
                    .then((json: { success: boolean; data?: { auspicios?: Auspicio[] } }) => {
                      if (json.success && json.data?.auspicios) setAuspicios(json.data.auspicios);
                    })
                    .finally(() => setLoading(false));
                }}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Reintentar
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 mb-2">
                Auspicios disponibles ({auspicios.length})
              </p>
              <div className="space-y-0.5">
                {auspicios.map((a) => (
                  <div
                    key={a.codigo}
                    className="flex items-center justify-between rounded border bg-slate-50 px-3 py-2 text-xs"
                  >
                    <div>
                      <span className="font-medium text-slate-700">{a.nombre}</span>
                      <span className="text-slate-400 ml-2">{a.tipo}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {a.moneda}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {auspicios.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Registrar Auspicio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo Documento</Label>
                <Select
                  value={form.tipoDocumento}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, tipoDocumento: v }))}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">RUC</SelectItem>
                    <SelectItem value="1">DNI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Nro Documento</Label>
                <Input
                  className="text-xs"
                  value={form.numDocumento}
                  onChange={(e) => setForm((prev) => ({ ...prev, numDocumento: e.target.value }))}
                  placeholder="20107972090"
                />
              </div>
              <div>
                <Label className="text-xs">Empresa</Label>
                <Input
                  className="text-xs"
                  value={form.empresa}
                  onChange={(e) => setForm((prev) => ({ ...prev, empresa: e.target.value }))}
                  placeholder="IIMP"
                />
              </div>
              <div>
                <Label className="text-xs">Direccion</Label>
                <Input
                  className="text-xs"
                  value={form.direccion}
                  onChange={(e) => setForm((prev) => ({ ...prev, direccion: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Telefono</Label>
                <Input
                  className="text-xs"
                  value={form.telefono}
                  onChange={(e) => setForm((prev) => ({ ...prev, telefono: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input
                  className="text-xs"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Codigo SIE</Label>
                <Input
                  className="text-xs"
                  value={form.sieCod}
                  onChange={(e) => setForm((prev) => ({ ...prev, sieCod: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Tarifas</p>
              <div className="space-y-2">
                {tarifas.map((t, i) => {
                  const ausp = auspicios.find((a) => a.codigo === t.codAuspicio);
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded border bg-slate-50 px-3 py-2 text-xs"
                    >
                      <span className="flex-1 font-medium">
                        {ausp?.nombre ?? `Cod. ${t.codAuspicio}`}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {t.moneda}
                      </Badge>
                      <Input
                        className="w-28 text-xs"
                        type="number"
                        step="0.01"
                        value={t.importe}
                        onChange={(e) => updateTarifa(i, "importe", e.target.value)}
                        placeholder="Importe"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-slate-500 mb-3">Facturacion</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Tipo Facturacion</Label>
                  <Select
                    value={form.tipoFacturacion}
                    onValueChange={(v) => setForm((prev) => ({ ...prev, tipoFacturacion: v }))}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="01">Factura</SelectItem>
                      <SelectItem value="03">Boleta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Tipo Doc Facturacion</Label>
                  <Select
                    value={form.tipDocFacturacion}
                    onValueChange={(v) => setForm((prev) => ({ ...prev, tipDocFacturacion: v }))}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">RUC</SelectItem>
                      <SelectItem value="1">DNI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Nro Doc Facturacion</Label>
                  <Input
                    className="text-xs"
                    value={form.numDocFacturacion}
                    onChange={(e) => setForm((prev) => ({ ...prev, numDocFacturacion: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Razon Social</Label>
                  <Input
                    className="text-xs"
                    value={form.razonSocial}
                    onChange={(e) => setForm((prev) => ({ ...prev, razonSocial: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Dir. Facturacion</Label>
                  <Input
                    className="text-xs"
                    value={form.dirFacturacion}
                    onChange={(e) => setForm((prev) => ({ ...prev, dirFacturacion: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Nombre Contacto</Label>
                  <Input
                    className="text-xs"
                    value={form.nombreContactoFact}
                    onChange={(e) => setForm((prev) => ({ ...prev, nombreContactoFact: e.target.value }))}
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Correo Contacto</Label>
                  <Input
                    className="text-xs"
                    value={form.correoContactoFact}
                    onChange={(e) => setForm((prev) => ({ ...prev, correoContactoFact: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <Button className="rounded-full" onClick={handleRegister} disabled={registering}>
              {registering ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Registrar Auspicio
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
