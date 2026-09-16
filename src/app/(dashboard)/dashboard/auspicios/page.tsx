"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Badge, Tabs, TabsContent, TabsList, TabsTrigger } from "@nrivera-iimp/ui-kit-iimp";
import { Send, Gem, Loader2, RefreshCw, List, PlusCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/lib/client/api/services/auth-service";
import { entidadesService } from "@/lib/client/api/services/entidades-service";
import { sunatService } from "@/lib/client/api/services/sunat-service";

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
  const [tab, setTab] = useState("listar");
  const [searchingDoc, setSearchingDoc] = useState(false);
  const [searchingFact, setSearchingFact] = useState(false);

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
    glosa: "",
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
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Error de conexion"))
      .finally(() => setLoading(false));
  }, [tipoEvento, codigoEvento]);

  const updateTarifa = (idx: number, field: "importe" | "moneda", val: string) => {
    setTarifas((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
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
          TarifaAuspicio: tarifasValidas.map((t) => ({
            codAuspicio: t.codAuspicio,
            moneda: t.moneda,
            importe: Number(t.importe),
          })),
        }),
      });
      const json = (await res.json()) as { success: boolean; message?: string };
      if (json.success) {
        toast.success("Auspicio registrado correctamente");
        // Reset form after success
        setForm(prev => ({ ...prev, numDocumento: "", empresa: "", direccion: "", telefono: "", email: "", sieCod: "", razonSocial: "", dirFacturacion: "", nombreContactoFact: "", correoContactoFact: "", glosa: "" }));
        setTarifas([]);
      }
      else toast.error(json.message ?? "Error al registrar");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error de conexion");
    }
    setRegistering(false);
  };

  const handleSearchDocumento = async () => {
    const doc = form.numDocumento.trim();
    if (!doc || doc.length < 8) { toast.error("Ingresa un documento valido (8+ digitos)"); return; }
    setSearchingDoc(true);
    try {
      // 1. Buscar en IIMP (entidades)
      if (form.tipoDocumento === "6") {
        const data = await entidadesService.searchEmpresa(doc, undefined);
        const list = (data as Record<string, unknown>).ListEmpresa as Array<Record<string, unknown>> | undefined;
        if (list && list.length > 0) {
          const e = list[0];
          setForm(prev => ({
            ...prev,
            empresa: String(e.razonSocial ?? e.empresa ?? prev.empresa),
            direccion: String(e.direccion ?? prev.direccion),
            sieCod: String(e.ecicod ?? e.sie_code ?? prev.sieCod),
          }));
          toast.success("Empresa encontrada en IIMP");
          setSearchingDoc(false);
          return;
        }
      }
      // 2. Buscar persona en IIMP
      const persData = await entidadesService.searchPerson(doc, undefined);
      const persList = (persData as Record<string, unknown>).ListInfoPersona as Array<Record<string, unknown>> | undefined;
      if (persList && persList.length > 0) {
        const p = persList[0];
        setForm(prev => ({
          ...prev,
          empresa: String(p.empresa ?? prev.empresa),
          direccion: String(p.direccion ?? prev.direccion),
          email: String(p.correo ?? prev.email),
          telefono: String(p.celular ?? prev.telefono),
          sieCod: String(p.sie_code ?? prev.sieCod),
        }));
        toast.success("Persona encontrada en IIMP");
        setSearchingDoc(false);
        return;
      }
      // 3. SUNAT o RENIEC
      if (form.tipoDocumento === "6") {
        const rucData = await sunatService.consultarRuc(doc);
        if (rucData && (rucData as Record<string, unknown>).razonSocial) {
          const r = rucData as Record<string, unknown>;
          setForm(prev => ({
            ...prev,
            empresa: String(r.razonSocial ?? prev.empresa),
            direccion: String(r.direccion ?? prev.direccion),
          }));
          toast.success("Empresa encontrada en SUNAT");
          setSearchingDoc(false);
          return;
        }
      } else {
        const dniData = await sunatService.consultarDni(doc);
        if (dniData && (dniData as Record<string, unknown>).nombreCompleto) {
          const d = dniData as Record<string, unknown>;
          setForm(prev => ({
            ...prev,
            empresa: String(d.nombreCompleto ?? prev.empresa),
          }));
          toast.success("Persona encontrada en RENIEC");
          setSearchingDoc(false);
          return;
        }
      }
      toast.error("No se encontro el documento. Completa manualmente.");
    } catch { toast.error("Error al buscar. Completa manualmente."); }
    setSearchingDoc(false);
  };

  const handleSearchFacturacion = async () => {
    const doc = form.numDocFacturacion.trim();
    if (!doc || doc.length < 8) { toast.error("Ingresa un documento valido (8+ digitos)"); return; }
    setSearchingFact(true);
    try {
      const esRuc = form.tipDocFacturacion === "6";
      // 1. IIMP Empresa o Persona
      if (esRuc) {
        const data = await entidadesService.searchEmpresa(doc, undefined);
        const list = (data as Record<string, unknown>).ListEmpresa as Array<Record<string, unknown>> | undefined;
        if (list && list.length > 0) {
          const e = list[0];
          setForm(prev => ({ ...prev, razonSocial: String(e.razonSocial ?? prev.razonSocial), dirFacturacion: String(e.direccion ?? prev.dirFacturacion) }));
          toast.success("Encontrado en IIMP");
          setSearchingFact(false); return;
        }
      }
      const persData = await entidadesService.searchPerson(doc, undefined);
      const persList = (persData as Record<string, unknown>).ListInfoPersona as Array<Record<string, unknown>> | undefined;
      if (persList && persList.length > 0) {
        const p = persList[0];
        setForm(prev => ({
          ...prev,
          razonSocial: [p.nombres, p.apellido_paterno, p.apellido_materno].filter(Boolean).join(" ") || String(p.nombreCompleto ?? prev.razonSocial),
          dirFacturacion: String(p.direccion ?? prev.dirFacturacion),
        }));
        toast.success("Encontrado en IIMP");
        setSearchingFact(false); return;
      }
      // 2. SUNAT / RENIEC
      if (esRuc) {
        const rucData = await sunatService.consultarRuc(doc);
        if (rucData && (rucData as Record<string, unknown>).razonSocial) {
          const r = rucData as Record<string, unknown>;
          setForm(prev => ({ ...prev, razonSocial: String(r.razonSocial ?? prev.razonSocial), dirFacturacion: String(r.direccion ?? prev.dirFacturacion) }));
          toast.success("Encontrado en SUNAT");
          setSearchingFact(false); return;
        }
      } else {
        const dniData = await sunatService.consultarDni(doc);
        if (dniData && (dniData as Record<string, unknown>).nombreCompleto) {
          setForm(prev => ({ ...prev, razonSocial: String(dniData.nombreCompleto ?? prev.razonSocial) }));
          toast.success("Encontrado en RENIEC");
          setSearchingFact(false); return;
        }
      }
      toast.error("No encontrado. Completa manualmente.");
    } catch { toast.error("Error al buscar. Completa manualmente."); }
    setSearchingFact(false);
  };

  const fetchAuspicios = () => {
    setLoading(true);
    fetch("/api/auspicios/listar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: tipoEvento, codeEvent: codigoEvento }),
    })
      .then((res) => res.json())
      .then((json: { success: boolean; data?: { auspicios?: Auspicio[] } }) => {
        if (json.success && json.data?.auspicios) {
          setAuspicios(json.data.auspicios);
        }
      })
      .finally(() => setLoading(false));
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
    <main className="flex-1 py-6">
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
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="listar" className="text-xs gap-1.5">
                <List className="h-3.5 w-3.5" />
                Auspicios disponibles
              </TabsTrigger>
              <TabsTrigger value="registrar" className="text-xs gap-1.5">
                <PlusCircle className="h-3.5 w-3.5" />
                Registrar auspicio
              </TabsTrigger>
            </TabsList>

            <TabsContent value="listar" className="mt-0">
              {auspicios.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
                  <Gem className="h-8 w-8 text-slate-300" />
                  <p>No se encontraron auspicios para este evento.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full mt-2"
                    onClick={fetchAuspicios}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Reintentar
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-500 mb-2">
                    {auspicios.length} auspicios disponibles
                  </p>
                  <div className="grid gap-0.5">
                    {auspicios.map((a) => (
                      <div
                        key={a.codigo}
                        className="flex items-center justify-between rounded-lg border bg-white px-4 py-3 text-sm"
                      >
                        <div>
                          <span className="font-medium text-slate-800">{a.nombre}</span>
                          <span className="text-slate-400 ml-2 text-xs">{a.tipo}</span>
                        </div>
                        <Badge variant="secondary" className="text-[10px]">
                          {a.moneda}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="registrar" className="mt-0">
              {auspicios.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
                  <p>Primero carga la lista de auspicios disponibles.</p>
                  <Button variant="outline" size="sm" className="rounded-full" onClick={() => setTab("listar")}>
                    <List className="h-3.5 w-3.5 mr-1" />
                    Ir a la lista
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Tipo Documento</Label>
                      <Select
                        value={form.tipoDocumento}
                        onValueChange={(v) => setForm((prev) => ({ ...prev, tipoDocumento: v }))}
                      >
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="6">RUC</SelectItem>
                          <SelectItem value="1">DNI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Nro Documento</Label>
                      <div className="flex gap-2">
                        <Input className="text-xs flex-1" value={form.numDocumento} onChange={(e) => setForm((prev) => ({ ...prev, numDocumento: e.target.value }))} placeholder="20107972090" />
                        <Button size="sm" variant="outline" className="shrink-0 rounded-full" onClick={handleSearchDocumento} disabled={searchingDoc}>
                          {searchingDoc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Empresa</Label>
                      <Input className="text-xs" value={form.empresa} onChange={(e) => setForm((prev) => ({ ...prev, empresa: e.target.value }))} placeholder="IIMP" />
                    </div>
                    <div>
                      <Label className="text-xs">Direccion</Label>
                      <Input className="text-xs" value={form.direccion} onChange={(e) => setForm((prev) => ({ ...prev, direccion: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Telefono</Label>
                      <Input className="text-xs" value={form.telefono} onChange={(e) => setForm((prev) => ({ ...prev, telefono: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Email</Label>
                      <Input className="text-xs" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Codigo SIE</Label>
                      <Input className="text-xs" value={form.sieCod} onChange={(e) => setForm((prev) => ({ ...prev, sieCod: e.target.value }))} />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2">Tarifas</p>
                    <div className="space-y-2">
                      {tarifas.map((t, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2.5 text-xs">
                          <Select
                            value={String(t.codAuspicio)}
                            onValueChange={(v) => {
                              const ausp = auspicios.find(a => a.codigo === Number(v));
                              if (!ausp) return;
                              updateTarifa(i, "moneda", ausp.moneda as Moneda);
                              setTarifas(prev => prev.map((tt, ii) => ii === i ? { ...tt, codAuspicio: ausp.codigo, moneda: ausp.moneda as Moneda } : tt));
                            }}
                          >
                            <SelectTrigger className="text-xs flex-1"><SelectValue placeholder="Seleccionar auspicio" /></SelectTrigger>
                            <SelectContent>
                              {auspicios.filter(a => !tarifas.some((tt, ii) => ii !== i && tt.codAuspicio === a.codigo))
                                .map(a => (
                                  <SelectItem key={a.codigo} value={String(a.codigo)}>
                                    {a.nombre} ({a.moneda})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <Badge variant="secondary" className="text-[10px] shrink-0">{t.moneda}</Badge>
                          <Input className="w-28 text-xs" type="number" step="0.01" value={t.importe} onChange={(e) => updateTarifa(i, "importe", e.target.value)} placeholder="Importe" />
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 shrink-0" onClick={() => setTarifas(prev => prev.filter((_, ii) => ii !== i))}>
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full text-xs w-full"
                        onClick={() => setTarifas(prev => [...prev, { codAuspicio: 0, moneda: "US$", importe: "" }])}
                        disabled={tarifas.length >= auspicios.length}
                      >
                        + Agregar tarifa
                      </Button>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-xs font-semibold text-slate-500 mb-3">Facturacion</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Tipo Facturacion</Label>
                        <Select value={form.tipoFacturacion} onValueChange={(v) => setForm((prev) => ({ ...prev, tipoFacturacion: v }))}>
                          <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="01">Factura</SelectItem>
                            <SelectItem value="03">Boleta</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Tipo Doc Facturacion</Label>
                        <Select value={form.tipDocFacturacion} onValueChange={(v) => setForm((prev) => ({ ...prev, tipDocFacturacion: v }))}>
                          <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="6">RUC</SelectItem>
                            <SelectItem value="1">DNI</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Nro Doc Facturacion</Label>
                        <div className="flex gap-2">
                          <Input className="text-xs flex-1" value={form.numDocFacturacion} onChange={(e) => setForm((prev) => ({ ...prev, numDocFacturacion: e.target.value }))} />
                          <Button size="sm" variant="outline" className="shrink-0 rounded-full" onClick={handleSearchFacturacion} disabled={searchingFact}>
                            {searchingFact ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Razon Social</Label>
                        <Input className="text-xs" value={form.razonSocial} onChange={(e) => setForm((prev) => ({ ...prev, razonSocial: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-xs">Dir. Facturacion</Label>
                        <Input className="text-xs" value={form.dirFacturacion} onChange={(e) => setForm((prev) => ({ ...prev, dirFacturacion: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-xs">Nombre Contacto</Label>
                        <Input className="text-xs" value={form.nombreContactoFact} onChange={(e) => setForm((prev) => ({ ...prev, nombreContactoFact: e.target.value }))} />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Correo Contacto</Label>
                        <Input className="text-xs" value={form.correoContactoFact} onChange={(e) => setForm((prev) => ({ ...prev, correoContactoFact: e.target.value }))} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Glosa</Label>
                    <Input className="text-xs" value={form.glosa} onChange={(e) => setForm((prev) => ({ ...prev, glosa: e.target.value }))} placeholder="Observaciones o comentarios" />
                  </div>

                  <Button className="rounded-full" onClick={handleRegister} disabled={registering}>
                    {registering ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                    Registrar Auspicio
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}
