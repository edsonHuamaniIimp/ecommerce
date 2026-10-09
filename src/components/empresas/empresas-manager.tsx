"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tooltip, TooltipContent, TooltipTrigger } from "@nrivera-iimp/ui-kit-iimp";
import { Building2, KeyRound, Mail, Pencil, Plus, Power, RefreshCw, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/shared/pagination";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { useConfirm } from "@/hooks/use-confirm";
import { empresasService } from "@/lib/client/api/services/empresas-service";
import { BADGE_STYLES, ESTADOS_EMPRESA, PER_PAGE_OPCIONES, TIPO_COMPROBANTE_LABELS } from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import type { EmpresaDTO } from "@/types/dto/empresas";
import { EmpresaFormModal } from "./empresa-form-modal";
import { EmpresaCargaMasivaModal } from "./empresa-carga-masiva-modal";
import { RegistrarEmpresaFuenteModal } from "./registrar-empresa-fuente-modal";

function EstadoEmpresaBadge({ estado }: { estado: string }) {
  const activa = estado === ESTADOS_EMPRESA.ACTIVA;
  return (
    <Badge className={`pointer-events-none gap-1 text-[10px] ${activa ? BADGE_STYLES.SUCCESS : BADGE_STYLES.NEUTRAL}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${activa ? "bg-success" : "bg-muted-foreground"}`} />
      <span>{activa ? "Activa" : "Inactiva"}</span>
    </Badge>
  );
}

/** Bandeja de empresas registradas por el backoffice (alta individual + edicion). */
export function EmpresasManager() {
  const [rows, setRows] = useState<EmpresaDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState<string>("todas");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [formOpen, setFormOpen] = useState(false);
  const [cargaOpen, setCargaOpen] = useState(false);
  const [fuenteOpen, setFuenteOpen] = useState(false);
  const [editando, setEditando] = useState<EmpresaDTO | null>(null);
  /* Credenciales generadas: se muestran una vez (no se envian correos). */
  const [credenciales, setCredenciales] = useState<{ razonSocial: string; usuario: string; passwordTemporal: string } | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  const pageRef = useRef(page);
  const perPageRef = useRef(perPage);
  const searchRef = useRef(search);
  const estadoRef = useRef(estado);
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { perPageRef.current = perPage; }, [perPage]);
  useEffect(() => { searchRef.current = search; }, [search]);
  useEffect(() => { estadoRef.current = estado; }, [estado]);

  const load = useCallback(async (p?: number, s?: string, pp?: number, e?: string) => {
    setLoading(true);
    try {
      const estadoActual = e ?? estadoRef.current;
      const data = await empresasService.listar({
        page: p ?? pageRef.current,
        perPage: pp ?? perPageRef.current,
        search: (s ?? searchRef.current).trim() || undefined,
        estado: estadoActual === "todas" ? undefined : estadoActual,
      });
      setRows(data.data ?? []);
      setPagination({ page: data.page, total: data.total, totalPages: data.totalPages });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar las empresas");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

  const cambiarEstado = async (empresa: EmpresaDTO) => {
    const activa = empresa.estado === ESTADOS_EMPRESA.ACTIVA;
    const ok = await confirm({
      title: activa ? "Desactivar empresa" : "Activar empresa",
      description: activa
        ? `"${empresa.razonSocial}" quedara inactiva: no podra acceder al portal ni registrar nuevas reservas. La informacion se conserva.`
        : `"${empresa.razonSocial}" volvera a estar activa en el Portal del Cliente.`,
      confirmLabel: activa ? "Desactivar" : "Activar",
      destructive: activa,
    });
    if (!ok) return;
    try {
      await empresasService.cambiarEstado(empresa.id, activa ? ESTADOS_EMPRESA.INACTIVA : ESTADOS_EMPRESA.ACTIVA);
      toast.success(activa ? "Empresa desactivada" : "Empresa activada");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cambiar el estado");
    }
  };

  /**
   * Crea la cuenta de acceso SOLO con RUC (no se envia correo): la contrasena
   * temporal se muestra una vez para entregarla al representante.
   */
  const crearCuenta = async (empresa: EmpresaDTO) => {
    const ok = await confirm({
      title: "Crear cuenta de acceso",
      description: `Se creara la cuenta de "${empresa.razonSocial}" usando su RUC como usuario. Se mostrara la contrasena temporal para que la entregues al representante; al primer ingreso el sistema le pedira cambiarla y completar sus datos (DNI, correo, celular, direccion) en el perfil.`,
      confirmLabel: "Crear cuenta",
    });
    if (!ok) return;
    try {
      const resultado = await empresasService.crearCuenta(empresa.id);
      setCredenciales({ razonSocial: empresa.razonSocial, usuario: resultado.usuario, passwordTemporal: resultado.passwordTemporal });
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear la cuenta");
    }
  };

  /** Repone la contrasena temporal: la muestra si la cuenta es solo-RUC; si tiene correo real, la reenvia. */
  const reenviarCredenciales = async (empresa: EmpresaDTO) => {
    const ok = await confirm({
      title: "Reponer contrasena temporal",
      description: `Se generara una nueva contrasena temporal para "${empresa.razonSocial}". La contrasena anterior dejara de funcionar.`,
      confirmLabel: "Reponer",
      destructive: true,
    });
    if (!ok) return;
    try {
      const resultado = await empresasService.reenviarCredenciales(empresa.id);
      if (resultado.emailEnviado === true) {
        toast.success(`Credenciales reenviadas a ${resultado.email}.`);
      } else {
        setCredenciales({ razonSocial: empresa.razonSocial, usuario: resultado.usuario, passwordTemporal: resultado.passwordTemporal });
      }
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron reponer las credenciales");
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 border-b border-border pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-sm font-semibold text-primary">Empresas registradas</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
              {pagination.total}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Usa la llave para crear la cuenta de acceso (usuario = RUC). No se envian correos: el representante completa sus datos en el primer ingreso.
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setCargaOpen(true)}
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Carga masiva</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setFuenteOpen(true)}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Registrar desde servicio-persona</span>
              <span className="sm:hidden">Servicio</span>
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs font-semibold"
              onClick={() => { setEditando(null); setFormOpen(true); }}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Nueva empresa</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por razon social o RUC..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); void load(1, e.currentTarget.value, perPage, estado); } }}
              className="h-8 border-border bg-secondary pl-8 text-xs placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>
          <Select value={estado} onValueChange={(v) => { setEstado(v); setPage(1); void load(1, search, perPage, v); }}>
            <SelectTrigger className="h-8 w-full border-border text-xs sm:w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas"><span>Todas</span></SelectItem>
              <SelectItem value={ESTADOS_EMPRESA.ACTIVA}><span>Activas</span></SelectItem>
              <SelectItem value={ESTADOS_EMPRESA.INACTIVA}><span>Inactivas</span></SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); void load(1, search, Number(v), estado); }}>
            <SelectTrigger className="h-8 w-[70px] shrink-0 border-border text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PER_PAGE_OPCIONES.map((n) => (
                <SelectItem key={n} value={String(n)}><span>{n}</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 w-8 shrink-0 p-0" onClick={() => void load(page, search, perPage, estado)} disabled={loading} title="Recargar">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-4">
        {loading ? (
          <TableSkeleton rows={perPage} columns={7} />
        ) : rows.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">No hay empresas registradas.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Registra la primera empresa para habilitar su acceso al Portal del Cliente.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] uppercase tracking-wide">Razon social</TableHead>
                    <TableHead className="hidden text-[10px] uppercase tracking-wide md:table-cell">RUC</TableHead>
                    <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell">Contacto</TableHead>
                    <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell">Comprobante</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wide">Cuenta</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wide">Estado</TableHead>
                    <TableHead className="text-right text-[10px] uppercase tracking-wide">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((empresa) => (
                    <TableRow key={empresa.id}>
                      <TableCell className="max-w-[260px]">
                        <p className="truncate text-xs font-semibold text-foreground">{empresa.razonSocial}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {empresa.representanteLegalNombre ?? "Sin representante legal"}
                          {empresa.creadoPor ? ` · ${dateUtils.formatDateTime(empresa.createdAt)}` : ""}
                        </p>
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs md:table-cell">{empresa.ruc}</TableCell>
                      <TableCell className="hidden max-w-[200px] truncate text-xs lg:table-cell">
                        {empresa.emailFacturacion ?? empresa.emailContacto ?? "—"}
                      </TableCell>
                      <TableCell className="hidden text-xs lg:table-cell">
                        {TIPO_COMPROBANTE_LABELS[empresa.tipoComprobante] ?? empresa.tipoComprobante}
                      </TableCell>
                      <TableCell>
                        <Badge className={`pointer-events-none text-[10px] ${empresa.cuentaCreada ? BADGE_STYLES.SUCCESS : BADGE_STYLES.WARNING}`}>
                          <span>{empresa.cuentaCreada ? "Creada" : "Pendiente"}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <EstadoEmpresaBadge estado={empresa.estado} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          {!empresa.cuentaCreada ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-primary hover:text-primary"
                                  onClick={() => { void crearCuenta(empresa); }}
                                >
                                  <KeyRound className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top"><span>Crear cuenta de acceso (usuario = RUC)</span></TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => { void reenviarCredenciales(empresa); }}
                                >
                                  <Mail className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top"><span>Reponer contrasena temporal</span></TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => { setEditando(empresa); setFormOpen(true); }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top"><span>Editar empresa</span></TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-7 w-7 p-0 ${empresa.estado === ESTADOS_EMPRESA.ACTIVA ? "text-destructive hover:text-destructive" : "text-success hover:text-success"}`}
                                onClick={() => { void cambiarEstado(empresa); }}
                              >
                                <Power className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <span>{empresa.estado === ESTADOS_EMPRESA.ACTIVA ? "Desactivar empresa" : "Activar empresa"}</span>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-muted-foreground">
                {pagination.total} resultados — pagina {pagination.page} de {pagination.totalPages || 1}
              </span>
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={(p) => { setPage(p); void load(p, search, perPage, estado); }}
              />
            </div>
          </>
        )}
      </CardContent>

      {formOpen && (
        <EmpresaFormModal
          empresa={editando}
          onClose={() => setFormOpen(false)}
          onSaved={() => void load()}
        />
      )}
      {cargaOpen && (
        <EmpresaCargaMasivaModal
          onClose={() => setCargaOpen(false)}
          onSaved={() => void load()}
        />
      )}
      {fuenteOpen && (
        <RegistrarEmpresaFuenteModal
          onClose={() => setFuenteOpen(false)}
          onRegistrado={() => void load()}
        />
      )}
      {credenciales && (
        <Dialog open onOpenChange={(v) => { if (!v) setCredenciales(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="text-left">
              <DialogTitle className="text-base font-semibold">Credenciales de acceso (se muestran una sola vez)</DialogTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                <span>Cuenta de <strong>{credenciales.razonSocial}</strong>. No se envio ningun correo: entrega estos datos al representante legal.</span>
              </p>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label className="text-xs"><span>Usuario (RUC)</span></Label>
                <Input value={credenciales.usuario} readOnly className="h-8 font-mono text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs"><span>Contrasena temporal</span></Label>
                <Input value={credenciales.passwordTemporal} readOnly className="h-8 font-mono text-xs" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                <span>
                  El representante ingresa con su RUC y esta contrasena; el sistema le pedira cambiarla y
                  completar sus datos (DNI, correo, celular, direccion) en el perfil.
                </span>
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(
                    `Usuario: ${credenciales.usuario} | Contrasena: ${credenciales.passwordTemporal}`,
                  );
                  toast.success("Credenciales copiadas");
                }}
              >
                <span>Copiar</span>
              </Button>
              <Button size="sm" onClick={() => { setCredenciales(null); }}><span>Cerrar</span></Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {confirmDialog}
    </Card>
  );
}
