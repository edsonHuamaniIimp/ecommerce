"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@nrivera-iimp/ui-kit-iimp";
import { Download, Pencil, Power, PowerOff, Search, Send, Upload, UserPlus, UserSearch, Users } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/use-confirm";
import { Pagination } from "@/components/shared/pagination";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { usuariosService } from "@/lib/client/api/services/usuarios-service";
import { rolesService } from "@/lib/client/api/services/roles-service";
import { EmpresaPicker, type FuenteEmpresa } from "@/components/shared/empresa-picker";
import { BADGE_STYLES, ESTADOS_ACCESO_USUARIO, ESTADOS_ACTIVACION_LOTE, ESTADOS_DESACTIVACION_LOTE, FILTROS_USUARIO_EMPRESA, PER_PAGE_OPCIONES, REGEX_EMAIL, ROLES, TIPOS_DOCUMENTO_PERSONA, TIPOS_DOCUMENTO_PERSONA_LABELS, UI_SENTINEL, USUARIOS_LOTE_MAX_FILAS } from "@/lib/shared/constants";
import { normalizarTipoDocumentoPersona, validarDocumentoPersona } from "@/lib/shared/utils/documento-persona";
import { etiquetaTipoDocumentoEmpresa } from "@/lib/shared/utils/documento-empresa";
import { dateUtils } from "@/lib/shared/utils/date";
import type {
  CuentaActivacionLoteDTO,
  CuentaDesactivacionLoteDTO,
  EmpresaAccesoDTO,
  NuevoUsuarioPortalDTO,
  PersonaApiDTO,
  ResultadoActivacionLoteDTO,
  ResultadoCreacionUsuarioDTO,
  ResultadoDesactivacionLoteDTO,
  UsuarioPortalDTO,
} from "@/types/dto/usuarios/usuario.dto";

interface RolOpcion {
  id: string;
  nombre: string;
}

/** Filtro de la bandeja por empresa (UI_SENTINEL.TODOS = sin filtrar; server-side). */
type FiltroEmpresa = typeof UI_SENTINEL.TODOS | typeof FILTROS_USUARIO_EMPRESA.PORTAL | typeof FILTROS_USUARIO_EMPRESA.SIN_EMPRESA;

/** Fuentes del selector de empresa: primero las empresas del backoffice, luego el catalogo SIE. */
const FUENTES_EMPRESA: FuenteEmpresa[] = ["local", "sie"];

/**
 * Fila parseada del textarea de alta masiva (una linea por usuario):
 * tipoDocumento, documento, apellidoPaterno, apellidoMaterno, nombres, correo, celular.
 */
function parsearLineas(texto: string): NuevoUsuarioPortalDTO[] {
  return texto
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea) => {
      const [tipo = "", documento = "", apellidoPaterno = "", apellidoMaterno = "", nombres = "", correo = "", celular = ""] =
        linea.split(/\t|,|;/).map((c) => c.trim());
      return {
        tipoDocumento: normalizarTipoDocumentoPersona(tipo),
        documento,
        apellidoPaterno,
        apellidoMaterno: apellidoMaterno || null,
        nombres,
        email: correo,
        celular: celular || null,
      };
    });
}

function filaValida(fila: NuevoUsuarioPortalDTO): boolean {
  return REGEX_EMAIL.test(fila.email)
    && !validarDocumentoPersona(fila.tipoDocumento, fila.documento)
    && Boolean(fila.apellidoPaterno)
    && Boolean(fila.nombres);
}

function resultadoTexto(resultado: ResultadoCreacionUsuarioDTO): { texto: string; ok: boolean } {
  if (!resultado.creado) return { texto: resultado.error ?? "No se pudo crear", ok: false };
  if (resultado.emailEnviado === false) return { texto: "Creado, pero no se pudo enviar el correo", ok: false };
  return { texto: "Credenciales enviadas por correo", ok: true };
}

/** Cabeceras tipicas de un CSV de una columna (correo, RUC o RUT): se ignoran al importar. */
const CABECERAS_IDENTIFICADORES = ["correo", "email", "ruc", "rut", "identificador", "documento", "correo_o_ruc", "correo_ruc_o_rut"];

/** Lineas del textarea/CSV: una columna con correo o RUC; sin cabecera, sin vacios, sin duplicados. */
function parsearIdentificadores(texto: string): string[] {
  const vistos = new Set<string>();
  return texto
    .split(/\r?\n|,|;/)
    .map((linea) => linea.trim())
    .filter((linea) => linea && !CABECERAS_IDENTIFICADORES.includes(linea.toLowerCase()))
    .filter((linea) => {
      const clave = linea.toLowerCase();
      if (vistos.has(clave)) return false;
      vistos.add(clave);
      return true;
    });
}

/** Descarga la plantilla del CSV de desactivacion masiva (una columna: correo del login, RUC o RUT). */
function descargarPlantillaIdentificadores() {
  const contenido = `\uFEFFcorreo_ruc_o_rut\njperez@empresa.com\n20123456789\nFR48305461063\n`;
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = "plantilla-desactivar-usuarios.csv";
  enlace.click();
  URL.revokeObjectURL(url);
}

/** Presentacion de cada estado del lote (previsualizacion/resultado). */
const ESTADO_LOTE_UI: Record<CuentaDesactivacionLoteDTO["estado"], { texto: string; className: string }> = {
  [ESTADOS_DESACTIVACION_LOTE.DESACTIVADO]: { texto: "Desactivada", className: "bg-success/15 text-success" },
  [ESTADOS_DESACTIVACION_LOTE.POR_DESACTIVAR]: { texto: "Se desactivara", className: "bg-warning/15 text-warning" },
  [ESTADOS_DESACTIVACION_LOTE.YA_DESACTIVADO]: { texto: "Ya estaba desactivada", className: "bg-secondary text-muted-foreground" },
  [ESTADOS_DESACTIVACION_LOTE.OMITIDO]: { texto: "Omitida", className: "bg-destructive/10 text-destructive" },
};

