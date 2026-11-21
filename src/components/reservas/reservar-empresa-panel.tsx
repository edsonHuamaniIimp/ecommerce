"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
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
  RadioGroup,
  RadioGroupItem,
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
import { CheckCircle2, ChevronLeft, ChevronRight, LayoutGrid, LayoutList, Loader2, Pencil, RotateCcw, Search, UserRound, X, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CuotasEditor, crearCuotaFilaInicial, validarFilasCuotas, type CuotaFila } from "@/components/shared/cuotas-editor";
import { planCuotasConFechas } from "@/lib/shared/utils/cuotas";
import { EmpresaPicker } from "@/components/shared/empresa-picker";
import { Plano2D as Plano2DVista, PLANO_2D_ZOOM_MAX, PLANO_2D_ZOOM_MIN, PLANO_2D_ZOOM_PASO } from "@/components/plano/plano-2d";
import { EmpresaFormModal } from "@/components/empresas/empresa-form-modal";
import { RepresentanteLegalModal } from "@/components/empresas/representante-legal-modal";
import { Pagination } from "@/components/shared/pagination";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { useSesion } from "@/hooks/use-sesion";
import { useMaestraLabels } from "@/hooks/use-maestra-labels";
import { eventosServiceClient } from "@/lib/client/api/services/eventos-service";
import { reservasAdminService } from "@/lib/client/api/services/reservas-admin-service";
import { gessService } from "@/lib/client/api/services/gess-service";
import { empresasService } from "@/lib/client/api/services/empresas-service";
import { planosService } from "@/lib/client/api/services/planos-service";
import { ESTADOS_STAND, BADGE_STYLES, DESCUENTO_PORCENTAJE_MAX, DESCUENTO_PORCENTAJE_MIN, DESCUENTO_PORCENTAJE_PASO, MAX_RESERVA_ADMIN_STANDS, MAESTRA_TABLAS, MODOS_DESCUENTO, TIPOS_DESCUENTO, type ModoDescuento, type TipoDescuentoGlobal, MONEDAS, TIPOS_COMPROBANTE, TIPOS_DOCUMENTO_PERSONA, TIPO_COMPROBANTE_LABELS, UI_SENTINEL, type TipoComprobante } from "@/lib/shared/constants";
import { aplicarDescuentoMonto, aplicarDescuentoNeto, calcularImportes, descuentoMontoValido, descuentoPorcentajeValido, redondear2 } from "@/lib/shared/utils/importes";
import { dateUtils } from "@/lib/shared/utils/date";
import { convertirNeto, formatearMonto, tipoCambioValido } from "@/lib/shared/utils/moneda";
import { esStandComercialReservable, resolverPrecioStand } from "@/lib/shared/utils/precio-stand";
import { normalizarPabellon } from "@/lib/shared/utils/pabellon";
import { normalizarTexto } from "@/lib/shared/utils/normalizar-texto";
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

const VISTAS_DESCUENTO = {
  LISTA: "lista",
  GRID: "grid",
} as const;

type VistaDescuento = (typeof VISTAS_DESCUENTO)[keyof typeof VISTAS_DESCUENTO];

const AYUDA_CRONOGRAMA_RESERVA =
  "Las fechas definen el cronograma del contrato que el cliente firmará. Después de la firma, la solicitud pasa a revisión del Asociado; recién con su aprobación se genera la orden de pago. La primera cuota puede ser hoy; las siguientes deben ser posteriores y en orden ascendente.";

const OPCIONES_DESCUENTO = [
  {
    key: "porcentaje_total",
    itemId: 1,
    modo: MODOS_DESCUENTO.GRUPAL,
    tipo: TIPOS_DESCUENTO.PORCENTAJE,
    label: "Porcentaje sobre el total del contrato",
  },
  {
    key: "monto_total",
    itemId: 2,
    modo: MODOS_DESCUENTO.GRUPAL,
    tipo: TIPOS_DESCUENTO.MONTO,
    label: "Monto fijo sobre el total del contrato",
  },
  {
    key: "porcentaje_stand",
    itemId: 3,
    modo: MODOS_DESCUENTO.POR_STAND,
    tipo: TIPOS_DESCUENTO.PORCENTAJE,
    label: "Porcentaje por cada stand",
  },
  {
    key: "monto_stand",
    itemId: 4,
    modo: MODOS_DESCUENTO.POR_STAND,
    tipo: TIPOS_DESCUENTO.MONTO,
    label: "Monto fijo por cada stand",
  },
] as const;

const OPCIONES_DESCUENTO_ITEM_IDS = Object.fromEntries(
  OPCIONES_DESCUENTO.map((opcion) => [opcion.key, opcion.itemId]),
) as Record<string, number>;

const OPCIONES_DESCUENTO_LABELS = Object.fromEntries(
  OPCIONES_DESCUENTO.map((opcion) => [opcion.key, opcion.label]),
) as Record<string, string>;

/** En esta bandeja la pre-reserva se muestra con su nombre comercial. */
function badgeEstadoReservaAdmin(estado: string | null | undefined) {
  if (estado === ESTADOS_STAND.PRE_RESERVADO) {
    return { texto: "Pre-reservado", clase: BADGE_STYLES.INFO };
  }
  return estadoStandBadge(estado);
}

function etiquetaPreReservaStand(stand: GessStandDTO): string | null {
  const etiqueta = (stand.preReservaRazonSocial ?? stand.preReservaTitulo ?? stand.empresa ?? "").trim();
  return etiqueta || null;
}

