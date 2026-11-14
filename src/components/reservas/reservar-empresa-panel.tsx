"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
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
} from "@nrivera-iimp/ui-kit-iimp";
import { CheckCircle2, ChevronRight, Loader2, Pencil, RotateCcw, Search, UserRound, X, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CuotasEditor, crearCuotaFilaInicial, validarFilasCuotas, type CuotaFila } from "@/components/shared/cuotas-editor";
import { EmpresaPicker } from "@/components/shared/empresa-picker";
import { Plano2D as Plano2DVista, PLANO_2D_ZOOM_MAX, PLANO_2D_ZOOM_MIN, PLANO_2D_ZOOM_PASO } from "@/components/plano/plano-2d";
import { EmpresaFormModal } from "@/components/empresas/empresa-form-modal";
import { RepresentanteLegalModal } from "@/components/empresas/representante-legal-modal";
import { Pagination } from "@/components/shared/pagination";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { useSesion } from "@/hooks/use-sesion";
import { eventosServiceClient } from "@/lib/client/api/services/eventos-service";
import { reservasAdminService } from "@/lib/client/api/services/reservas-admin-service";
import { gessService } from "@/lib/client/api/services/gess-service";
import { empresasService } from "@/lib/client/api/services/empresas-service";
import { planosService } from "@/lib/client/api/services/planos-service";
import { ESTADOS_STAND, BADGE_STYLES, MAX_RESERVA_ADMIN_STANDS, MONEDAS, TIPOS_COMPROBANTE, TIPO_COMPROBANTE_LABELS, UI_SENTINEL, type TipoComprobante } from "@/lib/shared/constants";
import { calcularImportes } from "@/lib/shared/utils/importes";
import { dateUtils } from "@/lib/shared/utils/date";
import { convertirNeto, formatearMonto, tipoCambioValido } from "@/lib/shared/utils/moneda";
import { esStandComercialReservable, resolverPrecioStand } from "@/lib/shared/utils/precio-stand";
import { normalizarPabellon } from "@/lib/shared/utils/pabellon";
import { validarEmpresaReservaAdministrativa } from "@/lib/shared/utils/reserva-admin-readiness";
import { estadoStandBadge } from "@/lib/shared/utils/estado-stand";
import { normalizarTipoStand } from "@/lib/shared/utils/tipo-stand";
import type { EmpresaAccesoDTO } from "@/types/dto/usuarios/usuario.dto";
import type { EmpresaDTO } from "@/types/dto/empresas";
import type { PlanoPublicoPayloadDTO } from "@/types/dto/planos/planos-response.dto";
import type { GessStandDTO } from "@/types/dto/gess";
import type { ReservaAdminResponseDTO } from "@/types/dto/reserva";

const ESTADOS_FILTRO = [
  ESTADOS_STAND.DISPONIBLE,
  ESTADOS_STAND.PRE_RESERVADO,
  ESTADOS_STAND.RESERVADO,
  ESTADOS_STAND.EN_EVALUACION,
  ESTADOS_STAND.EN_PROCESO,
] as const;

const AYUDA_CRONOGRAMA_RESERVA =
  "Las fechas definen el cronograma del contrato que el cliente firmará. Después de la firma, la solicitud pasa a revisión del Asociado; recién con su aprobación se genera la orden de pago. La primera cuota puede ser hoy; las siguientes deben ser posteriores y en orden ascendente.";

/** En esta bandeja la pre-reserva se muestra con su nombre comercial. */
function badgeEstadoReservaAdmin(estado: string | null | undefined) {
  if (estado === ESTADOS_STAND.PRE_RESERVADO) {
    return { texto: "Pre-reservado", clase: BADGE_STYLES.INFO };
  }
  return estadoStandBadge(estado);
}

function empresaAccesoDesdeDTO(empresa: EmpresaDTO): EmpresaAccesoDTO {
  return {
    empresaId: empresa.id,
    idEmpresa: empresa.sieCode ?? "",
    nombreEmpresa: empresa.razonSocial,
    ruc: empresa.ruc,
    tipoComprobante: empresa.tipoComprobante,
    representanteUserId: empresa.representanteUserId ?? null,
    representanteLegalNombre: empresa.representanteLegalNombre,
    representanteLegalDni: empresa.representanteLegalDni,
    representanteCorreo: empresa.representanteCorreo,
    direccionFiscal: empresa.direccionFiscal,
    emailContacto: empresa.emailContacto,
    emailFacturacion: empresa.emailFacturacion,
  };
}

