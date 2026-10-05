"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, Checkbox, Dialog, DialogContent, DialogFooter,
  DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger,
  SelectValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tabs, TabsList, TabsTrigger,
} from "@nrivera-iimp/ui-kit-iimp";
import { Bookmark, CheckSquare, Image as ImageIcon, Loader2, Pencil, RotateCcw, Search, Square, Upload } from "lucide-react";
import { toast } from "sonner";
import { EmpresaPicker } from "@/components/shared/empresa-picker";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { useConfirm } from "@/hooks/use-confirm";
import { gessService } from "@/lib/client/api/services/gess-service";
import { planosService } from "@/lib/client/api/services/planos-service";
import { uploadService } from "@/lib/client/api/services/upload-service";
import { ESTADOS_STAND, MAX_PRE_RESERVA_LOTE, UI_SENTINEL } from "@/lib/shared/constants";
import { estadoStandBadge } from "@/lib/shared/utils/estado-stand";
import type { GessStandDTO } from "@/types/dto/gess";
import type { EmpresaAccesoDTO } from "@/types/dto/usuarios/usuario.dto";

/** Estados sobre los que se puede operar desde esta vista. */
const ESTADOS_SELECCIONABLES: string[] = [ESTADOS_STAND.DISPONIBLE, ESTADOS_STAND.PRE_RESERVADO];

/** Etiqueta para stands sin pabellon resoluble (plano o nombre). */
const SIN_PABELLON = "Sin pabellon";

/** Algunos stand guardan coordenadas ("-10,-11") en `pabellon`; no son nombres. */
function esCoordenada(valor: string): boolean {
  return /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(valor.trim());
}

interface Props {
  eventoId: string;
  tipoEvento?: number;
  codigoEvento?: number;
}