function empresaAccesoDesdeDTO(empresa: EmpresaDTO): EmpresaAccesoDTO {
  return {
    empresaId: empresa.id,
    idEmpresa: empresa.sieCode ?? "",
    nombreEmpresa: empresa.razonSocial,
    ruc: empresa.ruc,
    tipoDocumentoEmpresa: empresa.tipoDocumento,
    pais: empresa.pais,
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
  const [empresaPreReserva, setEmpresaPreReserva] = useState<string>(UI_SENTINEL.TODOS);
  const [tipo, setTipo] = useState<string>(UI_SENTINEL.TODOS);
  const [estadoFiltro, setEstadoFiltro] = useState<string>(ESTADOS_STAND.PRE_RESERVADO);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [moneda, setMoneda] = useState<string>(UI_SENTINEL.SELECCIONAR);
  const [aplicarDescuento, setAplicarDescuento] = useState(false);
  const [modoDescuento, setModoDescuento] = useState<ModoDescuento>(MODOS_DESCUENTO.GRUPAL);
  const [tipoDescuento, setTipoDescuento] = useState<TipoDescuentoGlobal>(TIPOS_DESCUENTO.PORCENTAJE);
  const [descuentoPorcentaje, setDescuentoPorcentaje] = useState("0");
  const [descuentoMontoInput, setDescuentoMontoInput] = useState("0");
  const [descuentosStand, setDescuentosStand] = useState<Record<string, string>>({});
  const [descuentoSeleccionados, setDescuentoSeleccionados] = useState<Set<string>>(new Set());
  const [descuentoMasivo, setDescuentoMasivo] = useState("");
  const [vistaDescuento, setVistaDescuento] = useState<VistaDescuento>(VISTAS_DESCUENTO.LISTA);
  const [busquedaDescuentoStand, setBusquedaDescuentoStand] = useState("");
  const descuentoLabels = useMaestraLabels(
    MAESTRA_TABLAS.DESCUENTO_TIPO,
    OPCIONES_DESCUENTO_ITEM_IDS,
    OPCIONES_DESCUENTO_LABELS,
  );
  const [tipoComprobante, setTipoComprobante] = useState<string>(UI_SENTINEL.SELECCIONAR);
  const [tipoCambio, setTipoCambio] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const esStandSeleccionableAdmin = (stand: GessStandDTO): boolean =>
    stand.estado === ESTADOS_STAND.DISPONIBLE || stand.estado === ESTADOS_STAND.PRE_RESERVADO;
  const [filasCuotas, setFilasCuotas] = useState<CuotaFila[]>(crearCuotaFilaInicial);
  const [guardando, setGuardando] = useState(false);
  const [paso, setPaso] = useState(0);
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
  const empresasPreReserva = useMemo(() => {
    const etiquetas = new Map<string, string>();
    for (const stand of stands) {
      if (stand.estado !== ESTADOS_STAND.PRE_RESERVADO) continue;
      if (pabellon !== UI_SENTINEL.TODOS && normalizarPabellon(stand.pabellon) !== pabellon) continue;
      const etiqueta = etiquetaPreReservaStand(stand);
      if (!etiqueta) continue;
      const clave = normalizarTexto(etiqueta);
      if (clave && !etiquetas.has(clave)) etiquetas.set(clave, etiqueta);
    }
    return Array.from(etiquetas.values()).sort((a, b) => a.localeCompare(b, "es"));
  }, [pabellon, stands]);
  const empresaPreReservaActiva =
    empresaPreReserva === UI_SENTINEL.TODOS || empresasPreReserva.includes(empresaPreReserva)
      ? empresaPreReserva
      : UI_SENTINEL.TODOS;
  const filtrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    const empresaFiltro = normalizarTexto(empresaPreReservaActiva);
    return stands.filter((stand) => {
      const pabellonStand = normalizarPabellon(stand.pabellon);
      if (estadoFiltro !== UI_SENTINEL.TODOS && stand.estado !== estadoFiltro) return false;
      if (pabellon !== UI_SENTINEL.TODOS && pabellonStand !== pabellon) return false;
      if (tipo !== UI_SENTINEL.TODOS && normalizarTipoStand(stand.tipoStand) !== tipo) return false;
      if (empresaPreReservaActiva !== UI_SENTINEL.TODOS) {
        if (stand.estado !== ESTADOS_STAND.PRE_RESERVADO) return false;
        const etiqueta = etiquetaPreReservaStand(stand);
        if (!etiqueta || normalizarTexto(etiqueta) !== empresaFiltro) return false;
      }
      if (!term) return true;
      return [stand.standCode, normalizarTipoStand(stand.tipoStand), pabellonStand]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [empresaPreReservaActiva, estadoFiltro, pabellon, search, stands, tipo]);
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
    empresaPreReservaActiva !== UI_SENTINEL.TODOS ||
    tipo !== UI_SENTINEL.TODOS ||
    estadoFiltro !== ESTADOS_STAND.PRE_RESERVADO;

  const seleccionados = useMemo(
    () => stands.filter((stand) => selected.has(stand.id)),
    [stands, selected],
  );
  const descuentoSeleccionadosActivos = useMemo(() => {
    const activos = new Set<string>();
    for (const standId of descuentoSeleccionados) {
      if (selected.has(standId)) activos.add(standId);
    }
    return activos;
  }, [descuentoSeleccionados, selected]);
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
        { ...empresa, tipoDocumento: empresa.tipoDocumentoEmpresa, razonSocial: empresa.nombreEmpresa },
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
  const netoLista = convertirNeto(netoUsd, monedaPago, tipoCambio);
  const esDescuentoPorStand = aplicarDescuento && modoDescuento === MODOS_DESCUENTO.POR_STAND;
  const descuentoNumero = aplicarDescuento
    ? (tipoDescuento === TIPOS_DESCUENTO.PORCENTAJE ? Number(descuentoPorcentaje || 0) : Number(descuentoMontoInput || 0))
    : 0;
  const calcularDescuentoStand = (stand: (typeof seleccionados)[number]) => {
    const valor = descuentosStand[stand.id] ?? "0";
    const numero = Number(valor || 0) || 0;
    const precio = convertirNeto(resolverPrecioStand(stand), monedaPago, tipoCambio);
    const valido = valor.trim() !== "" && (tipoDescuento === TIPOS_DESCUENTO.PORCENTAJE
      ? descuentoPorcentajeValido(numero)
      : descuentoMontoValido(precio, numero));
    return {
      precio,
      valor,
      valido,
      descuento: valido
        ? tipoDescuento === TIPOS_DESCUENTO.PORCENTAJE
          ? redondear2(precio - aplicarDescuentoNeto(precio, numero))
          : numero
        : 0,
      neto: valido
        ? tipoDescuento === TIPOS_DESCUENTO.PORCENTAJE
          ? aplicarDescuentoNeto(precio, numero)
          : aplicarDescuentoMonto(precio, numero)
        : precio,
    };
  };
  const detallesDescuentoStand = seleccionados.map(calcularDescuentoStand);
  const detalleDescuentoPorStand = new Map(
    seleccionados.map((stand, index) => [stand.id, detallesDescuentoStand[index]]),
  );
  const busquedaStand = busquedaDescuentoStand.trim().toLowerCase();
  const standsDescuentoFiltrados = seleccionados.filter((stand) => {
    if (!busquedaStand) return true;
    return `${stand.standCode} ${normalizarTipoStand(stand.tipoStand) ?? ""}`.toLowerCase().includes(busquedaStand);
  });
  const seleccionadosDescuentoFiltrados = standsDescuentoFiltrados.filter((stand) => descuentoSeleccionadosActivos.has(stand.id)).length;
  const todosDescuentoFiltradosSeleccionados =
    standsDescuentoFiltrados.length > 0 && seleccionadosDescuentoFiltrados === standsDescuentoFiltrados.length;
  const algunosDescuentoFiltradosSeleccionados =
    seleccionadosDescuentoFiltrados > 0 && !todosDescuentoFiltradosSeleccionados;
  const estadoSeleccionDescuentoFiltrados: boolean | "indeterminate" = todosDescuentoFiltradosSeleccionados
    ? true
    : algunosDescuentoFiltradosSeleccionados
      ? "indeterminate"
      : false;
  const etiquetaDescuentoSeleccionados = `${descuentoSeleccionadosActivos.size} ${descuentoSeleccionadosActivos.size === 1 ? "seleccionado" : "seleccionados"}`;
  const etiquetaDescuentoFiltrados = `${standsDescuentoFiltrados.length} ${standsDescuentoFiltrados.length === 1 ? "filtrado" : "filtrados"}`;
  const descuentosStandValidos = !esDescuentoPorStand || detallesDescuentoStand.every((detalle) => detalle.valido);
  const netoPorStand = redondear2(detallesDescuentoStand.reduce((total, detalle) => total + detalle.neto, 0));
  const descuentoValido = !aplicarDescuento || (
    esDescuentoPorStand
      ? descuentosStandValidos
      : tipoDescuento === TIPOS_DESCUENTO.PORCENTAJE
        ? descuentoPorcentaje.trim() !== "" && descuentoPorcentajeValido(descuentoNumero)
        : descuentoMontoInput.trim() !== "" && descuentoMontoValido(netoLista, descuentoNumero)
  );
  const neto = !descuentoValido
    ? netoLista
    : esDescuentoPorStand
      ? netoPorStand
      : tipoDescuento === TIPOS_DESCUENTO.PORCENTAJE
        ? aplicarDescuentoNeto(netoLista, descuentoNumero)
        : aplicarDescuentoMonto(netoLista, descuentoNumero);
  const descuentoMonto = redondear2(netoLista - neto);
  const etiquetaDescuento = esDescuentoPorStand
    ? "Descuento por stand"
    : tipoDescuento === TIPOS_DESCUENTO.PORCENTAJE
      ? `Descuento (${descuentoNumero}%)`
      : "Descuento fijo";
  const importes = calcularImportes(neto);
  const total = importes.total;
  const totalValido = total > 0;
  const opcionDescuento = `${modoDescuento}:${tipoDescuento}`;
  const cambiarOpcionDescuento = (value: string) => {
    const [modo, tipo] = value.split(":") as [ModoDescuento, TipoDescuentoGlobal];
    setModoDescuento(modo);
    setTipoDescuento(tipo);
    setDescuentoPorcentaje("0");
    setDescuentoMontoInput("0");
    setDescuentoMasivo("");
    setDescuentosStand({});
  };
  const igv = importes.igv;
  const cuotas = filasCuotas.map((fila) => ({
    porcentaje: Number(fila.porcentaje),
    fechaVencimiento: fila.fecha,
  }));
  const cuotasCalculadas = planCuotasConFechas(
    total,
    cuotas.map((cuota) => cuota.porcentaje),
    cuotas.map((cuota) => cuota.fechaVencimiento),
  );
  const cuotasValidas = validarFilasCuotas(filasCuotas);
  const paso1Valido = Boolean(empresa?.ruc) && readiness.ok && comprobanteSeleccionado && monedaSeleccionada && selected.size > 0;
  const paso2Valido = descuentoValido && totalValido;
  const paso3Valido = cuotasValidas && cuotas.length > 0;
  const puedeAvanzar = paso === 0 ? paso1Valido : paso === 1 ? paso2Valido : false;

  const quitarDescuentoStands = (ids: string[]) => {
    setDescuentoSeleccionados((prev) => {
      if (!ids.some((id) => prev.has(id))) return prev;
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  };

  const toggle = (stand: GessStandDTO) => {
    if (!esStandSeleccionableAdmin(stand)) {
      toast.error("Solo se pueden seleccionar stands disponibles o pre-reservados");
      return;
    }
    if (selected.has(stand.id)) quitarDescuentoStands([stand.id]);
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
    const idsPagina = visiblesSeleccionables.map((stand) => stand.id);
    if (!checked) quitarDescuentoStands(idsPagina);
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

  const toggleDescuentoStand = (standId: string, checked: boolean) => {
    setDescuentoSeleccionados((prev) => {
      const next = new Set(prev);
      if (checked) next.add(standId);
      else next.delete(standId);
      return next;
    });
  };

  const alternarDescuentoDesdeFila = (event: MouseEvent<HTMLDivElement>, standId: string) => {
    if (guardando) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("input, button, select, textarea, a, [data-no-toggle]")) return;
    toggleDescuentoStand(standId, !descuentoSeleccionadosActivos.has(standId));
  };

  const seleccionarDescuentosFiltrados = (checked: boolean) => {
    setDescuentoSeleccionados((prev) => {
      const next = new Set(prev);
      for (const stand of standsDescuentoFiltrados) {
        if (checked) next.add(stand.id);
        else next.delete(stand.id);
      }
      return next;
    });
  };

  const aplicarDescuentoMasivo = (destino: "seleccionados" | "filtrados") => {
    const objetivo = destino === "seleccionados"
      ? seleccionados.filter((stand) => descuentoSeleccionadosActivos.has(stand.id))
      : standsDescuentoFiltrados;
    if (objetivo.length === 0) {
      toast.error("Selecciona al menos un stand");
      return;
    }
    const valorTexto = descuentoMasivo.trim();
    const valor = Number(valorTexto);
    if (!valorTexto || !Number.isFinite(valor)) {
      toast.error("Ingresa un descuento valido");
      return;
    }
    if (tipoDescuento === TIPOS_DESCUENTO.PORCENTAJE) {
      if (!descuentoPorcentajeValido(valor)) {
        toast.error("El porcentaje debe estar entre 0 y 100, con maximo 2 decimales");
        return;
      }
    } else {
      const standInvalido = objetivo.find((stand) => {
        const precio = convertirNeto(resolverPrecioStand(stand), monedaPago, tipoCambio);
        return !descuentoMontoValido(precio, valor);
      });
      if (standInvalido) {
        toast.error(`El monto debe tener maximo 2 decimales y no superar el precio neto de ${standInvalido.standCode}`);
        return;
      }
    }
    setDescuentosStand((prev) => {
      const next = { ...prev };
      for (const stand of objetivo) next[stand.id] = valorTexto;
      return next;
    });
    toast.success(`Descuento aplicado a ${objetivo.length} stand(s)`);
  };

  const quitarDescuentoMasivo = () => {
    const objetivo = seleccionados.filter((stand) => descuentoSeleccionadosActivos.has(stand.id));
    if (objetivo.length === 0) {
      toast.error("Selecciona al menos un stand");
      return;
    }
    setDescuentosStand((prev) => {
      const next = { ...prev };
      for (const stand of objetivo) delete next[stand.id];
      return next;
    });
    toast.success(`Descuento quitado a ${objetivo.length} stand(s)`);
  };

  const cambiarFiltro = (cambios: Partial<{ search: string; pabellon: string; empresaPreReserva: string; tipo: string; estado: string }>) => {
    if (cambios.search !== undefined) setSearch(cambios.search);
    if (cambios.pabellon !== undefined) {
      setPabellon(cambios.pabellon);
      setEmpresaPreReserva(UI_SENTINEL.TODOS);
    }
    if (cambios.empresaPreReserva !== undefined) setEmpresaPreReserva(cambios.empresaPreReserva);
    if (cambios.tipo !== undefined) setTipo(cambios.tipo);
    if (cambios.estado !== undefined) setEstadoFiltro(cambios.estado);
    setPage(1);
  };

  const limpiarFiltros = () => {
    setSearch("");
    setPabellon(UI_SENTINEL.TODOS);
    setEmpresaPreReserva(UI_SENTINEL.TODOS);
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
    representanteLegalTipoDocumento: string;
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
    setPaso(0);
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
    if (!descuentoValido) {
      toast.error("Revisa el descuento: porcentajes entre 0 y 100, máximo 2 decimales.");
      return;
    }
    if (!totalValido) {
      toast.error("El descuento no puede dejar el total en cero.");
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
        descuentoPorcentaje: aplicarDescuento && !esDescuentoPorStand && tipoDescuento === TIPOS_DESCUENTO.PORCENTAJE ? descuentoNumero : 0,
        descuentoMonto: aplicarDescuento && !esDescuentoPorStand && tipoDescuento === TIPOS_DESCUENTO.MONTO ? descuentoNumero : 0,
        ...(esDescuentoPorStand
          ? {
              descuentosPorStand: seleccionados.map((stand) => ({
                standId: stand.id,
                tipo: tipoDescuento,
                valor: Number(descuentosStand[stand.id] ?? "0") || 0,
              })),
            }
          : {}),
        cuotas,
      });
      setResultado(response);
      setModalOpen(false);
      toast.success("Reserva creada. Contrato generado; pendiente de firma.");
      setSelected(new Set());
      setDescuentoSeleccionados(new Set());
      setDescuentoMasivo("");
      setEmpresa(null);
      setAplicarDescuento(false);
      setModoDescuento(MODOS_DESCUENTO.GRUPAL);
      setDescuentoPorcentaje("0");
      setDescuentoMontoInput("0");
      setDescuentosStand({});
      setTipoDescuento(TIPOS_DESCUENTO.PORCENTAJE);
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
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_150px_150px_150px_auto]">
              <Skeleton className="h-8 w-full" />
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
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_150px_150px_150px_auto]">
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
                <Label className="text-[11px] text-muted-foreground"><span>Empresa / titulo</span></Label>
                <Select
                  value={empresaPreReservaActiva}
                  onValueChange={(value) => cambiarFiltro({ empresaPreReserva: value })}
                  disabled={empresasPreReserva.length === 0}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={empresasPreReserva.length === 0 ? "Sin pre-reservas" : "Todas las empresas"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UI_SENTINEL.TODOS}><span>Todas las empresas</span></SelectItem>
                    {empresasPreReserva.map((item) => (
                      <SelectItem key={item} value={item}><span>{item}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                        const etiquetaPreReserva = etiquetaPreReservaStand(stand);
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
                                <span className="mt-0.5 block max-w-[180px] truncate text-[10px] text-muted-foreground" title={etiquetaPreReserva ?? undefined}>
                                  {etiquetaPreReserva ?? "Sin empresa"}
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
                  <span>Neto lista: {formatearMonto(netoLista, monedaPago, { decimales: 2 })}</span>
                  {descuentoMonto > 0 && <span className="text-success">{etiquetaDescuento}: -{formatearMonto(descuentoMonto, monedaPago, { decimales: 2 })}</span>}
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
        <DialogContent className="flex h-[min(92vh,840px)] w-[min(1200px,96vw)] flex-col overflow-hidden sm:max-w-[1200px]">
          <DialogHeader className="shrink-0 text-left">
            <DialogTitle><span>Reserva administrativa</span></DialogTitle>
            <p className="text-xs text-muted-foreground">
              <span>Selecciona la empresa y el cronograma. El contrato se generará automáticamente; la solicitud quedará pendiente de firma.</span>
            </p>
          </DialogHeader>

          <div className="flex shrink-0 items-center gap-2 border-b border-border pb-3">
            {["Configuración", "Descuento", "Cuotas y plazos"].map((titulo, index) => (
              <div key={titulo} className="flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                  index === paso
                    ? "bg-primary text-primary-foreground"
                    : index < paso
                      ? "bg-success/15 text-success"
                      : "bg-muted text-muted-foreground"
                }`}>
                  {index + 1}
                </span>
                <span className={`text-xs ${index === paso ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {titulo}
                </span>
                {index < 2 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />}
              </div>
            ))}
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            {paso === 0 && (
              <>
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
              </>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
            <div className={`space-y-1 ${paso === 0 ? "" : "hidden"}`}>
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

            <div className={`space-y-1 ${paso === 0 ? "" : "hidden"}`}>
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
            <div className={`space-y-1 ${paso === 1 ? "sm:col-span-3" : "hidden"}`}>
              <div className="flex h-5 items-center gap-2">
                <Checkbox
                  id="reserva-aplicar-descuento"
                  checked={aplicarDescuento}
                  onCheckedChange={(value) => {
                    const activo = value === true;
                    setAplicarDescuento(activo);
                    if (!activo) {
                      setDescuentoPorcentaje("0");
                      setDescuentoMontoInput("0");
                    }
                  }}
                  disabled={guardando}
                />
                <Label htmlFor="reserva-aplicar-descuento">Aplicar descuento</Label>
              </div>
              {aplicarDescuento ? (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo de descuento</Label>
                    <RadioGroup
                      value={opcionDescuento}
                      onValueChange={cambiarOpcionDescuento}
                      disabled={guardando}
                      className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
                    >
                      {OPCIONES_DESCUENTO.map((opcion) => {
                        const value = `${opcion.modo}:${opcion.tipo}`;
                        const activa = opcionDescuento === value;
                        return (
                          <Label
                            key={opcion.key}
                            htmlFor={`descuento-opcion-${opcion.key}`}
                            className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition-colors ${
                              activa
                                ? "border-primary bg-primary/5"
                                : "border-border bg-background hover:bg-muted/40"
                            }`}
                          >
                            <RadioGroupItem
                              id={`descuento-opcion-${opcion.key}`}
                              value={value}
                              className="mt-0.5 shrink-0"
                            />
                            <span className="text-xs font-medium leading-snug text-foreground">
                              {descuentoLabels[opcion.key] ?? opcion.label}
                            </span>
                          </Label>
                        );
                      })}
                    </RadioGroup>
                    <p className="text-[11px] text-muted-foreground">
                      Elige cómo quieres descontar. Si cada stand tiene un descuento diferente, usa una opción por stand.
                    </p>
                  </div>
                  {modoDescuento === MODOS_DESCUENTO.GRUPAL ? (
                    <>
                      <Input
                        id="reserva-descuento"
                        aria-label={tipoDescuento === TIPOS_DESCUENTO.PORCENTAJE ? "Descuento (%)" : "Descuento (monto)"}
                        type="number"
                        min={tipoDescuento === TIPOS_DESCUENTO.PORCENTAJE ? DESCUENTO_PORCENTAJE_MIN : 0}
                        max={tipoDescuento === TIPOS_DESCUENTO.PORCENTAJE ? DESCUENTO_PORCENTAJE_MAX : undefined}
                        step={DESCUENTO_PORCENTAJE_PASO}
                        value={tipoDescuento === TIPOS_DESCUENTO.PORCENTAJE ? descuentoPorcentaje : descuentoMontoInput}
                        onChange={(event) => {
                          if (tipoDescuento === TIPOS_DESCUENTO.PORCENTAJE) setDescuentoPorcentaje(event.target.value);
                          else setDescuentoMontoInput(event.target.value);
                        }}
                        className="h-10 text-xs"
                        disabled={guardando}
                      />
                    </>
                  ) : (
                    <div className="space-y-3 rounded-xl border border-border bg-secondary/20 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Descuento por stand</p>
                          <p className="text-[11px] text-muted-foreground">
                            Elige porcentaje o monto fijo para cada stand. Marca varios stands para aplicar el mismo descuento en bloque. El descuento se aplica al precio neto antes de IGV.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.INFO}`}>
                            {seleccionados.length} stand(s)
                          </Badge>
                          <div className="flex items-center rounded-md border border-border bg-card p-0.5">
                            <Button
                              type="button"
                              size="sm"
                              variant={vistaDescuento === VISTAS_DESCUENTO.LISTA ? "secondary" : "ghost"}
                              className="h-7 gap-1 px-2 text-[10px]"
                              aria-pressed={vistaDescuento === VISTAS_DESCUENTO.LISTA}
                              onClick={() => setVistaDescuento(VISTAS_DESCUENTO.LISTA)}
                            >
                              <LayoutList className="h-3.5 w-3.5" />
                              <span>Lista</span>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={vistaDescuento === VISTAS_DESCUENTO.GRID ? "secondary" : "ghost"}
                              className="h-7 gap-1 px-2 text-[10px]"
                              aria-pressed={vistaDescuento === VISTAS_DESCUENTO.GRID}
                              onClick={() => setVistaDescuento(VISTAS_DESCUENTO.GRID)}
                            >
                              <LayoutGrid className="h-3.5 w-3.5" />
                              <span>Grid</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
                          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={busquedaDescuentoStand}
                            onChange={(event) => setBusquedaDescuentoStand(event.target.value)}
                            placeholder="Buscar por código o tipo de stand"
                            className="h-9 pl-8 text-xs"
                            disabled={guardando}
                          />
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {standsDescuentoFiltrados.length} de {seleccionados.length} stand(s)
                        </span>
                      </div>
                      <div className="overflow-hidden rounded-lg border border-border bg-card">
                        <div className="flex flex-col gap-2 border-b border-border bg-muted/30 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.INFO}`}>
                              {descuentoSeleccionadosActivos.size > 0 ? etiquetaDescuentoSeleccionados : "Sin selección"}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              Haz clic en una fila o tarjeta para marcarla.
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 self-start text-[11px] sm:self-auto"
                            onClick={() => seleccionarDescuentosFiltrados(!todosDescuentoFiltradosSeleccionados)}
                            disabled={guardando || standsDescuentoFiltrados.length === 0}
                          >
                            <span>{todosDescuentoFiltradosSeleccionados ? "Quitar filtrados" : "Seleccionar filtrados"}</span>
                          </Button>
                        </div>
                        <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-end">
                          <div className="space-y-1">
                            <Label htmlFor="reserva-descuento-masivo" className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Descuento en bloque
                            </Label>
                            <div className="flex items-center gap-1.5" data-no-toggle>
                              <Input
                                id="reserva-descuento-masivo"
                                type="number"
                                min={0}
                                max={tipoDescuento === TIPOS_DESCUENTO.PORCENTAJE ? DESCUENTO_PORCENTAJE_MAX : undefined}
                                step={DESCUENTO_PORCENTAJE_PASO}
                                value={descuentoMasivo}
                                onChange={(event) => setDescuentoMasivo(event.target.value)}
                                placeholder={tipoDescuento === TIPOS_DESCUENTO.PORCENTAJE ? "10" : "500"}
                                className="h-9 w-28 text-right text-xs"
                                disabled={guardando}
                              />
                              <span className="w-8 text-[10px] font-medium text-muted-foreground">
                                {tipoDescuento === TIPOS_DESCUENTO.PORCENTAJE ? "%" : monedaPago}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-1 flex-wrap items-center gap-1.5 sm:justify-end">
                            {descuentoSeleccionadosActivos.size > 0 ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-9 text-xs"
                                  onClick={() => aplicarDescuentoMasivo("seleccionados")}
                                  disabled={guardando || descuentoMasivo.trim() === ""}
                                >
                                  <span>Aplicar a {etiquetaDescuentoSeleccionados}</span>
                                </Button>
                                {standsDescuentoFiltrados.length > 0 && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-9 text-xs"
                                    onClick={() => aplicarDescuentoMasivo("filtrados")}
                                    disabled={guardando || descuentoMasivo.trim() === ""}
                                  >
                                    <span>Aplicar a {etiquetaDescuentoFiltrados}</span>
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-9 text-xs"
                                  onClick={quitarDescuentoMasivo}
                                  disabled={guardando}
                                >
                                  <span>Quitar descuento</span>
                                </Button>
                              </>
                            ) : standsDescuentoFiltrados.length > 0 ? (
                              <Button
                                type="button"
                                size="sm"
                                className="h-9 text-xs"
                                onClick={() => aplicarDescuentoMasivo("filtrados")}
                                disabled={guardando || descuentoMasivo.trim() === ""}
                              >
                                <span>Aplicar a {etiquetaDescuentoFiltrados}</span>
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">No hay stands filtrados.</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {vistaDescuento === VISTAS_DESCUENTO.LISTA ? (
                        <div className="overflow-hidden rounded-lg border border-border bg-card">
                          <div className="hidden grid-cols-[24px_minmax(0,1fr)_130px_180px_150px] gap-3 border-b border-border bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
                            <div className="flex items-center">
                              <Checkbox
                                checked={estadoSeleccionDescuentoFiltrados}
                                onCheckedChange={(value) => seleccionarDescuentosFiltrados(value === true)}
                                disabled={guardando || standsDescuentoFiltrados.length === 0}
                                aria-label="Seleccionar todos los stands filtrados"
                              />
                            </div>
                            <span>Stand</span>
                            <span>Precio neto</span>
                            <span>Descuento</span>
                            <span>Neto con descuento</span>
                          </div>
                          <div className="max-h-[min(42vh,380px)] overflow-y-auto">
                            {standsDescuentoFiltrados.map((stand) => {
                              const detalle = detalleDescuentoPorStand.get(stand.id);
                              if (!detalle) return null;
                              return (
                                <div
                                  key={stand.id}
                                  className="grid cursor-pointer gap-2 border-b border-border/60 px-3 py-2.5 last:border-0 sm:grid-cols-[24px_minmax(0,1fr)_130px_180px_150px] sm:items-center sm:gap-3"
                                  onClick={(event) => alternarDescuentoDesdeFila(event, stand.id)}
                                >
                                  <div className="flex items-center">
                                    <Checkbox
                                      checked={descuentoSeleccionadosActivos.has(stand.id)}
                                      onCheckedChange={(value) => toggleDescuentoStand(stand.id, value === true)}
                                      disabled={guardando}
                                      aria-label={`Seleccionar ${stand.standCode} para descuento masivo`}
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-mono text-xs font-semibold text-foreground">{stand.standCode}</p>
                                    <p className="truncate text-[10px] text-muted-foreground">
                                      {normalizarTipoStand(stand.tipoStand) ?? "Stand"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:hidden">Precio neto</p>
                                    <p className="text-xs text-foreground">{formatearMonto(detalle.precio, monedaPago, { decimales: 2 })}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground sm:hidden">Descuento</Label>
                                    <div className="flex items-center gap-1.5" data-no-toggle>
                                      <Input
                                        type="number"
                                        min={0}
                                        max={tipoDescuento === TIPOS_DESCUENTO.PORCENTAJE ? DESCUENTO_PORCENTAJE_MAX : undefined}
                                        step={DESCUENTO_PORCENTAJE_PASO}
                                        value={detalle.valor}
                                        onChange={(event) => setDescuentosStand((prev) => ({ ...prev, [stand.id]: event.target.value }))}
                                        className="h-9 w-28 text-right text-xs"
                                        disabled={guardando}
                                        placeholder="0.00"
                                        aria-label={`Descuento para ${stand.standCode}`}
                                      />
                                      <span className="w-8 text-[10px] font-medium text-muted-foreground">
                                        {tipoDescuento === TIPOS_DESCUENTO.PORCENTAJE ? "%" : monedaPago}
                                      </span>
                                    </div>
                                    {!detalle.valido && (
                                      <p className="text-[10px] text-destructive">
                                        {tipoDescuento === TIPOS_DESCUENTO.MONTO
                                          ? "No puede superar el precio neto."
                                          : "Entre 0% y 100%."}
                                      </p>
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:hidden">Neto</p>
                                    <p className="text-xs font-semibold text-foreground">{formatearMonto(detalle.neto, monedaPago, { decimales: 2 })}</p>
                                    {detalle.descuento > 0 && (
                                      <p className="text-[10px] text-success">- {formatearMonto(detalle.descuento, monedaPago, { decimales: 2 })}</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            {standsDescuentoFiltrados.length === 0 && (
                              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                                No hay stands que coincidan con la búsqueda.
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="max-h-[min(42vh,380px)] overflow-y-auto rounded-lg border border-border bg-card p-2">
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {standsDescuentoFiltrados.map((stand) => {
                              const detalle = detalleDescuentoPorStand.get(stand.id);
                              if (!detalle) return null;
                              const seleccionado = descuentoSeleccionadosActivos.has(stand.id);
                              return (
                                <div
                                  key={stand.id}
                                  className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                                    seleccionado ? "border-primary/50 bg-primary/5" : "border-border bg-card"
                                  }`}
                                  onClick={(event) => alternarDescuentoDesdeFila(event, stand.id)}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex min-w-0 items-start gap-2">
                                      <Checkbox
                                        checked={seleccionado}
                                        onCheckedChange={(value) => toggleDescuentoStand(stand.id, value === true)}
                                        disabled={guardando}
                                        className="mt-0.5"
                                        aria-label={`Seleccionar ${stand.standCode} para descuento masivo`}
                                      />
                                      <div className="min-w-0">
                                        <p className="truncate font-mono text-xs font-semibold text-foreground">{stand.standCode}</p>
                                        <p className="truncate text-[10px] text-muted-foreground">{normalizarTipoStand(stand.tipoStand) ?? "Stand"}</p>
                                      </div>
                                    </div>
                                    <span className="shrink-0 text-right">
                                      <span className="block text-[9px] uppercase tracking-wide text-muted-foreground">Precio neto</span>
                                      <span className="block text-xs text-foreground">{formatearMonto(detalle.precio, monedaPago, { decimales: 2 })}</span>
                                    </span>
                                  </div>
                                  <div className="mt-3 space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Descuento</Label>
                                    <div className="flex items-center gap-1.5" data-no-toggle>
                                      <Input
                                        type="number"
                                        min={0}
                                        max={tipoDescuento === TIPOS_DESCUENTO.PORCENTAJE ? DESCUENTO_PORCENTAJE_MAX : undefined}
                                        step={DESCUENTO_PORCENTAJE_PASO}
                                        value={detalle.valor}
                                        onChange={(event) => setDescuentosStand((prev) => ({ ...prev, [stand.id]: event.target.value }))}
                                        className="h-9 w-full text-right text-xs"
                                        disabled={guardando}
                                        placeholder="0.00"
                                        aria-label={`Descuento para ${stand.standCode}`}
                                      />
                                      <span className="w-8 text-[10px] font-medium text-muted-foreground">
                                        {tipoDescuento === TIPOS_DESCUENTO.PORCENTAJE ? "%" : monedaPago}
                                      </span>
                                    </div>
                                    {!detalle.valido && (
                                      <p className="text-[10px] text-destructive">
                                        {tipoDescuento === TIPOS_DESCUENTO.MONTO
                                          ? "No puede superar el precio neto."
                                          : "Entre 0% y 100%."}
                                      </p>
                                    )}
                                  </div>
                                  <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2">
                                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Neto</span>
                                    <span className="text-xs font-semibold text-foreground">{formatearMonto(detalle.neto, monedaPago, { decimales: 2 })}</span>
                                  </div>
                                  {detalle.descuento > 0 && (
                                    <p className="text-right text-[10px] text-success">- {formatearMonto(detalle.descuento, monedaPago, { decimales: 2 })}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {standsDescuentoFiltrados.length === 0 && (
                            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                              No hay stands que coincidan con la búsqueda.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
              <p className={`text-[11px] ${aplicarDescuento && !descuentoValido ? "text-destructive" : "text-muted-foreground"}`}>
                {aplicarDescuento
                  ? descuentoValido
                    ? modoDescuento === MODOS_DESCUENTO.POR_STAND
                      ? "El descuento se aplica al neto de cada stand antes de IGV."
                      : "Se aplica al neto antes de IGV y afecta todas las cuotas."
                    : modoDescuento === MODOS_DESCUENTO.POR_STAND
                      ? tipoDescuento === TIPOS_DESCUENTO.MONTO
                        ? "Revisa los montos por stand: no pueden superar el precio de cada stand y deben tener máximo 2 decimales."
                        : "Revisa los porcentajes por stand: entre 0 y 100 y máximo 2 decimales."
                      : tipoDescuento === TIPOS_DESCUENTO.MONTO
                        ? "El monto debe ser mayor a 0, tener maximo 2 decimales y no superar el neto."
                        : "El porcentaje debe estar entre 0 y 100 y tener maximo 2 decimales."
                  : "Activa el descuento para elegir descuento general o por stand."}
              </p>
            </div>
            </div>

            {paso === 2 && (
              <>
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
                <span className="text-muted-foreground">Neto lista</span>
                <span>{formatearMonto(netoLista, monedaPago, { decimales: 2 })}</span>
              </div>
              {descuentoMonto > 0 && (
                <div className="mt-1 flex items-center justify-between text-success">
                  <span>{etiquetaDescuento}</span>
                  <span>-{formatearMonto(descuentoMonto, monedaPago, { decimales: 2 })}</span>
                </div>
              )}
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted-foreground">Neto con descuento</span>
                <span>{formatearMonto(neto, monedaPago, { decimales: 2 })}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted-foreground">IGV</span>
                <span>{formatearMonto(igv, monedaPago, { decimales: 2 })}</span>
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
              </>
            )}
          </div>

          <DialogFooter className="shrink-0 gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalOpen(false)}
              disabled={guardando}
            >
              <span>Cancelar</span>
            </Button>
            {paso > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setPaso((actual) => Math.max(0, actual - 1))}
                disabled={guardando}
              >
                <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                <span>Atrás</span>
              </Button>
            )}
            {paso < 2 ? (
              <Button
                type="button"
                onClick={() => setPaso((actual) => Math.min(2, actual + 1))}
                disabled={guardando || !puedeAvanzar}
              >
                <span>Siguiente</span>
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => setConfirmarOpen(true)}
                disabled={
                  guardando ||
                  !paso1Valido ||
                  !paso2Valido ||
                  !paso3Valido
                }
              >
                <span>Revisar y crear reserva</span>
              </Button>
            )}
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
            tipoDocumento: empresaDetalle.representanteLegalTipoDocumento ?? TIPOS_DOCUMENTO_PERSONA.DNI,
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
                {seleccionados.map((stand) => {
                  const detalle = esDescuentoPorStand ? detalleDescuentoPorStand.get(stand.id) : null;
                  const precio = convertirNeto(resolverPrecioStand(stand), monedaPago, tipoCambio);
                  return (
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
                      <span className="text-right">
                        <span className="block text-foreground">Base {formatearMonto(precio, monedaPago, { decimales: 2 })}</span>
                        {detalle && (
                          <>
                            <span className="block text-success">
                              Descuento {detalle.valor}{tipoDescuento === TIPOS_DESCUENTO.PORCENTAJE ? "%" : ` ${monedaPago}`}: -{formatearMonto(detalle.descuento, monedaPago, { decimales: 2 })}
                            </span>
                            <span className="block font-semibold text-foreground">Neto {formatearMonto(detalle.neto, monedaPago, { decimales: 2 })}</span>
                          </>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {seleccionados.some((stand) => stand.estado === ESTADOS_STAND.PRE_RESERVADO) && (
              <p className="rounded-md border border-info/30 bg-info/10 px-2 py-1.5 text-[11px] text-info">
                Los stands pre-reservados se liberarán de la pre-reserva al generar la solicitud y el contrato.
              </p>
            )}

            <div className="space-y-1 rounded-md bg-secondary/40 p-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Neto lista</span>
                <span className="text-foreground">{formatearMonto(netoLista, monedaPago, { decimales: 2 })}</span>
              </div>
              {descuentoMonto > 0 && (
                <div className="flex items-center justify-between text-success">
                  <span>{etiquetaDescuento}</span>
                  <span>-{formatearMonto(descuentoMonto, monedaPago, { decimales: 2 })}</span>
                </div>
              )}
              {esDescuentoPorStand && descuentoMonto > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Descuento {tipoDescuento === TIPOS_DESCUENTO.PORCENTAJE ? "porcentual" : `de monto fijo (${monedaPago})`} aplicado de forma individual a cada stand.
                </p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Neto con descuento</span>
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
                    {cuota.porcentaje}% · {dateUtils.format(cuota.fechaVencimiento)} · {formatearMonto(cuotasCalculadas[index]?.monto ?? 0, monedaPago, { decimales: 2 })}
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