export function ReservarEmpresaPanel() {
  const { session, cargando } = useSesion();
  const eventoId = session?.eventoId ?? "";
  const [empresa, setEmpresa] = useState<EmpresaAccesoDTO | null>(null);
  const [stands, setStands] = useState<GessStandDTO[]>([]);
  const [cargandoStands, setCargandoStands] = useState(true);
  const [search, setSearch] = useState("");
  const [pabellon, setPabellon] = useState<string>(UI_SENTINEL.TODOS);
  const [tipo, setTipo] = useState<string>(UI_SENTINEL.TODOS);
  const [estadoFiltro, setEstadoFiltro] = useState<string>(ESTADOS_STAND.PRE_RESERVADO);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [moneda, setMoneda] = useState<string>(UI_SENTINEL.SELECCIONAR);
  const [tipoComprobante, setTipoComprobante] = useState<string>(UI_SENTINEL.SELECCIONAR);
  const [tipoCambio, setTipoCambio] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const esStandSeleccionableAdmin = (stand: GessStandDTO): boolean =>
    stand.estado === ESTADOS_STAND.DISPONIBLE || stand.estado === ESTADOS_STAND.PRE_RESERVADO;
  const [filasCuotas, setFilasCuotas] = useState<CuotaFila[]>(crearCuotaFilaInicial);
  const [guardando, setGuardando] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [confirmarOpen, setConfirmarOpen] = useState(false);
  const [creandoContratoOpen, setCreandoContratoOpen] = useState(false);
  const [resultado, setResultado] = useState<ReservaAdminResponseDTO | null>(null);
  const [empresaDetalle, setEmpresaDetalle] = useState<EmpresaDTO | null>(null);
  const [cargandoEmpresa, setCargandoEmpresa] = useState(false);
  const [editarEmpresaOpen, setEditarEmpresaOpen] = useState(false);
  const [editarRepresentanteOpen, setEditarRepresentanteOpen] = useState(false);
  const [planosEvento, setPlanosEvento] = useState<Array<{ codigo: string; nombre: string }>>([]);
  const [plano2DOpen, setPlano2DOpen] = useState(false);
  const [plano2D, setPlano2D] = useState<PlanoPublicoPayloadDTO | null>(null);
  const [cargandoPlano2D, setCargandoPlano2D] = useState(false);
  const [plano2DZoom, setPlano2DZoom] = useState(1);

  useEffect(() => {
    if (!eventoId) return;
    let activo = true;
    gessService
      .all(eventoId)
      .then((rows) => {
        if (!activo) return;
        setStands(rows.filter(esStandComercialReservable));
      })
      .catch((error) => {
        if (activo) toast.error(error instanceof Error ? error.message : "No se pudieron cargar los stands");
      })
      .finally(() => {
        if (activo) setCargandoStands(false);
      });
    return () => {
      activo = false;
    };
  }, [eventoId]);

  useEffect(() => {
    if (!eventoId) return;
    let activo = true;
    eventosServiceClient
      .configuracionPublica(eventoId)
      .then((data) => {
        if (!activo) return;
        const valor = typeof data.tipoCambio === "number" ? data.tipoCambio : Number(data.tipoCambio);
        setTipoCambio(Number.isFinite(valor) && valor > 0 ? valor : null);
      })
      .catch(() => {
        if (activo) setTipoCambio(null);
      });
    return () => {
      activo = false;
    };
  }, [eventoId]);

  useEffect(() => {
    if (session?.tipoEvento === undefined || session?.codigoEvento === undefined) return;
    let activo = true;
    planosService
      .planosDeEvento(session.tipoEvento, session.codigoEvento)
      .then((planos) => {
        if (!activo) return;
        setPlanosEvento(
          planos
            .filter((plano) => Boolean(plano.codigo) && (plano.bloques?.length ?? 0) > 0)
            .map((plano) => ({ codigo: plano.codigo, nombre: plano.nombre?.trim() || plano.codigo })),
        );
      })
      .catch(() => {
        if (activo) setPlanosEvento([]);
      });
    return () => {
      activo = false;
    };
  }, [session?.tipoEvento, session?.codigoEvento]);

  const abrirPabellon2D = async (codigo: string) => {
    if (!eventoId) return;
    setPlano2D(null);
    setPlano2DZoom(1);
    setPlano2DOpen(true);
    setCargandoPlano2D(true);
    try {
      const payload = await planosService.publico({ codigo, eventoId });
      setPlano2D(payload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar el pabellón");
      setPlano2DOpen(false);
    } finally {
      setCargandoPlano2D(false);
    }
  };

  const cambiarZoomPlano2D = (delta: number) => {
    setPlano2DZoom((actual) => Math.min(PLANO_2D_ZOOM_MAX, Math.max(PLANO_2D_ZOOM_MIN, Number((actual + delta).toFixed(2)))));
  };

  const pabellones = useMemo(
    () => Array.from(
      new Set(
        stands
          .map((stand) => normalizarPabellon(stand.pabellon))
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort(),
    [stands],
  );
  const tipos = useMemo(
    () => Array.from(
      new Set(
        stands
          .map((stand) => normalizarTipoStand(stand.tipoStand))
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort(),
    [stands],
  );
  const filtrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    return stands.filter((stand) => {
      const pabellonStand = normalizarPabellon(stand.pabellon);
      if (estadoFiltro !== UI_SENTINEL.TODOS && stand.estado !== estadoFiltro) return false;
      if (pabellon !== UI_SENTINEL.TODOS && pabellonStand !== pabellon) return false;
      if (tipo !== UI_SENTINEL.TODOS && normalizarTipoStand(stand.tipoStand) !== tipo) return false;
      if (!term) return true;
      return [stand.standCode, normalizarTipoStand(stand.tipoStand), pabellonStand]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [estadoFiltro, pabellon, search, stands, tipo]);
  const disponibles = stands.filter((stand) => stand.estado === ESTADOS_STAND.DISPONIBLE).length;
  const preReservados = stands.filter((stand) => stand.estado === ESTADOS_STAND.PRE_RESERVADO).length;
  const totalPages = Math.max(1, Math.ceil(filtrados.length / perPage));
  const pageActual = Math.min(page, totalPages);
  const visibles = filtrados.slice((pageActual - 1) * perPage, pageActual * perPage);
  const visiblesSeleccionables = visibles.filter(esStandSeleccionableAdmin);
  const todosPaginaSeleccionados =
    visiblesSeleccionables.length > 0 && visiblesSeleccionables.every((stand) => selected.has(stand.id));
  const hayFiltros =
    search.trim().length > 0 ||
    pabellon !== UI_SENTINEL.TODOS ||
    tipo !== UI_SENTINEL.TODOS ||
    estadoFiltro !== ESTADOS_STAND.PRE_RESERVADO;

  const seleccionados = useMemo(
    () => stands.filter((stand) => selected.has(stand.id)),
    [stands, selected],
  );
  const codigoComercialPorBloque = useMemo(() => {
    const mapa: Record<string, string> = {};
    for (const stand of stands) {
      if (stand.bloqueId && stand.standCode) mapa[stand.bloqueId] = stand.standCode;
    }
    return mapa;
  }, [stands]);
  const puedePagarEnSoles = tipoCambioValido(tipoCambio);
  const monedaPago = moneda === MONEDAS.PEN && puedePagarEnSoles ? MONEDAS.PEN : MONEDAS.USD;
  const monedaSeleccionada = moneda === MONEDAS.USD || moneda === MONEDAS.PEN;
  const comprobanteSeleccionado =
    tipoComprobante === TIPOS_COMPROBANTE.FACTURA || tipoComprobante === TIPOS_COMPROBANTE.BOLETA;
  const representanteVinculado = Boolean(empresa?.representanteUserId);
  const readiness = empresa
    ? validarEmpresaReservaAdministrativa(
        { ...empresa, razonSocial: empresa.nombreEmpresa },
        tipoComprobante,
        moneda,
      )
    : {
        ok: false,
        faltantes: [] as string[],
        faltantesEmpresa: [] as string[],
        faltantesRepresentante: [] as string[],
        faltantesGenerales: [] as string[],
        faltantesPago: [] as string[],
      };
  const netoUsd = useMemo(
    () => seleccionados.reduce((total, stand) => total + resolverPrecioStand(stand), 0),
    [seleccionados],
  );
  const neto = convertirNeto(netoUsd, monedaPago, tipoCambio);
  const importes = calcularImportes(neto);
  const total = importes.total;
  const igv = importes.igv;
  const cuotas = filasCuotas.map((fila) => ({
    porcentaje: Number(fila.porcentaje),
    fechaVencimiento: fila.fecha,
  }));
  const cuotasValidas = validarFilasCuotas(filasCuotas);

  const toggle = (stand: GessStandDTO) => {
    if (!esStandSeleccionableAdmin(stand)) {
      toast.error("Solo se pueden seleccionar stands disponibles o pre-reservados");
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(stand.id)) {
        next.delete(stand.id);
      } else {
        if (next.size >= MAX_RESERVA_ADMIN_STANDS) {
          toast.error(`Maximo ${MAX_RESERVA_ADMIN_STANDS} stands por reserva`);
          return prev;
        }
        next.add(stand.id);
      }
      return next;
    });
  };

  const seleccionarPagina = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const seleccionables = visiblesSeleccionables.filter((stand) => !next.has(stand.id));
      if (checked) {
        for (const stand of seleccionables) {
          if (next.size >= MAX_RESERVA_ADMIN_STANDS) break;
          next.add(stand.id);
        }
      } else {
        for (const stand of visiblesSeleccionables) next.delete(stand.id);
      }
      return next;
    });
  };

  const cambiarFiltro = (cambios: Partial<{ search: string; pabellon: string; tipo: string; estado: string }>) => {
    if (cambios.search !== undefined) setSearch(cambios.search);
    if (cambios.pabellon !== undefined) setPabellon(cambios.pabellon);
    if (cambios.tipo !== undefined) setTipo(cambios.tipo);
    if (cambios.estado !== undefined) setEstadoFiltro(cambios.estado);
    setPage(1);
  };

  const limpiarFiltros = () => {
    setSearch("");
    setPabellon(UI_SENTINEL.TODOS);
    setTipo(UI_SENTINEL.TODOS);
    setEstadoFiltro(ESTADOS_STAND.PRE_RESERVADO);
    setPage(1);
  };

  const cambiarPerPage = (valor: number) => {
    setPerPage(valor);
    setPage(1);
  };

  const cambiarMoneda = (valor: string) => {
    if (valor === MONEDAS.PEN && !puedePagarEnSoles) return;
    const nuevaMoneda = valor === MONEDAS.PEN ? MONEDAS.PEN : MONEDAS.USD;
    const nuevoNeto = convertirNeto(netoUsd, nuevaMoneda, tipoCambio);
    setMoneda(nuevaMoneda);
    setFilasCuotas(crearCuotaFilaInicial(calcularImportes(nuevoNeto).total));
  };

  const cargarEmpresaDetalle = async (): Promise<EmpresaDTO | null> => {
    if (!empresa) {
      toast.error("Selecciona una empresa");
      return null;
    }
    setCargandoEmpresa(true);
    try {
      let empresaId = empresa.empresaId ?? null;
      let filaLocal: EmpresaDTO | null = null;

      /* Compatibilidad con selecciones previas: el ID local puede no venir en el
       * DTO del buscador; se resuelve por RUC antes de abrir el formulario. */
      if (!empresaId && empresa.ruc) {
        const pagina = await empresasService.listar({ search: empresa.ruc, perPage: 10 });
        filaLocal = (pagina.data ?? []).find((item) => item.ruc === empresa.ruc) ?? null;
        empresaId = filaLocal?.id ?? null;
      }
      if (!empresaId) {
        toast.error("No se pudo identificar la empresa local");
        return null;
      }

      try {
        const detalle = await empresasService.detalle(empresaId);
        setEmpresaDetalle(detalle);
        return detalle;
      } catch (error) {
        if (filaLocal) {
          setEmpresaDetalle(filaLocal);
          return filaLocal;
        }
        throw error;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar la empresa");
      return null;
    } finally {
      setCargandoEmpresa(false);
    }
  };

  const abrirEditarEmpresa = async () => {
    if (await cargarEmpresaDetalle()) setEditarEmpresaOpen(true);
  };

  const abrirEditarRepresentante = async () => {
    if (await cargarEmpresaDetalle()) setEditarRepresentanteOpen(true);
  };

  const refrescarEmpresaSeleccionada = async () => {
    const detalle = await cargarEmpresaDetalle();
    if (detalle) setEmpresa(empresaAccesoDesdeDTO(detalle));
  };

  const guardarRepresentante = async (datos: {
    representanteLegalNombre: string;
    representanteLegalDni: string;
    partidaElectronica: string;
    representanteDireccion: string;
    representanteCorreo: string;
    representanteCelular: string;
    representanteFotoUrl: string;
  }) => {
    if (!empresaDetalle) return;
    try {
      const actualizada = await empresasService.actualizar({ id: empresaDetalle.id, ...datos });
      setEmpresaDetalle(actualizada);
      setEmpresa(empresaAccesoDesdeDTO(actualizada));
      toast.success("Representante legal actualizado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el representante");
    }
  };

  const abrirModal = () => {
    setCarritoAbierto(false);
    setFilasCuotas(crearCuotaFilaInicial(total));
    setModalOpen(true);
  };

  const enviar = async () => {
    if (!eventoId) {
      toast.error("Selecciona un evento activo");
      return;
    }
    if (!empresa?.ruc) {
      toast.error("Selecciona una empresa");
      return;
    }
    if (!representanteVinculado) {
      toast.error("La empresa no tiene un representante legal vinculado");
      return;
    }
    if (!readiness.ok) {
      toast.error(`Faltan datos para el contrato y la factura: ${readiness.faltantes.join(", ")}`);
      return;
    }
    if (!comprobanteSeleccionado) {
      toast.error("Selecciona el tipo de facturación");
      return;
    }
    if (!monedaSeleccionada) {
      toast.error("Selecciona el tipo de pago");
      return;
    }
    if (selected.size === 0) {
      toast.error("Selecciona al menos un stand");
      return;
    }
    if (!cuotasValidas) {
      toast.error("Revisa el cronograma: primera cuota desde hoy, siguientes en orden ascendente y porcentajes que sumen 100%");
      return;
    }
    setCreandoContratoOpen(true);
    setGuardando(true);
    setResultado(null);
    try {
      const response = await reservasAdminService.crear({
        eventoId,
        empresaRuc: empresa.ruc,
        standIds: [...selected],
        moneda: monedaSeleccionada ? monedaPago : undefined,
        tipoComprobante: comprobanteSeleccionado ? (tipoComprobante as TipoComprobante) : undefined,
        cuotas,
      });
      setResultado(response);
      setModalOpen(false);
      toast.success("Reserva creada. Contrato generado; pendiente de firma.");
      setSelected(new Set());
      setEmpresa(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear la reserva");
    } finally {
      setCreandoContratoOpen(false);
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Cargando bandeja">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="mt-2 h-3 w-72" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_160px_160px_160px_auto]">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-20" />
            </div>
            <div className="mt-4">
              <TableSkeleton rows={8} columns={6} />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!eventoId) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Selecciona un evento activo para reservar stands.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">
            Evento: <strong>{session?.eventoNombre ?? eventoId}</strong>
          </p>
          <p className="text-xs text-muted-foreground">
            Reserva interna a nombre de una empresa; se omite la revision de areas y SGC.
          </p>
        </div>
        <Badge className="pointer-events-none bg-primary/10 text-primary">
          <span>{selected.size}/{MAX_RESERVA_ADMIN_STANDS} stands</span>
        </Badge>
      </div>

      {resultado ? (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span>Reserva creada. Contrato generado; pendiente de firma.</span>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/solicitudes"><span>Ver solicitudes</span></Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {planosEvento.length > 0 ? (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-4">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Pabellones (vista 2D)
            </span>
            <div className="flex flex-wrap gap-2">
              {planosEvento.map((plano) => (
                <Button
                  key={plano.codigo}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => { void abrirPabellon2D(plano.codigo); }}
                >
                  <span>{plano.nombre}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        <Card className="min-w-0">
          <CardHeader className="flex flex-wrap items-start justify-between gap-2 space-y-0">
            <div className="min-w-0">
              <CardTitle><span>Stands del evento</span></CardTitle>
              <CardDescription><span>{filtrados.length} de {stands.length} stand(s) &middot; {disponibles} disponibles &middot; {preReservados} pre-reservados.</span></CardDescription>
              <p className="text-[10px] text-muted-foreground">Puedes seleccionar stands disponibles o pre-reservados.</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Label className="hidden text-[11px] text-muted-foreground sm:inline"><span>Por pagina</span></Label>
              <Select value={String(perPage)} onValueChange={(value) => cambiarPerPage(Number(value))}>
                <SelectTrigger className="h-7 w-[72px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}><span>{n}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_160px_160px_160px_auto]">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground"><span>Buscar</span></Label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => cambiarFiltro({ search: event.target.value })}
                    placeholder="Stand, tipo o pabellon"
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground"><span>Pabellon</span></Label>
                <Select value={pabellon} onValueChange={(value) => cambiarFiltro({ pabellon: value })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UI_SENTINEL.TODOS}><span>Todos los pabellones</span></SelectItem>
                    {pabellones.map((item) => <SelectItem key={item} value={item}><span>{item}</span></SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground"><span>Tipo</span></Label>
                <Select value={tipo} onValueChange={(value) => cambiarFiltro({ tipo: value })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UI_SENTINEL.TODOS}><span>Todos los tipos</span></SelectItem>
                    {tipos.map((item) => <SelectItem key={item} value={item}><span>{item}</span></SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground"><span>Estado</span></Label>
                <Select value={estadoFiltro} onValueChange={(value) => cambiarFiltro({ estado: value })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UI_SENTINEL.TODOS}><span>Todos los estados</span></SelectItem>
                    {ESTADOS_FILTRO.map((item) => (
                      <SelectItem key={item} value={item}>
                        <span>{badgeEstadoReservaAdmin(item)?.texto ?? item}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={limpiarFiltros} disabled={!hayFiltros}>
                  <span>Limpiar</span>
                </Button>
              </div>
            </div>

            {cargandoStands ? (
              <TableSkeleton rows={Math.min(perPage, 8)} columns={6} />
            ) : filtrados.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No hay stands con los filtros actuales.</p>
            ) : (
              <>
                <div className="max-h-[520px] overflow-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={todosPaginaSeleccionados}
                            disabled={visiblesSeleccionables.length === 0}
                            onCheckedChange={(value) => seleccionarPagina(value === true)}
                          />
                        </TableHead>
                        <TableHead><span>Stand</span></TableHead>
                        <TableHead className="hidden sm:table-cell"><span>Tipo</span></TableHead>
                        <TableHead className="hidden md:table-cell"><span>Pabellon</span></TableHead>
                        <TableHead><span>Estado</span></TableHead>
                        <TableHead className="text-right"><span>Precio</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibles.map((stand) => {
                        const estado = badgeEstadoReservaAdmin(stand.estado);
                        const seleccionable = esStandSeleccionableAdmin(stand);
                        return (
                          <TableRow
                            key={stand.id}
                            className={seleccionable ? "cursor-pointer hover:bg-muted/40" : "opacity-60"}
                            onClick={() => {
                              if (seleccionable) toggle(stand);
                            }}
                          >
                            <TableCell onClick={(event) => event.stopPropagation()}>
                              <Checkbox
                                checked={selected.has(stand.id)}
                                disabled={!seleccionable}
                                onCheckedChange={() => toggle(stand)}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs">{stand.standCode}</TableCell>
                            <TableCell className="hidden text-xs sm:table-cell">{normalizarTipoStand(stand.tipoStand) ?? "-"}</TableCell>
                            <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground md:table-cell">{normalizarPabellon(stand.pabellon) ?? "-"}</TableCell>
                            <TableCell>
                              {estado ? <Badge className={`pointer-events-none text-[9px] ${estado.clase}`}><span>{estado.texto}</span></Badge> : "-"}
                              {stand.estado === ESTADOS_STAND.PRE_RESERVADO && (
                                <span className="mt-0.5 block max-w-[180px] truncate text-[10px] text-muted-foreground" title={stand.preReservaRazonSocial ?? stand.preReservaTitulo ?? undefined}>
                                  {stand.preReservaRazonSocial ?? stand.preReservaTitulo ?? "Sin empresa"}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="min-w-[120px] whitespace-nowrap text-right text-xs font-medium">
                              {formatearMonto(convertirNeto(resolverPrecioStand(stand), monedaPago, tipoCambio), monedaPago, { decimales: 2 })}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs text-muted-foreground">
                    {filtrados.length} resultados &middot; pagina {pageActual} de {totalPages}
                  </span>
                  <div className="flex items-center">
                    <Pagination page={pageActual} totalPages={totalPages} onPageChange={setPage} />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

      </div>

      {selected.size > 0 ? (
        <div className="fixed bottom-4 left-4 right-4 z-40 flex flex-col items-stretch gap-2 sm:left-auto sm:right-6 sm:items-end">
          {carritoAbierto && (
            <div className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-xl sm:w-[380px]">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <p className="text-xs font-semibold text-foreground">Stands seleccionados ({seleccionados.length})</p>
                <div className="flex flex-col items-end gap-0.5 text-[10px] text-muted-foreground">
                  <span>Neto: {formatearMonto(neto, monedaPago, { decimales: 2 })}</span>
                  <span>IGV: {formatearMonto(igv, monedaPago, { decimales: 2 })}</span>
                  <span className="text-xs font-semibold text-foreground">Total con IGV: {formatearMonto(total, monedaPago, { decimales: 2 })}</span>
                </div>
              </div>
              <div className="max-h-[45vh] overflow-y-auto p-1.5">
                {seleccionados.map((stand) => (
                  <div key={stand.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/60">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs font-semibold text-foreground">{stand.standCode}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {normalizarTipoStand(stand.tipoStand) ?? "-"} · {normalizarPabellon(stand.pabellon) ?? "-"}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-foreground">
                      {formatearMonto(convertirNeto(resolverPrecioStand(stand), monedaPago, tipoCambio), monedaPago, { decimales: 2 })}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title={`Quitar ${stand.standCode}`}
                      aria-label={`Quitar stand ${stand.standCode}`}
                      onClick={() => toggle(stand)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="border-t border-border p-2">
                <Button type="button" className="w-full justify-between gap-2" onClick={abrirModal}>
                  <span>Continuar con la reserva</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          <Button
            type="button"
            size="lg"
            className="h-11 w-full justify-between gap-3 px-5 shadow-lg sm:w-auto"
            aria-expanded={carritoAbierto}
            onClick={() => setCarritoAbierto((abierto) => !abierto)}
          >
            <span className="flex items-center gap-2">
              <span className="font-semibold">{selected.size} stand(s)</span>
              <span className="text-xs font-normal opacity-80">Total con IGV {formatearMonto(total, monedaPago, { decimales: 2 })}</span>
            </span>
            <ChevronRight className={`h-4 w-4 transition-transform ${carritoAbierto ? "rotate-90" : ""}`} />
          </Button>
        </div>
      ) : null}

      <Dialog open={modalOpen} onOpenChange={(open) => { if (!guardando) setModalOpen(open); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader className="text-left">
            <DialogTitle><span>Reserva administrativa</span></DialogTitle>
            <p className="text-xs text-muted-foreground">
              <span>Selecciona la empresa y el cronograma. El contrato se generará automáticamente; la solicitud quedará pendiente de firma.</span>
            </p>
          </DialogHeader>

          <div className="space-y-4">
            <EmpresaPicker
              seleccion={empresa}
              onSeleccion={(value) => {
                setEmpresa(value);
                setTipoComprobante(UI_SENTINEL.SELECCIONAR);
              }}
              fuentes={["local"]}
              permitirSinSie
              label="Empresa"
            />

            {empresa ? (
              <div className={`rounded-md border p-3 ${representanteVinculado ? "border-border bg-secondary/30" : "border-warning/40 bg-warning/10"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Representante legal
                  </span>
                  <span className={`text-[10px] font-medium ${representanteVinculado ? "text-success" : "text-warning"}`}>
                    {representanteVinculado ? "Cuenta vinculada" : "Sin cuenta vinculada"}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium">
                  {empresa.representanteLegalNombre ?? "Representante no registrado"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {empresa.representanteCorreo ?? "Sin correo registrado"}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-[11px]"
                    disabled={cargandoEmpresa}
                    onClick={() => { void abrirEditarEmpresa(); }}
                  >
                    <Pencil className="h-3 w-3" />
                    <span>Editar empresa</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-[11px]"
                    disabled={cargandoEmpresa}
                    onClick={() => { void abrirEditarRepresentante(); }}
                  >
                    <UserRound className="h-3 w-3" />
                    <span>Editar representante legal</span>
                  </Button>
                </div>
                {readiness.ok ? (
                  <p className="mt-2 text-[11px] font-medium text-success">
                    Datos completos para contrato y facturación.
                  </p>
                ) : (
                  <div className="mt-2 rounded-md border border-warning/30 bg-warning/10 px-2 py-1.5">
                    <p className="text-[11px] font-medium text-warning">
                      Faltan datos para el contrato y la facturación:
                    </p>
                    <div className="mt-1 space-y-0.5 text-[10px] text-warning">
                      {readiness.faltantesEmpresa.length > 0 ? (
                        <p>
                          <strong className="font-semibold">Empresa:</strong>{" "}
                          {readiness.faltantesEmpresa.join(", ")}
                        </p>
                      ) : null}
                      {readiness.faltantesRepresentante.length > 0 ? (
                        <p>
                          <strong className="font-semibold">Representante legal:</strong>{" "}
                          {readiness.faltantesRepresentante.join(", ")}
                        </p>
                      ) : null}
                      {readiness.faltantesGenerales.length > 0 ? (
                        <p>
                          <strong className="font-semibold">Facturación:</strong>{" "}
                          {readiness.faltantesGenerales.join(", ")}
                        </p>
                      ) : null}
                      {readiness.faltantesPago.length > 0 ? (
                        <p>
                          <strong className="font-semibold">Pago:</strong>{" "}
                          {readiness.faltantesPago.join(", ")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="reserva-comprobante">Tipo de facturación</Label>
              <Select
                value={tipoComprobante}
                onValueChange={(value) => setTipoComprobante(value as TipoComprobante)}
              >
                <SelectTrigger id="reserva-comprobante">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UI_SENTINEL.SELECCIONAR} disabled>
                    <span>Seleccionar</span>
                  </SelectItem>
                  <SelectItem value={TIPOS_COMPROBANTE.FACTURA}>
                    <span>{TIPO_COMPROBANTE_LABELS[TIPOS_COMPROBANTE.FACTURA]}</span>
                  </SelectItem>
                  <SelectItem value={TIPOS_COMPROBANTE.BOLETA}>
                    <span>{TIPO_COMPROBANTE_LABELS[TIPOS_COMPROBANTE.BOLETA]}</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Se declara en la solicitud y se usa para el contrato y la facturación.
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="reserva-moneda">Tipo de pago</Label>
              <Select value={moneda} onValueChange={cambiarMoneda}>
                <SelectTrigger id="reserva-moneda">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UI_SENTINEL.SELECCIONAR} disabled>
                    <span>Seleccionar</span>
                  </SelectItem>
                  <SelectItem value={MONEDAS.USD}>
                    <span>Dólares (USD)</span>
                  </SelectItem>
                  <SelectItem value={MONEDAS.PEN} disabled={!puedePagarEnSoles}>
                    <span>Soles (PEN)</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {puedePagarEnSoles
                  ? `Tipo de cambio: S/ ${tipoCambio} por USD.`
                  : "El evento no tiene tipo de cambio configurado; solo se permite USD."}
              </p>
            </div>
            </div>

            <CuotasEditor
              filas={filasCuotas}
              onChange={setFilasCuotas}
              montoTotal={total}
              moneda={monedaPago}
              disabled={guardando}
              ayuda={AYUDA_CRONOGRAMA_RESERVA}
            />

            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Stands seleccionados</span>
                <span className="font-medium">{selected.size}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted-foreground">Neto</span>
                <span>{formatearMonto(neto, monedaPago, { decimales: 2 })}</span>
              </div>
              <div className="mt-1 flex items-center justify-between font-semibold">
                <span>Total con IGV</span>
                <span>{formatearMonto(total, monedaPago, { decimales: 2 })}</span>
              </div>
              <div className="mt-2 space-y-1 border-t border-border pt-2">
                {cuotas.map((cuota, index) => (
                  <div key={`${cuota.fechaVencimiento}-${index}`} className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Cuota {index + 1}</span>
                    <span>{cuota.porcentaje}% &middot; {dateUtils.format(cuota.fechaVencimiento)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={guardando}
            >
              <span>Cancelar</span>
            </Button>
            <Button
              type="button"
              onClick={() => setConfirmarOpen(true)}
              disabled={
                guardando ||
                !empresa?.ruc ||
                !readiness.ok ||
                !comprobanteSeleccionado ||
                !monedaSeleccionada ||
                selected.size === 0 ||
                !cuotasValidas
              }
            >
              <span>Revisar y crear reserva</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editarEmpresaOpen && empresaDetalle ? (
        <EmpresaFormModal
          empresa={empresaDetalle}
          onClose={() => setEditarEmpresaOpen(false)}
          onSaved={() => {
            setEditarEmpresaOpen(false);
            void refrescarEmpresaSeleccionada();
          }}
        />
      ) : null}

      {editarRepresentanteOpen && empresaDetalle ? (
        <RepresentanteLegalModal
          inicial={{
            nombre: empresaDetalle.representanteLegalNombre ?? "",
            dni: empresaDetalle.representanteLegalDni ?? "",
            partida: empresaDetalle.partidaElectronica ?? "",
            direccion: empresaDetalle.representanteDireccion ?? "",
            correo: empresaDetalle.representanteCorreo ?? "",
            celular: empresaDetalle.representanteCelular ?? "",
            fotoUrl: "",
          }}
          onGuardar={(datos) => { void guardarRepresentante(datos); }}
          onClose={() => setEditarRepresentanteOpen(false)}
        />
      ) : null}

      <ConfirmDialog
        open={confirmarOpen}
        title="¿Crear la reserva y generar el contrato?"
        contentClassName="sm:max-w-2xl"
        description={(
          <div className="space-y-3 text-xs">
            <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Empresa</span>
                <p className="font-medium text-foreground">{empresa?.nombreEmpresa ?? "Empresa seleccionada"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Tipo de facturación</span>
                <p className="font-medium text-foreground">
                  {TIPO_COMPROBANTE_LABELS[tipoComprobante] ?? tipoComprobante}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Tipo de pago</span>
                <p className="font-medium text-foreground">
                  {monedaPago === MONEDAS.PEN ? "Soles (PEN)" : "Dólares (USD)"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Cuotas</span>
                <p className="font-medium text-foreground">{cuotas.length}</p>
              </div>
            </div>

            <div>
              <p className="mb-1 font-medium text-foreground">Stands seleccionados ({seleccionados.length})</p>
              <div className="max-h-40 overflow-y-auto rounded-md border border-border">
                {seleccionados.map((stand) => (
                  <div
                    key={stand.id}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border px-2 py-1.5 last:border-b-0"
                  >
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                      <strong className="font-mono text-foreground">{stand.standCode}</strong>
                      <span className="text-muted-foreground">
                        {normalizarTipoStand(stand.tipoStand) ?? "-"}
                        {" · "}
                        {normalizarPabellon(stand.pabellon) ?? "-"}
                      </span>
                    </span>
                    <span className="font-medium text-foreground">
                      {formatearMonto(
                        convertirNeto(resolverPrecioStand(stand), monedaPago, tipoCambio),
                        monedaPago,
                        { decimales: 2 },
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {seleccionados.some((stand) => stand.estado === ESTADOS_STAND.PRE_RESERVADO) && (
              <p className="rounded-md border border-info/30 bg-info/10 px-2 py-1.5 text-[11px] text-info">
                Los stands pre-reservados se liberarán de la pre-reserva al generar la solicitud y el contrato.
              </p>
            )}

            <div className="space-y-1 rounded-md bg-secondary/40 p-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Neto</span>
                <span className="text-foreground">{formatearMonto(neto, monedaPago, { decimales: 2 })}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">IGV</span>
                <span className="text-foreground">{formatearMonto(igv, monedaPago, { decimales: 2 })}</span>
              </div>
              <div className="flex items-center justify-between font-semibold">
                <span>Total</span>
                <span>{formatearMonto(total, monedaPago, { decimales: 2 })}</span>
              </div>
            </div>

            <div className="space-y-1">
              <p className="font-medium text-foreground">Cronograma</p>
              {cuotas.map((cuota, index) => (
                <div key={`${cuota.fechaVencimiento}-${index}`} className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cuota {index + 1}</span>
                  <span className="text-foreground">
                    {cuota.porcentaje}% · {dateUtils.format(cuota.fechaVencimiento)}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-muted-foreground">
              La solicitud quedará <strong className="text-foreground">pendiente de firma</strong>; después pasará a revisión del Asociado y, al aprobarse, a Pendiente Pago.
            </p>
          </div>
        )}
        confirmLabel="Sí, generar contrato"
        cancelLabel="Revisar"
        onConfirm={() => {
          setConfirmarOpen(false);
          void enviar();
        }}
        onCancel={() => setConfirmarOpen(false)}
      />

      <Dialog open={creandoContratoOpen} onOpenChange={() => { /* operacion en curso */ }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="text-left">
            <DialogTitle><span>Generando contrato</span></DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3 py-3" aria-busy="true">
            <Loader2 className="h-6 w-6 shrink-0 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Estamos creando la solicitud y generando el contrato. Esto puede tardar unos segundos.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={plano2DOpen} onOpenChange={(open) => { if (!cargandoPlano2D) setPlano2DOpen(open); }}>
        <DialogContent className="flex max-h-[92vh] w-[min(1400px,96vw)] flex-col gap-0 overflow-hidden !px-0 !py-0 sm:max-w-[1400px]">
          <DialogHeader className="shrink-0 border-b border-border px-5 pb-3 pt-4 !pr-12 text-left">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <DialogTitle><span>{plano2D?.nombre ?? "Pabellón"}</span></DialogTitle>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() => cambiarZoomPlano2D(-PLANO_2D_ZOOM_PASO)}
                  disabled={cargandoPlano2D || !plano2D || plano2DZoom <= PLANO_2D_ZOOM_MIN}
                  title="Alejar"
                  aria-label="Alejar plano"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="min-w-10 text-center text-[11px] font-medium text-muted-foreground">
                  {Math.round(plano2DZoom * 100)}%
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() => cambiarZoomPlano2D(PLANO_2D_ZOOM_PASO)}
                  disabled={cargandoPlano2D || !plano2D || plano2DZoom >= PLANO_2D_ZOOM_MAX}
                  title="Acercar"
                  aria-label="Acercar plano"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => setPlano2DZoom(1)}
                  disabled={cargandoPlano2D || !plano2D || plano2DZoom === 1}
                  title="Restablecer zoom"
                  aria-label="Restablecer zoom"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {cargandoPlano2D || !plano2D ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Cargando plano 2D...</span>
              </div>
            ) : (
              <Plano2DVista payload={plano2D} codigoComercialPorBloque={codigoComercialPorBloque} zoom={plano2DZoom} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