/** Presentacion de cada estado de la habilitacion masiva (previsualizacion/resultado). */
const ESTADO_ACTIVACION_UI: Record<CuentaActivacionLoteDTO["estado"], { texto: string; className: string }> = {
  [ESTADOS_ACTIVACION_LOTE.PROGRAMADO]: { texto: "Programada", className: "bg-success/15 text-success" },
  [ESTADOS_ACTIVACION_LOTE.POR_PROGRAMAR]: { texto: "Se programara", className: "bg-warning/15 text-warning" },
  [ESTADOS_ACTIVACION_LOTE.YA_ACTIVA]: { texto: "Ya estaba activa", className: "bg-secondary text-muted-foreground" },
  [ESTADOS_ACTIVACION_LOTE.OMITIDO]: { texto: "Omitida", className: "bg-destructive/10 text-destructive" },
};

export function UsuariosManager() {
  const [usuarios, setUsuarios] = useState<UsuarioPortalDTO[]>([]);
  const [roles, setRoles] = useState<RolOpcion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEmpresa, setFiltroEmpresa] = useState<FiltroEmpresa>(UI_SENTINEL.TODOS);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<number>(PER_PAGE_OPCIONES[0]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [cargando, setCargando] = useState(true);
  const [modalIndividual, setModalIndividual] = useState(false);
  const [modalLote, setModalLote] = useState(false);
  const [modalDesactivarLote, setModalDesactivarLote] = useState(false);
  const [modalHabilitarLote, setModalHabilitarLote] = useState(false);
  const [modalBuscar, setModalBuscar] = useState(false);
  const [usuarioEditar, setUsuarioEditar] = useState<UsuarioPortalDTO | null>(null);
  const [enviandoAccesosId, setEnviandoAccesosId] = useState<string | null>(null);
  const [cambiandoEstadoId, setCambiandoEstadoId] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  const rolPorDefecto = useMemo(
    () => roles.find((r) => r.nombre === ROLES.CLIENTE)?.id ?? roles[0]?.id ?? "",
    [roles],
  );

  /* Refs para que recargar (tras mutaciones) no dependa de estado capturado. */
  const pageRef = useRef(page);
  const perPageRef = useRef(perPage);
  const busquedaRef = useRef(busqueda);
  const filtroRef = useRef(filtroEmpresa);
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { perPageRef.current = perPage; }, [perPage]);
  useEffect(() => { busquedaRef.current = busqueda; }, [busqueda]);
  useEffect(() => { filtroRef.current = filtroEmpresa; }, [filtroEmpresa]);

  /** Carga la pagina actual desde el backend (paginacion/busqueda/filtro server-side). */
  const cargar = useCallback(async (p?: number, s?: string, pp?: number, f?: FiltroEmpresa) => {
    setCargando(true);
    try {
      const filtroActual = f ?? filtroRef.current;
      const resultado = await usuariosService.listar({
        page: p ?? pageRef.current,
        per_page: pp ?? perPageRef.current,
        search: (s ?? busquedaRef.current).trim() || undefined,
        filtro: filtroActual === UI_SENTINEL.TODOS ? undefined : filtroActual,
      });
      setUsuarios(resultado.data ?? []);
      setPagination({
        page: resultado.pagination.page,
        total: resultado.pagination.total,
        totalPages: Math.max(1, resultado.pagination.total_pages),
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setUsuarios([]);
      setPagination({ page: 1, total: 0, totalPages: 1 });
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    (async () => { await cargar(); })();
  }, [cargar]);

  /* Roles del selector de alta: carga independiente del listado. */
  useEffect(() => {
    let activo = true;
    void (async () => {
      try {
        const listaRoles = await rolesService.list();
        if (activo) setRoles(listaRoles.map((r) => ({ id: r.id, nombre: r.nombre })));
      } catch {
        /* Sin roles el alta usa el default; el listado reporta su propio error. */
      }
    })();
    return () => { activo = false; };
  }, []);

  const enviarAccesos = async (usuario: UsuarioPortalDTO) => {
    setEnviandoAccesosId(usuario.id);
    try {
      const resultado = await usuariosService.enviarAccesos({ id: usuario.id });
      if (resultado.emailEnviado) {
        toast.success(`Credenciales reenviadas a ${resultado.email}`);
      } else {
        toast.warning(`Credencial regenerada, pero no se pudo enviar el correo a ${resultado.email}`);
      }
      void cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron enviar los accesos");
    } finally {
      setEnviandoAccesosId(null);
    }
  };

  const cambiarEstado = async (usuario: UsuarioPortalDTO) => {
    const deshabilitar = usuario.flgActivo;
    const ok = await confirm({
      title: deshabilitar ? "Deshabilitar usuario" : "Habilitar usuario",
      description: deshabilitar
        ? `${usuario.email} no podra iniciar sesion y su sesion activa se cerrara.`
        : `${usuario.email} podra volver a iniciar sesion.`,
      confirmLabel: deshabilitar ? "Deshabilitar" : "Habilitar",
      destructive: deshabilitar,
    });
    if (!ok) return;
    setCambiandoEstadoId(usuario.id);
    try {
      await usuariosService.actualizar({
        id: usuario.id,
        flgActivo: deshabilitar ? ESTADOS_ACCESO_USUARIO.DESHABILITADO : ESTADOS_ACCESO_USUARIO.ACTIVO,
      });
      toast.success(deshabilitar ? `Usuario ${usuario.email} deshabilitado` : `Usuario ${usuario.email} habilitado`);
      void cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el estado");
    } finally {
      setCambiandoEstadoId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {cargando && usuarios.length === 0
            ? "Cargando..."
            : `${pagination.total} resultado(s) — pagina ${pagination.page} de ${pagination.totalPages}`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filtroEmpresa}
            onValueChange={(v) => {
              const filtro = v as FiltroEmpresa;
              setFiltroEmpresa(filtro);
              setPage(1);
              void cargar(1, busqueda, perPage, filtro);
            }}
          >
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UI_SENTINEL.TODOS}><span>Todos</span></SelectItem>
              <SelectItem value={FILTROS_USUARIO_EMPRESA.PORTAL}><span>Con empresa (Portal)</span></SelectItem>
              <SelectItem value={FILTROS_USUARIO_EMPRESA.SIN_EMPRESA}><span>Sin empresa</span></SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por correo, ID, empresa..."
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  void cargar(1, e.currentTarget.value, perPage, filtroEmpresa);
                }
              }}
              className="h-8 w-[240px] pl-8 text-xs"
            />
          </div>
          <Select
            value={String(perPage)}
            onValueChange={(v) => {
              const n = Number(v);
              setPerPage(n);
              setPage(1);
              void cargar(1, busqueda, n, filtroEmpresa);
            }}
          >
            <SelectTrigger className="h-8 w-[70px] shrink-0 text-xs" title="Registros por pagina">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PER_PAGE_OPCIONES.map((n) => (
                <SelectItem key={n} value={String(n)}><span>{n}</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8" onClick={() => { setModalBuscar(true); }}>
            <UserSearch className="mr-1 h-3.5 w-3.5" />
            <span>Buscar persona (API)</span>
          </Button>
          <Button size="sm" className="h-8" onClick={() => { setModalIndividual(true); }}>
            <UserPlus className="mr-1 h-3.5 w-3.5" />
            <span>Nuevo usuario</span>
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => { setModalLote(true); }}>
            <Users className="mr-1 h-3.5 w-3.5" />
            <span>Crear varios</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-destructive hover:text-destructive"
            onClick={() => { setModalDesactivarLote(true); }}
          >
            <PowerOff className="mr-1 h-3.5 w-3.5" />
            <span>Desactivar en lote</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-success hover:text-success"
            onClick={() => { setModalHabilitarLote(true); }}
          >
            <Power className="mr-1 h-3.5 w-3.5" />
            <span>Habilitar en lote</span>
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        La persona vive en <strong>servicio-persona</strong> (fuente) y la empresa se elige de la API de entidades
        (codigo SIE). Aqui se guarda el identificador de la persona, el correo, la empresa y el rol. Incluye usuarios
        internos (sin empresa): usalos con el filtro y asignales empresa con el lapiz.
      </p>

      {error ? (
        <p className="text-sm text-destructive">Error al cargar usuarios: {error}</p>
      ) : cargando && usuarios.length === 0 ? (
        <TableSkeleton rows={perPage} columns={7} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] uppercase">Correo</TableHead>
                <TableHead className="text-[10px] uppercase">ID Persona</TableHead>
                <TableHead className="text-[10px] uppercase">Empresa</TableHead>
                <TableHead className="text-[10px] uppercase">Rol</TableHead>
                <TableHead className="text-[10px] uppercase">Credencial</TableHead>
                <TableHead className="text-[10px] uppercase">Estado</TableHead>
                <TableHead className="text-right text-[10px] uppercase">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="text-xs font-medium">{u.email}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{u.sieCode ?? "—"}</TableCell>
                  <TableCell className="max-w-[240px] text-xs text-muted-foreground">
                    {u.esPortal ? (
                      <>
                        <span className="block truncate">{u.empresa ?? "—"}</span>
                        {u.idEmpresa && <span className="block font-mono text-[10px]">{u.idEmpresa}</span>}
                      </>
                    ) : (
                      <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.WARNING}`}><span>Sin empresa</span></Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="pointer-events-none text-[10px]"><span>{u.rol}</span></Badge>
                  </TableCell>
                  <TableCell>
                    {u.debeCambiarPassword ? (
                      <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.WARNING}`}><span>Temporal</span></Badge>
                    ) : (
                      <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.SUCCESS}`}><span>Activa</span></Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.flgActivo ? (
                      <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.SUCCESS}`}><span>Activo</span></Badge>
                    ) : (
                      <>
                        <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.DESTRUCTIVE}`}><span>Deshabilitado</span></Badge>
                        {u.reactivarEn && (
                          <span className="mt-0.5 block text-[10px] text-muted-foreground">
                            reactiva {dateUtils.formatDateTime(u.reactivarEn)}
                          </span>
                        )}
                      </>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-0.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 p-0"
                            onClick={() => { setUsuarioEditar(u); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top"><span>Editar correo/empresa</span></TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 p-0"
                            disabled={enviandoAccesosId === u.id}
                            onClick={() => { void enviarAccesos(u); }}
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top"><span>Enviar accesos</span></TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 p-0"
                            disabled={cambiandoEstadoId === u.id}
                            onClick={() => { void cambiarEstado(u); }}
                          >
                            {u.flgActivo ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top"><span>{u.flgActivo ? "Deshabilitar" : "Habilitar"}</span></TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {usuarios.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                    <span>No hay usuarios que coincidan.</span>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="flex flex-col gap-2 border-t border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">
              {pagination.total} resultado(s) — pagina {pagination.page} de {pagination.totalPages}
            </span>
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={(p) => { setPage(p); void cargar(p, busqueda, perPage, filtroEmpresa); }}
            />
          </div>
        </div>
      )}

      {modalIndividual && (
        <NuevoUsuarioModal
          roles={roles}
          rolInicial={rolPorDefecto}
          onClose={() => { setModalIndividual(false); }}
          onCreado={() => { void cargar(); }}
        />
      )}
      {modalLote && (
        <CrearUsuariosLoteModal
          roles={roles}
          rolInicial={rolPorDefecto}
          onClose={() => { setModalLote(false); }}
          onCreado={() => { void cargar(); }}
        />
      )}
      {modalBuscar && (
        <BuscarPersonaModal
          roles={roles}
          rolInicial={rolPorDefecto}
          onClose={() => { setModalBuscar(false); }}
          onCreado={() => { void cargar(); }}
        />
      )}
      {modalDesactivarLote && (
        <DesactivarUsuariosLoteModal
          onClose={() => { setModalDesactivarLote(false); }}
          onDesactivados={() => { void cargar(); }}
        />
      )}
      {modalHabilitarLote && (
        <ProgramarActivacionLoteModal
          onClose={() => { setModalHabilitarLote(false); }}
          onProgramados={() => { void cargar(); }}
        />
      )}
      {usuarioEditar && (
        <EditarUsuarioModal
          usuario={usuarioEditar}
          onClose={() => { setUsuarioEditar(null); }}
          onGuardado={() => { void cargar(); }}
        />
      )}
      {confirmDialog}
    </div>
  );
}

/**
 * Desactivacion masiva de accesos: una linea por correo del login o RUC de la
 * empresa. El servidor resuelve las cuentas (previsualizacion) y solo con la
 * confirmacion destructiva ejecuta la desactivacion.
 */
function DesactivarUsuariosLoteModal({ onClose, onDesactivados }: {
  onClose: () => void;
  onDesactivados: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [previsualizando, setPrevisualizando] = useState(false);
  const [desactivando, setDesactivando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoDesactivacionLoteDTO | null>(null);
  const [ejecutado, setEjecutado] = useState(false);
  const [reactivarEn, setReactivarEn] = useState("");
  const archivoRef = useRef<HTMLInputElement>(null);
  const { confirm, confirmDialog } = useConfirm();

  const identificadores = useMemo(() => parsearIdentificadores(texto), [texto]);

  /** ISO de la reactivacion programada ("" = sin programar) o null si es invalida. */
  const reactivarIso = (): string | null => {
    if (!reactivarEn) return null;
    const d = new Date(reactivarEn);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };

  /** Error de la fecha de reactivacion programada (null = ok). */
  const errorReactivacion = (): string | null => {
    if (!reactivarEn) return null;
    const d = new Date(reactivarEn);
    if (Number.isNaN(d.getTime())) return "Fecha de reactivacion invalida";
    if (d.getTime() <= Date.now()) return "La fecha de reactivacion debe ser futura";
    return null;
  };

  const importarArchivo = async (file: File | null) => {
    if (!file) return;
    const contenido = (await file.text()).replace(/^\uFEFF/, "");
    setTexto((prev) => (prev.trim() ? `${prev.trimEnd()}\n${contenido}` : contenido));
  };

  const previsualizar = async () => {
    setError(null);
    if (identificadores.length === 0) { setError("Agrega al menos un correo, RUC o RUT"); return; }
    if (identificadores.length > USUARIOS_LOTE_MAX_FILAS) { setError(`Maximo ${USUARIOS_LOTE_MAX_FILAS} filas por lote`); return; }
    const errFecha = errorReactivacion();
    if (errFecha) { setError(errFecha); return; }
    setPrevisualizando(true);
    try {
      setResultado(await usuariosService.desactivarLote({ identificadores, confirmar: false, reactivarEn: reactivarIso() }));
      setEjecutado(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al previsualizar");
    } finally {
      setPrevisualizando(false);
    }
  };

  const ejecutar = async () => {
    if (!resultado || resultado.resumen.porDesactivar === 0) return;
    const programada = reactivarIso();
    const ok = await confirm({
      title: "Desactivar cuentas",
      description: `Se desactivaran ${resultado.resumen.porDesactivar} cuenta(s): no podran ingresar al portal y su sesion activa se cortara.`
        + (programada ? ` Se reactivaran automaticamente el ${dateUtils.formatDateTime(programada)}.` : ""),
      confirmLabel: "Desactivar",
      destructive: true,
    });
    if (!ok) return;
    setError(null);
    setDesactivando(true);
    try {
      const r = await usuariosService.desactivarLote({ identificadores, confirmar: true, reactivarEn: programada });
      setResultado(r);
      setEjecutado(true);
      if (r.resumen.desactivadas > 0) {
        toast.success(`${r.resumen.desactivadas} cuenta(s) desactivada(s)`);
        onDesactivados();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al desactivar");
    } finally {
      setDesactivando(false);
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden sm:max-w-lg">
          <DialogHeader className="shrink-0">
            <DialogTitle><span>Desactivar cuentas en lote</span></DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-3">
            {!resultado ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="desactivar-lote" className="text-xs">
                    <span>Correos (login), RUC o RUT de la empresa, uno por linea</span>
                  </Label>
                  <Textarea
                    id="desactivar-lote"
                    value={texto}
                    onChange={(e) => { setTexto(e.target.value); }}
                    rows={8}
                    placeholder={"jperez@empresa.com\n20123456789\nFR48305461063"}
                    className="text-xs"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground">
                      {identificadores.length} fila(s) · un RUC o RUT desactiva todas las cuentas de su empresa.
                    </p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={descargarPlantillaIdentificadores}>
                        <Download className="mr-1 h-3.5 w-3.5" />
                        <span>Descargar plantilla</span>
                      </Button>
                      <input
                        ref={archivoRef}
                        type="file"
                        accept=".csv,.txt"
                        className="hidden"
                        onChange={(e) => { void importarArchivo(e.target.files?.[0] ?? null); e.target.value = ""; }}
                      />
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => archivoRef.current?.click()}>
                        <Upload className="mr-1 h-3.5 w-3.5" />
                        <span>Importar CSV</span>
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="desactivar-reactivar" className="text-xs">
                    <span>Reactivar automaticamente (opcional)</span>
                  </Label>
                  <Input
                    id="desactivar-reactivar"
                    type="datetime-local"
                    value={reactivarEn}
                    onChange={(e) => { setReactivarEn(e.target.value); }}
                    className="h-8 w-full text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Dia y hora en que las cuentas desactivadas volveran a estar activas (sin accion manual).
                  </p>
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
              </>
            ) : (
              <div className="space-y-2">
                <div className="space-y-1 rounded-lg border border-border p-2">
                  {resultado.cuentas.length === 0 && (
                    <p className="px-1 py-2 text-xs text-muted-foreground">Sin cuentas que coincidan con la lista.</p>
                  )}
                  {resultado.cuentas.map((cuenta) => (
                    <div key={cuenta.userId} className="flex items-center justify-between gap-2 rounded px-1 py-1 text-xs">
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium">{cuenta.email}</span>
                        {cuenta.empresa && <span className="text-muted-foreground"> · {cuenta.empresa}</span>}
                        {cuenta.tipoDocumento && (
                          <span className="ml-1.5 rounded-full bg-secondary px-1.5 py-0.5 text-[9px] text-muted-foreground">
                            {etiquetaTipoDocumentoEmpresa(cuenta.tipoDocumento)}
                          </span>
                        )}
                      </span>
                      {cuenta.motivo && <span className="shrink-0 text-[10px] text-muted-foreground">{cuenta.motivo}</span>}
                      <Badge className={`pointer-events-none shrink-0 text-[10px] ${ESTADO_LOTE_UI[cuenta.estado].className}`}>
                        <span>{ESTADO_LOTE_UI[cuenta.estado].texto}</span>
                      </Badge>
                    </div>
                  ))}
                  {resultado.noEncontrados.map((fila) => (
                    <div key={fila.identificador} className="flex items-center justify-between gap-2 rounded px-1 py-1 text-xs">
                      <span className="min-w-0 flex-1 truncate font-medium">{fila.identificador}</span>
                      <Badge className={`pointer-events-none shrink-0 text-[10px] ${BADGE_STYLES.DESTRUCTIVE}`}>
                        <span>{fila.motivo === "invalido" ? "Invalido" : "No encontrado"}</span>
                      </Badge>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {resultado.resumen.desactivadas} desactivada(s) · {resultado.resumen.porDesactivar} por desactivar ·{" "}
                  {resultado.resumen.yaDesactivadas} ya estaban desactivadas · {resultado.resumen.omitidas} omitida(s) ·{" "}
                  {resultado.resumen.noEncontrados} sin coincidencia.
                </p>
                {resultado.reactivarEn && (
                  <p className="text-[11px] font-medium text-primary">
                    Reactivacion programada: {dateUtils.formatDateTime(resultado.reactivarEn)}
                  </p>
                )}
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0">
            <Button variant="ghost" size="sm" onClick={onClose}><span>{resultado ? "Cerrar" : "Cancelar"}</span></Button>
            {!resultado ? (
              <Button size="sm" onClick={() => { void previsualizar(); }} disabled={previsualizando}>
                <span>{previsualizando ? "Revisando..." : `Previsualizar (${identificadores.length})`}</span>
              </Button>
            ) : !ejecutado && resultado.resumen.porDesactivar > 0 ? (
              <Button variant="destructive" size="sm" onClick={() => { void ejecutar(); }} disabled={desactivando}>
                <span>{desactivando ? "Desactivando..." : `Desactivar ${resultado.resumen.porDesactivar} cuenta(s)`}</span>
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </>
  );
}

/**
 * Habilitacion masiva: misma lista/plantilla que la desactivacion (correo, RUC o RUT),
 * pero en vez de desactivar programa la fecha/hora en que cada cuenta desactivada
 * volvera a estar activa; las cuentas activas se reportan y no se tocan.
 */
function ProgramarActivacionLoteModal({ onClose, onProgramados }: {
  onClose: () => void;
  onProgramados: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [activarEn, setActivarEn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [previsualizando, setPrevisualizando] = useState(false);
  const [programando, setProgramando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoActivacionLoteDTO | null>(null);
  const [ejecutado, setEjecutado] = useState(false);
  const archivoRef = useRef<HTMLInputElement>(null);
  const { confirm, confirmDialog } = useConfirm();

  const identificadores = useMemo(() => parsearIdentificadores(texto), [texto]);

  const activarIso = (): string => new Date(activarEn).toISOString();

  /** Error de la fecha de activacion (null = ok). */
  const errorFecha = (): string | null => {
    if (!activarEn) return "Elige la fecha y hora de activacion";
    const d = new Date(activarEn);
    if (Number.isNaN(d.getTime())) return "Fecha de activacion invalida";
    if (d.getTime() <= Date.now()) return "La fecha de activacion debe ser futura";
    return null;
  };

  const importarArchivo = async (file: File | null) => {
    if (!file) return;
    const contenido = (await file.text()).replace(/^\uFEFF/, "");
    setTexto((prev) => (prev.trim() ? `${prev.trimEnd()}\n${contenido}` : contenido));
  };

  const previsualizar = async () => {
    setError(null);
    if (identificadores.length === 0) { setError("Agrega al menos un correo, RUC o RUT"); return; }
    if (identificadores.length > USUARIOS_LOTE_MAX_FILAS) { setError(`Maximo ${USUARIOS_LOTE_MAX_FILAS} filas por lote`); return; }
    const errFecha = errorFecha();
    if (errFecha) { setError(errFecha); return; }
    setPrevisualizando(true);
    try {
      setResultado(await usuariosService.programarActivacionLote({ identificadores, confirmar: false, activarEn: activarIso() }));
      setEjecutado(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al previsualizar");
    } finally {
      setPrevisualizando(false);
    }
  };

  const ejecutar = async () => {
    if (!resultado || resultado.resumen.porProgramar === 0) return;
    const ok = await confirm({
      title: "Programar activacion",
      description: `Se programara la activacion de ${resultado.resumen.porProgramar} cuenta(s) para el ${dateUtils.formatDateTime(activarIso())}. Seguiran desactivadas hasta esa fecha y hora.`,
      confirmLabel: "Programar",
    });
    if (!ok) return;
    setError(null);
    setProgramando(true);
    try {
      const r = await usuariosService.programarActivacionLote({ identificadores, confirmar: true, activarEn: activarIso() });
      setResultado(r);
      setEjecutado(true);
      if (r.resumen.programadas > 0) {
        toast.success(`${r.resumen.programadas} cuenta(s) programada(s) para su activacion`);
        onProgramados();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al programar");
    } finally {
      setProgramando(false);
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden sm:max-w-lg">
          <DialogHeader className="shrink-0">
            <DialogTitle><span>Habilitar cuentas en lote</span></DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-3">
            {!resultado ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="activar-lote" className="text-xs">
                    <span>Correos (login), RUC o RUT de la empresa, uno por linea</span>
                  </Label>
                  <Textarea
                    id="activar-lote"
                    value={texto}
                    onChange={(e) => { setTexto(e.target.value); }}
                    rows={7}
                    placeholder={"jperez@empresa.com\n20123456789\nFR48305461063"}
                    className="text-xs"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground">
                      {identificadores.length} fila(s) · misma plantilla que la desactivacion en lote.
                    </p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={descargarPlantillaIdentificadores}>
                        <Download className="mr-1 h-3.5 w-3.5" />
                        <span>Descargar plantilla</span>
                      </Button>
                      <input
                        ref={archivoRef}
                        type="file"
                        accept=".csv,.txt"
                        className="hidden"
                        onChange={(e) => { void importarArchivo(e.target.files?.[0] ?? null); e.target.value = ""; }}
                      />
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => archivoRef.current?.click()}>
                        <Upload className="mr-1 h-3.5 w-3.5" />
                        <span>Importar CSV</span>
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="activar-fecha" className="text-xs">
                    <span>Activar el (dia y hora) *</span>
                  </Label>
                  <Input
                    id="activar-fecha"
                    type="datetime-local"
                    value={activarEn}
                    onChange={(e) => { setActivarEn(e.target.value); }}
                    className="h-8 w-full text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Las cuentas desactivadas de la lista volveran a estar activas a esa fecha y hora
                    (las cuentas activas se omiten).
                  </p>
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
              </>
            ) : (
              <div className="space-y-2">
                <div className="space-y-1 rounded-lg border border-border p-2">
                  {resultado.cuentas.length === 0 && (
                    <p className="px-1 py-2 text-xs text-muted-foreground">Sin cuentas que coincidan con la lista.</p>
                  )}
                  {resultado.cuentas.map((cuenta) => (
                    <div key={cuenta.userId} className="flex items-center justify-between gap-2 rounded px-1 py-1 text-xs">
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium">{cuenta.email}</span>
                        {cuenta.empresa && <span className="text-muted-foreground"> · {cuenta.empresa}</span>}
                        {cuenta.tipoDocumento && (
                          <span className="ml-1.5 rounded-full bg-secondary px-1.5 py-0.5 text-[9px] text-muted-foreground">
                            {etiquetaTipoDocumentoEmpresa(cuenta.tipoDocumento)}
                          </span>
                        )}
                      </span>
                      {cuenta.motivo && <span className="shrink-0 text-[10px] text-muted-foreground">{cuenta.motivo}</span>}
                      <Badge className={`pointer-events-none shrink-0 text-[10px] ${ESTADO_ACTIVACION_UI[cuenta.estado].className}`}>
                        <span>{ESTADO_ACTIVACION_UI[cuenta.estado].texto}</span>
                      </Badge>
                    </div>
                  ))}
                  {resultado.noEncontrados.map((fila) => (
                    <div key={fila.identificador} className="flex items-center justify-between gap-2 rounded px-1 py-1 text-xs">
                      <span className="min-w-0 flex-1 truncate font-medium">{fila.identificador}</span>
                      <Badge className={`pointer-events-none shrink-0 text-[10px] ${BADGE_STYLES.DESTRUCTIVE}`}>
                        <span>{fila.motivo === "invalido" ? "Invalido" : "No encontrado"}</span>
                      </Badge>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {resultado.resumen.programadas} programada(s) · {resultado.resumen.porProgramar} por programar ·{" "}
                  {resultado.resumen.yaActivas} ya estaban activas · {resultado.resumen.omitidas} omitida(s) ·{" "}
                  {resultado.resumen.noEncontrados} sin coincidencia.
                </p>
                {ejecutado && (
                  <p className="text-[11px] font-medium text-primary">
                    Activacion programada: {dateUtils.formatDateTime(resultado.activarEn)}
                  </p>
                )}
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0">
            <Button variant="ghost" size="sm" onClick={onClose}><span>{resultado ? "Cerrar" : "Cancelar"}</span></Button>
            {!resultado ? (
              <Button size="sm" onClick={() => { void previsualizar(); }} disabled={previsualizando}>
                <span>{previsualizando ? "Revisando..." : `Previsualizar (${identificadores.length})`}</span>
              </Button>
            ) : !ejecutado && resultado.resumen.porProgramar > 0 ? (
              <Button size="sm" onClick={() => { void ejecutar(); }} disabled={programando}>
                <span>{programando ? "Programando..." : `Programar ${resultado.resumen.porProgramar} cuenta(s)`}</span>
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </>
  );
}

/** Alta individual: persona en servicio-persona + acceso local con sie_code/correo/empresa/rol. */
function NuevoUsuarioModal({ roles, rolInicial, onClose, onCreado }: {
  roles: RolOpcion[];
  rolInicial: string;
  onClose: () => void;
  onCreado: () => void;
}) {
  const [tipoDocumento, setTipoDocumento] = useState<string>(TIPOS_DOCUMENTO_PERSONA.DNI);
  const [documento, setDocumento] = useState("");
  const [apellidoPaterno, setApellidoPaterno] = useState("");
  const [apellidoMaterno, setApellidoMaterno] = useState("");
  const [nombres, setNombres] = useState("");
  const [email, setEmail] = useState("");
  const [celular, setCelular] = useState("");
  const [direccion, setDireccion] = useState("");
  const [empresa, setEmpresa] = useState<EmpresaAccesoDTO | null>(null);
  const [rolId, setRolId] = useState(rolInicial);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    setError(null);
    if (!REGEX_EMAIL.test(email.trim())) { setError("Ingresa un correo valido"); return; }
    const errorDocumento = validarDocumentoPersona(tipoDocumento, documento);
    if (errorDocumento) { setError(errorDocumento); return; }
    if (!apellidoPaterno.trim() || !nombres.trim()) { setError("Apellido paterno y nombres son requeridos"); return; }
    if (!empresa) { setError("Selecciona la empresa"); return; }
    setEnviando(true);
    try {
      const resultado = await usuariosService.crear({
        ...empresa,
        rolId: rolId || null,
        email: email.trim(),
        tipoDocumento,
        documento: documento.trim(),
        apellidoPaterno: apellidoPaterno.trim(),
        apellidoMaterno: apellidoMaterno.trim() || null,
        nombres: nombres.trim(),
        celular: celular.trim() || null,
        direccion: direccion.trim() || null,
      });
      if (!resultado.creado) {
        setError(resultado.error ?? "No se pudo crear el usuario");
        return;
      }
      if (resultado.emailEnviado === false) {
        toast.warning(`Usuario creado, pero no se pudo enviar el correo a ${resultado.email}`);
      } else {
        toast.success(`Credenciales enviadas a ${resultado.email}`);
      }
      onCreado();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear el usuario");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle><span>Nuevo usuario</span></DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs"><span>Tipo de documento *</span></Label>
              <Select value={tipoDocumento} onValueChange={setTipoDocumento}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPOS_DOCUMENTO_PERSONA_LABELS).map(([valor, etiqueta]) => (
                    <SelectItem key={valor} value={valor}><span>{etiqueta}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="usuario-documento" className="text-xs"><span>Documento *</span></Label>
              <Input id="usuario-documento" value={documento} onChange={(e) => { setDocumento(e.target.value); }} className="h-8 text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="usuario-apellido-paterno" className="text-xs"><span>Apellido paterno *</span></Label>
              <Input id="usuario-apellido-paterno" value={apellidoPaterno} onChange={(e) => { setApellidoPaterno(e.target.value); }} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="usuario-apellido-materno" className="text-xs"><span>Apellido materno</span></Label>
              <Input id="usuario-apellido-materno" value={apellidoMaterno} onChange={(e) => { setApellidoMaterno(e.target.value); }} className="h-8 text-xs" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="usuario-nombres" className="text-xs"><span>Nombres *</span></Label>
            <Input id="usuario-nombres" value={nombres} onChange={(e) => { setNombres(e.target.value); }} className="h-8 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="usuario-email" className="text-xs"><span>Correo *</span></Label>
              <Input id="usuario-email" value={email} onChange={(e) => { setEmail(e.target.value); }} className="h-8 text-xs" placeholder="usuario@empresa.com" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="usuario-celular" className="text-xs"><span>Celular</span></Label>
              <Input id="usuario-celular" value={celular} onChange={(e) => { setCelular(e.target.value); }} className="h-8 text-xs" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="usuario-direccion" className="text-xs"><span>Direccion</span></Label>
            <Input id="usuario-direccion" value={direccion} onChange={(e) => { setDireccion(e.target.value); }} className="h-8 text-xs" placeholder="Av. Arequipa 1250, Lince" />
          </div>
          <EmpresaPicker seleccion={empresa} onSeleccion={setEmpresa} fuentes={FUENTES_EMPRESA} />
          <div className="space-y-1">
            <Label className="text-xs"><span>Rol *</span></Label>
            <Select value={rolId} onValueChange={setRolId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Seleccionar rol" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}><span>{r.nombre}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[11px] text-muted-foreground">
            La persona se busca/crea en servicio-persona; si ya existe por documento se reutiliza su identificador.
            Se crea con el rol elegido y contrasena temporal que se envia al correo.
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}><span>Cancelar</span></Button>
          <Button size="sm" onClick={() => { void enviar(); }} disabled={enviando}>
            <span>{enviando ? "Creando..." : "Crear usuario"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Alta por lote: varios usuarios (personas) para una misma empresa y rol. */
function CrearUsuariosLoteModal({ roles, rolInicial, onClose, onCreado }: {
  roles: RolOpcion[];
  rolInicial: string;
  onClose: () => void;
  onCreado: () => void;
}) {
  const [empresa, setEmpresa] = useState<EmpresaAccesoDTO | null>(null);
  const [rolId, setRolId] = useState(rolInicial);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoCreacionUsuarioDTO[] | null>(null);

  const filas = useMemo(() => parsearLineas(texto), [texto]);
  const validas = filas.filter(filaValida);

  const enviar = async () => {
    setError(null);
    if (!empresa) { setError("Selecciona la empresa"); return; }
    if (validas.length === 0) { setError("Agrega al menos una linea valida (documento, apellidos, nombres y correo)"); return; }
    setEnviando(true);
    try {
      const respuesta = await usuariosService.crearLote({ ...empresa, rolId: rolId || null, usuarios: validas });
      setResultados(respuesta.resultados);
      const creados = respuesta.resultados.filter((r) => r.creado).length;
      if (creados > 0) toast.success(`${creados} usuario(s) creado(s)`);
      onCreado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear los usuarios");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle><span>Crear varios usuarios</span></DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <EmpresaPicker seleccion={empresa} onSeleccion={setEmpresa} fuentes={FUENTES_EMPRESA} />
          <div className="space-y-1">
            <Label className="text-xs"><span>Rol *</span></Label>
            <Select value={rolId} onValueChange={setRolId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Seleccionar rol" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}><span>{r.nombre}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!resultados ? (
            <>
              <div className="space-y-1">
                <Label htmlFor="usuarios-lote" className="text-xs">
                  <span>Usuarios (una linea por persona)</span>
                </Label>
                <Textarea
                  id="usuarios-lote"
                  value={texto}
                  onChange={(e) => { setTexto(e.target.value); }}
                  rows={8}
                  placeholder={"DNI, 12345678, PEREZ, GOMEZ, JUAN CARLOS, jperez@empresa.com, 999888777\nCE, X1234567, LOPEZ, , MARIA, mlopez@empresa.com"}
                  className="text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Orden: tipoDocumento, documento, apellidoPaterno, apellidoMaterno, nombres, correo, celular.
                  Tipo acepta DNI/CE/PAS (o 1/4/7). {filas.length} linea(s) · {validas.length} valida(s).
                </p>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </>
          ) : (
            <div className="max-h-[280px] space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {resultados.map((r) => {
                const { texto: detalle, ok } = resultadoTexto(r);
                return (
                  <div key={r.email} className="flex items-center justify-between gap-2 rounded px-1 py-1 text-xs">
                    <span className="truncate font-medium">{r.email}</span>
                    <Badge className={`pointer-events-none shrink-0 text-[10px] ${ok ? BADGE_STYLES.SUCCESS : BADGE_STYLES.DESTRUCTIVE}`}>
                      <span>{detalle}</span>
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}><span>{resultados ? "Cerrar" : "Cancelar"}</span></Button>
          {!resultados && (
            <Button size="sm" onClick={() => { void enviar(); }} disabled={enviando}>
              <span>{enviando ? `Creando ${validas.length}...` : `Crear ${validas.length} usuario(s)`}</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Edita el acceso local: correo del login y empresa (API de entidades). */
function EditarUsuarioModal({ usuario, onClose, onGuardado }: {
  usuario: UsuarioPortalDTO;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [email, setEmail] = useState(usuario.email);
  const [empresa, setEmpresa] = useState<EmpresaAccesoDTO | null>(
    usuario.idEmpresa
      ? { idEmpresa: usuario.idEmpresa, nombreEmpresa: usuario.empresa ?? usuario.idEmpresa, ruc: usuario.ruc ?? null }
      : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setError(null);
    const emailLimpio = email.trim().toLowerCase();
    if (!REGEX_EMAIL.test(emailLimpio)) { setError("Ingresa un correo valido"); return; }
    setGuardando(true);
    try {
      await usuariosService.actualizar({
        id: usuario.id,
        email: emailLimpio,
        ...(empresa ? { idEmpresa: empresa.idEmpresa, nombreEmpresa: empresa.nombreEmpresa, ruc: empresa.ruc ?? null } : {}),
      });
      toast.success(`Usuario ${emailLimpio} actualizado`);
      onGuardado();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar el usuario");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle><span>Editar usuario</span></DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="editar-usuario-email" className="text-xs"><span>Correo (login)</span></Label>
            <Input
              id="editar-usuario-email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); }}
              className="h-8 text-xs"
              placeholder="usuario@empresa.com"
            />
            <p className="text-[11px] text-muted-foreground">
              <span>Es el usuario de acceso; al cambiarlo, su sesion activa se cierra.</span>
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs"><span>ID Persona (servicio-persona)</span></Label>
            <Input value={usuario.sieCode ?? "—"} readOnly disabled className="h-8 font-mono text-xs" />
          </div>
          <EmpresaPicker seleccion={empresa} onSeleccion={setEmpresa} fuentes={FUENTES_EMPRESA} />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}><span>Cancelar</span></Button>
          <Button size="sm" onClick={() => { void guardar(); }} disabled={guardando}>
            <span>{guardando ? "Guardando..." : "Guardar"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Busca personas en servicio-persona y crea la cuenta local (sie_code + correo + empresa SIE + rol). */
function BuscarPersonaModal({ roles, rolInicial, onClose, onCreado }: {
  roles: RolOpcion[];
  rolInicial: string;
  onClose: () => void;
  onCreado: () => void;
}) {
  const [q, setQ] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<PersonaApiDTO[] | null>(null);
  const [seleccionada, setSeleccionada] = useState<PersonaApiDTO | null>(null);
  const [email, setEmail] = useState("");
  const [empresa, setEmpresa] = useState<EmpresaAccesoDTO | null>(null);
  const [rolId, setRolId] = useState(rolInicial);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  const buscar = async () => {
    const termino = q.trim();
    if (termino.length < 3) { setError("Escribe al menos 3 caracteres (apellido paterno o DNI)"); return; }
    setError(null);
    setBuscando(true);
    try {
      const lista = await usuariosService.buscarPersonas(termino);
      setResultados(lista);
      if (lista.length === 0) toast.info("No se encontraron personas en el servicio");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al buscar personas");
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  };

  const nombreDe = (p: PersonaApiDTO) =>
    p.nombre_completo ?? [p.apellido_paterno, p.apellido_materno, p.nombres].filter(Boolean).join(" ");

  const crearCuenta = async () => {
    if (!seleccionada) return;
    setError(null);
    if (!REGEX_EMAIL.test(email.trim())) { setError("Ingresa un correo valido"); return; }
    if (!empresa) { setError("Selecciona la empresa"); return; }
    setCreando(true);
    try {
      const resultado = await usuariosService.crearCuenta({
        ...empresa,
        sieCode: seleccionada.sie_code ?? "",
        email: email.trim(),
        rolId: rolId || null,
      });
      if (!resultado.creado) {
        setError(resultado.error ?? "No se pudo crear la cuenta");
        return;
      }
      if (resultado.emailEnviado === false) {
        toast.warning(`Cuenta creada, pero no se pudo enviar el correo a ${resultado.email}`);
      } else {
        toast.success(`Credenciales enviadas a ${resultado.email}`);
      }
      onCreado();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la cuenta");
    } finally {
      setCreando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle><span>Buscar persona (servicio-persona)</span></DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!seleccionada ? (
            <>
              <div className="flex gap-2">
                <Input
                  value={q}
                  onChange={(e) => { setQ(e.target.value); }}
                  onKeyDown={(e) => { if (e.key === "Enter") void buscar(); }}
                  placeholder="Apellido paterno o DNI (ej. PEREZ)"
                  className="h-8 text-xs"
                />
                <Button size="sm" className="h-8 shrink-0" onClick={() => { void buscar(); }} disabled={buscando}>
                  <span>{buscando ? "Buscando..." : "Buscar"}</span>
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                La busqueda es por inicio del apellido paterno (formato APELLIDOS, NOMBRES) o por DNI.
              </p>
              {resultados && resultados.length > 0 && (
                <div className="max-h-[300px] space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                  {resultados.map((p) => (
                    <div key={p.sie_code ?? p.documento ?? nombreDe(p)} className="flex items-center justify-between gap-2 rounded px-1 py-1">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{nombreDe(p)}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {p.documento ?? "—"} · {p.sie_code ?? "—"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 shrink-0 text-xs"
                        onClick={() => { setSeleccionada(p); setEmail(p.correo ?? ""); setError(null); }}
                      >
                        <span>Crear cuenta</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {resultados && resultados.length === 0 && !buscando && (
                <p className="rounded-lg border border-dashed border-border bg-secondary px-3 py-3 text-center text-[11px] text-muted-foreground">
                  Sin resultados en servicio-persona.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="rounded-lg border border-border bg-secondary p-3 text-xs">
                <p className="font-medium">{nombreDe(seleccionada)}</p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {seleccionada.documento ?? "—"} · {seleccionada.sie_code ?? "—"}
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="persona-email" className="text-xs"><span>Correo del acceso *</span></Label>
                <Input id="persona-email" value={email} onChange={(e) => { setEmail(e.target.value); }} className="h-8 text-xs" placeholder="usuario@empresa.com" />
              </div>
              <EmpresaPicker seleccion={empresa} onSeleccion={setEmpresa} fuentes={FUENTES_EMPRESA} />
              <div className="space-y-1">
                <Label className="text-xs"><span>Rol *</span></Label>
                <Select value={rolId} onValueChange={setRolId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}><span>{r.nombre}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          {seleccionada ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => { setSeleccionada(null); setError(null); }}>
                <span>Volver</span>
              </Button>
              <Button size="sm" onClick={() => { void crearCuenta(); }} disabled={creando}>
                <span>{creando ? "Creando..." : "Crear cuenta"}</span>
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={onClose}><span>Cerrar</span></Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
