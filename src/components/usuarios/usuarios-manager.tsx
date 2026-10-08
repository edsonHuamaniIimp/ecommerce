"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Skeleton,
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
import { Pencil, Search, Send, UserPlus, UserSearch, Users } from "lucide-react";
import { toast } from "sonner";
import { usuariosService } from "@/lib/client/api/services/usuarios-service";
import { rolesService } from "@/lib/client/api/services/roles-service";
import { EmpresaPicker, type FuenteEmpresa } from "@/components/shared/empresa-picker";
import { BADGE_STYLES, REGEX_EMAIL, ROLES, TIPOS_DOCUMENTO_PERSONA, TIPOS_DOCUMENTO_PERSONA_LABELS, UI_SENTINEL } from "@/lib/shared/constants";
import { normalizarTipoDocumentoPersona, validarDocumentoPersona } from "@/lib/shared/utils/documento-persona";
import type {
  EmpresaAccesoDTO,
  NuevoUsuarioPortalDTO,
  PersonaApiDTO,
  ResultadoCreacionUsuarioDTO,
  UsuarioPortalDTO,
} from "@/types/dto/usuarios/usuario.dto";

interface RolOpcion {
  id: string;
  nombre: string;
}

/** Filtro de la bandeja por empresa (UI_SENTINEL.TODOS = sin filtrar). */
const FILTRO_EMPRESA = { PORTAL: "portal", SIN_EMPRESA: "sin-empresa" } as const;
type FiltroEmpresa = typeof UI_SENTINEL.TODOS | typeof FILTRO_EMPRESA.PORTAL | typeof FILTRO_EMPRESA.SIN_EMPRESA;

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

export function UsuariosManager() {
  const [usuarios, setUsuarios] = useState<UsuarioPortalDTO[] | null>(null);
  const [roles, setRoles] = useState<RolOpcion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEmpresa, setFiltroEmpresa] = useState<FiltroEmpresa>(UI_SENTINEL.TODOS);
  const [modalIndividual, setModalIndividual] = useState(false);
  const [modalLote, setModalLote] = useState(false);
  const [modalBuscar, setModalBuscar] = useState(false);
  const [usuarioEditar, setUsuarioEditar] = useState<UsuarioPortalDTO | null>(null);
  const [enviandoAccesosId, setEnviandoAccesosId] = useState<string | null>(null);

  const rolPorDefecto = useMemo(
    () => roles.find((r) => r.nombre === ROLES.CLIENTE)?.id ?? roles[0]?.id ?? "",
    [roles],
  );

  const cargar = useCallback(async () => {
    try {
      const [listaUsuarios, listaRoles] = await Promise.all([
        usuariosService.listar(),
        rolesService.list(),
      ]);
      setUsuarios(listaUsuarios);
      setRoles(listaRoles.map((r) => ({ id: r.id, nombre: r.nombre })));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setUsuarios([]);
    }
  }, []);

  useEffect(() => {
    let activo = true;
    void (async () => {
      try {
        const [listaUsuarios, listaRoles] = await Promise.all([
          usuariosService.listar(),
          rolesService.list(),
        ]);
        if (!activo) return;
        setUsuarios(listaUsuarios);
        setRoles(listaRoles.map((r) => ({ id: r.id, nombre: r.nombre })));
        setError(null);
      } catch (err) {
        if (!activo) return;
        setError(err instanceof Error ? err.message : "Error desconocido");
        setUsuarios([]);
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

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return (usuarios ?? []).filter((u) => {
      const coincideEmpresa =
        filtroEmpresa === UI_SENTINEL.TODOS
        || (filtroEmpresa === FILTRO_EMPRESA.PORTAL && u.esPortal)
        || (filtroEmpresa === FILTRO_EMPRESA.SIN_EMPRESA && !u.esPortal);
      if (!coincideEmpresa) return false;
      if (!termino) return true;
      return [u.email, u.empresa, u.rol, u.sieCode, u.idEmpresa]
        .some((valor) => (valor ?? "").toLowerCase().includes(termino));
    });
  }, [usuarios, busqueda, filtroEmpresa]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {usuarios === null ? "Cargando..." : `${filtrados.length} de ${usuarios.length} usuarios`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filtroEmpresa} onValueChange={(v) => { setFiltroEmpresa(v as FiltroEmpresa); }}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UI_SENTINEL.TODOS}><span>Todos</span></SelectItem>
              <SelectItem value={FILTRO_EMPRESA.PORTAL}><span>Con empresa (Portal)</span></SelectItem>
              <SelectItem value={FILTRO_EMPRESA.SIN_EMPRESA}><span>Sin empresa</span></SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por correo, ID, empresa..."
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); }}
              className="h-8 w-[240px] pl-8 text-xs"
            />
          </div>
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
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        La persona vive en <strong>servicio-persona</strong> (fuente) y la empresa se elige de la API de entidades
        (codigo SIE). Aqui se guarda el identificador de la persona, el correo, la empresa y el rol. Incluye usuarios
        internos (sin empresa): usalos con el filtro y asignales empresa con el lapiz.
      </p>

      {error ? (
        <p className="text-sm text-destructive">Error al cargar usuarios: {error}</p>
      ) : usuarios === null ? (
        <Skeleton className="h-64 w-full rounded-xl" />
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
                <TableHead className="text-right text-[10px] uppercase">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((u) => (
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
                        <TooltipContent side="top"><span>Asignar empresa</span></TooltipContent>
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
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                    <span>No hay usuarios que coincidan.</span>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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
      {usuarioEditar && (
        <EditarUsuarioModal
          usuario={usuarioEditar}
          onClose={() => { setUsuarioEditar(null); }}
          onGuardado={() => { void cargar(); }}
        />
      )}
    </div>
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

/** Asignar/cambiar la empresa (API de entidades) del acceso local. */
function EditarUsuarioModal({ usuario, onClose, onGuardado }: {
  usuario: UsuarioPortalDTO;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [empresa, setEmpresa] = useState<EmpresaAccesoDTO | null>(
    usuario.idEmpresa
      ? { idEmpresa: usuario.idEmpresa, nombreEmpresa: usuario.empresa ?? usuario.idEmpresa, ruc: usuario.ruc ?? null }
      : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setError(null);
    if (!empresa) { setError("Selecciona la empresa"); return; }
    setGuardando(true);
    try {
      await usuariosService.actualizar({ id: usuario.id, ...empresa });
      toast.success(`Empresa de ${usuario.email} actualizada`);
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
          <DialogTitle><span>Asignar empresa</span></DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs"><span>Correo</span></Label>
            <Input value={usuario.email} readOnly disabled className="h-8 text-xs" />
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