export function PreReservasManager({ eventoId, tipoEvento, codigoEvento }: Props) {
  const { confirm, confirmDialog } = useConfirm();
  const [rows, setRows] = useState<GessStandDTO[]>([]);
  const [bloquePlano, setBloquePlano] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pabellon, setPabellon] = useState<string>(UI_SENTINEL.TODOS);
  const [tipo, setTipo] = useState<string>(UI_SENTINEL.TODOS);
  const [estadoFiltro, setEstadoFiltro] = useState<string>(UI_SENTINEL.TODOS);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editRow, setEditRow] = useState<GessStandDTO | null>(null);
  const [modo, setModo] = useState<"empresa" | "titulo">("empresa");
  const [empresa, setEmpresa] = useState<EmpresaAccesoDTO | null>(null);
  const [titulo, setTitulo] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gessService.all(eventoId);
      setRows(data);
      setSeleccion(new Set());
    } catch {
      setRows([]);
    }
    setLoading(false);
  }, [eventoId]);

  useEffect(() => {
    void (async () => { await load(); })();
  }, [load]);

  /* Pabellon por bloque: los planos del evento dan el nombre real (no la coordenada cruda). */
  useEffect(() => {
    if (!tipoEvento || !codigoEvento) return;
    let activo = true;
    planosService.planosDeEvento(tipoEvento, codigoEvento)
      .then((planes) => {
        if (!activo) return;
        const mapa = new Map<string, string>();
        for (const plano of planes) {
          for (const bloque of plano.bloques) {
            mapa.set(bloque.bloqueId, plano.nombre?.trim() || plano.codigo);
          }
        }
        setBloquePlano(mapa);
      })
      .catch(() => {});
    return () => { activo = false; };
  }, [tipoEvento, codigoEvento]);

  const pabellonDe = useCallback((r: GessStandDTO): string => {
    const porBloque = r.bloqueId ? bloquePlano.get(r.bloqueId) : undefined;
    if (porBloque) return porBloque;
    const crudo = r.pabellon?.trim();
    if (crudo && !esCoordenada(crudo)) return crudo;
    return SIN_PABELLON;
  }, [bloquePlano]);

  const pabellones = useMemo(
    () => [...new Set(rows.map(pabellonDe))].sort(),
    [rows, pabellonDe],
  );
  const tipos = useMemo(
    () => [...new Set(rows.map((r) => r.tipoStand).filter((t): t is string => Boolean(t)))].sort(),
    [rows],
  );

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (estadoFiltro !== UI_SENTINEL.TODOS && r.estado !== estadoFiltro) return false;
      if (pabellon !== UI_SENTINEL.TODOS && pabellonDe(r) !== pabellon) return false;
      if (tipo !== UI_SENTINEL.TODOS && r.tipoStand !== tipo) return false;
      if (!q) return true;
      return `${r.standCode} ${r.empresa ?? ""} ${r.tipoStand ?? ""} ${pabellonDe(r)}`.toLowerCase().includes(q);
    });
  }, [rows, search, pabellon, tipo, estadoFiltro, pabellonDe]);

  const seleccionables = filtrados.filter((r) => ESTADOS_SELECCIONABLES.includes(r.estado ?? ""));
  const seleccionadosDisponibles = filtrados.filter((r) => seleccion.has(r.id) && r.estado === ESTADOS_STAND.DISPONIBLE);
  const seleccionadosPre = filtrados.filter((r) => seleccion.has(r.id) && r.estado === ESTADOS_STAND.PRE_RESERVADO);
  const todosFiltradosSeleccionados = seleccionables.length > 0 && seleccionables.every((r) => seleccion.has(r.id));

  const toggle = (row: GessStandDTO) => {
    if (!ESTADOS_SELECCIONABLES.includes(row.estado ?? "")) return;
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      return next;
    });
  };

  const toggleTodosFiltrados = () => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (todosFiltradosSeleccionados) {
        for (const r of seleccionables) next.delete(r.id);
      } else {
        for (const r of seleccionables) next.add(r.id);
      }
      return next;
    });
  };

  const abrirPreReserva = () => {
    if (seleccionadosDisponibles.length > MAX_PRE_RESERVA_LOTE) {
      toast.error(`Maximo ${MAX_PRE_RESERVA_LOTE} stands por operacion; filtra para reducir la seleccion`);
      return;
    }
    setEditRow(null);
    setModo("empresa");
    setEmpresa(null);
    setTitulo("");
    setLogoUrl("");
    setNota("");
    setModalAbierto(true);
  };

  const abrirEditar = (row: GessStandDTO) => {
    setEditRow(row);
    if (row.preReservaTitulo) {
      setModo("titulo");
      setEmpresa(null);
      setTitulo(row.preReservaTitulo);
    } else {
      setModo("empresa");
      setEmpresa({
        idEmpresa: row.preReservaSie ?? "",
        nombreEmpresa: row.preReservaRazonSocial ?? row.empresa ?? "",
        ruc: row.preReservaRuc ?? null,
      });
      setTitulo("");
    }
    setLogoUrl(row.preReservaLogoUrl ?? "");
    setNota(row.preReservaNota ?? "");
    setModalAbierto(true);
  };

  const onLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSubiendoLogo(true);
    try {
      setLogoUrl(await uploadService.subir(file));
    } catch {
      toast.error("No se pudo subir el logo");
    }
    setSubiendoLogo(false);
  };

  const confirmarPreReserva = async () => {
    if (modo === "empresa" && !empresa) {
      toast.error("Selecciona la empresa");
      return;
    }
    if (modo === "titulo" && !titulo.trim()) {
      toast.error("Ingresa el titulo");
      return;
    }
    const identidad = modo === "empresa" && empresa
      ? { razonSocial: empresa.nombreEmpresa, ruc: empresa.ruc ?? null, sie: empresa.idEmpresa, titulo: null }
      : { razonSocial: null, ruc: null, sie: null, titulo: titulo.trim() };
    setGuardando(true);
    try {
      if (editRow) {
        await gessService.actualizarPreReserva({
          standId: editRow.id,
          ...identidad,
          logoUrl: logoUrl || null,
          nota: nota.trim() || null,
        });
        toast.success("Pre-reserva actualizada");
      } else {
        const res = await gessService.preReservar({
          standIds: seleccionadosDisponibles.map((r) => r.id),
          ...identidad,
          logoUrl: logoUrl || null,
          nota: nota.trim() || null,
        });
        toast.success(`${res.preReservados} stand(s) pre-reservado(s)`);
      }
      setModalAbierto(false);
      setEditRow(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la pre-reserva");
    }
    setGuardando(false);
  };

  const liberar = async () => {
    const ok = await confirm({
      title: "Liberar pre-reservas",
      description: `${seleccionadosPre.length} stand(s) volveran a estado Disponible y se limpiara la empresa asignada.`,
    });
    if (!ok) return;
    try {
      const res = await gessService.liberarPreReserva(seleccionadosPre.map((r) => r.id));
      toast.success(`${res.liberados} stand(s) liberado(s)`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron liberar");
    }
  };

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bookmark className="h-4 w-4" />
            Pre-reservas del evento
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={seleccionadosDisponibles.length === 0}
              onClick={abrirPreReserva}
            >
              <Bookmark className="h-3.5 w-3.5" />
              Pre-reservar ({seleccionadosDisponibles.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={seleccionadosPre.length === 0}
              onClick={() => { void liberar(); }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Liberar ({seleccionadosPre.length})
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar stand o empresa"
              className="pl-8"
            />
          </div>
          <Select value={pabellon} onValueChange={setPabellon}>
            <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Pabellon" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={UI_SENTINEL.TODOS}>Todos los pabellones</SelectItem>
              {pabellones.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={UI_SENTINEL.TODOS}>Todos los tipos</SelectItem>
              {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={estadoFiltro} onValueChange={setEstadoFiltro}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={UI_SENTINEL.TODOS}>Todos los estados</SelectItem>
              <SelectItem value={ESTADOS_STAND.DISPONIBLE}>Disponibles</SelectItem>
              <SelectItem value={ESTADOS_STAND.PRE_RESERVADO}>Pre-reservados</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={toggleTodosFiltrados} disabled={seleccionables.length === 0}>
            {todosFiltradosSeleccionados ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
            {todosFiltradosSeleccionados ? "Quitar seleccion" : `Seleccionar todo (${seleccionables.length})`}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {filtrados.length} de {rows.length} stands · seleccionados: {seleccion.size}
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <TableSkeleton rows={6} />
        ) : (
          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Stand</TableHead>
                  <TableHead>Pabellon</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Empresa / Titulo</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((r) => {
                  const badge = estadoStandBadge(r.estado);
                  const seleccionable = ESTADOS_SELECCIONABLES.includes(r.estado ?? "");
                  const checked = seleccion.has(r.id);
                  return (
                    <TableRow
                      key={r.id}
                      className={seleccionable ? "cursor-pointer" : "opacity-70"}
                      onClick={() => toggle(r)}
                    >
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          disabled={!seleccionable}
                          onCheckedChange={() => toggle(r)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Seleccionar stand ${r.standCode}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.standCode}</TableCell>
                      <TableCell className="text-xs">{pabellonDe(r)}</TableCell>
                      <TableCell className="text-xs">{r.tipoStand ?? "-"}</TableCell>
                      <TableCell>
                        {badge ? <Badge className={badge.clase}>{badge.texto}</Badge> : <span className="text-xs text-muted-foreground">{r.estado ?? "-"}</span>}
                      </TableCell>
                      <TableCell className="text-xs" title={r.preReservaRazonSocial ?? r.preReservaTitulo ?? r.empresa ?? undefined}>
                        <span className="flex items-center gap-2">
                          {r.estado === ESTADOS_STAND.PRE_RESERVADO && r.preReservaLogoUrl && (
                            <img src={r.preReservaLogoUrl} alt="" className="h-4 w-4 rounded border bg-white object-contain" />
                          )}
                          {r.empresa ?? "-"}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground" title={r.preReservaNota ?? undefined}>
                        {r.estado === ESTADOS_STAND.PRE_RESERVADO ? (r.preReservaNota ?? "-") : "-"}
                      </TableCell>
                      <TableCell>
                        {r.estado === ESTADOS_STAND.PRE_RESERVADO && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title="Editar pre-reserva"
                            onClick={(e) => { e.stopPropagation(); abrirEditar(r); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={modalAbierto} onOpenChange={(open) => { if (!guardando) { setModalAbierto(open); if (!open) setEditRow(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editRow ? `Editar pre-reserva · ${editRow.standCode}` : `Pre-reservar ${seleccionadosDisponibles.length} stand(s)`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Tabs value={modo} onValueChange={(v) => setModo(v as "empresa" | "titulo")}>
              <TabsList className="w-full">
                <TabsTrigger value="empresa" className="flex-1">Empresa</TabsTrigger>
                <TabsTrigger value="titulo" className="flex-1">Titulo</TabsTrigger>
              </TabsList>
            </Tabs>
            {modo === "empresa" ? (
              <EmpresaPicker seleccion={empresa} onSeleccion={setEmpresa} />
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="pre-reserva-titulo">Titulo</Label>
                <Input
                  id="pre-reserva-titulo"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  maxLength={200}
                  placeholder="Ej. Reservado para auspicios / bloqueo interno"
                />
                <p className="text-[11px] text-muted-foreground">Se muestra en el plano (hover) tal como lo escribas.</p>
              </div>
            )}
            <div>
              <Label className="text-xs">Logo (opcional)</Label>
              <div className="mt-1 flex items-center gap-3">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo de la empresa" className="h-12 w-12 rounded-lg border bg-white object-contain p-1" />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                    <ImageIcon className="h-4 w-4" />
                  </span>
                )}
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onLogoFile(e); }} />
                <Button type="button" variant="outline" size="sm" className="rounded-full text-xs" disabled={subiendoLogo} onClick={() => logoRef.current?.click()}>
                  {subiendoLogo ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                  {logoUrl ? "Cambiar logo" : "Subir logo"}
                </Button>
                {logoUrl && (
                  <Button type="button" variant="ghost" size="sm" className="rounded-full text-xs text-destructive" onClick={() => setLogoUrl("")}>
                    Quitar
                  </Button>
                )}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Se pinta en los stands pre-reservados del mapa.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pre-reserva-nota">Nota (opcional)</Label>
              <Input
                id="pre-reserva-nota"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                maxLength={300}
                placeholder="Ej. reserva previa por acuerdo comercial"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={guardando} onClick={() => setModalAbierto(false)}>Cancelar</Button>
            <Button disabled={guardando || (modo === "empresa" ? !empresa : !titulo.trim())} onClick={() => { void confirmarPreReserva(); }}>
              {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : editRow ? <Pencil className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
              {editRow ? "Guardar cambios" : "Pre-reservar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </Card>
  );
}
