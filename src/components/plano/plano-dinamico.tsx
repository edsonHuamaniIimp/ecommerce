"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle, Sheet, SheetContent, SheetHeader, SheetTitle } from "@nrivera-iimp/ui-kit-iimp";
import { FileText, Eye, X, Image, ScrollText, Upload, ClipboardCheck, Bell, Check, Layers, Loader2, Trash2, ShoppingBag, ChevronLeft, ChevronRight, MousePointerClick, ArrowUpRight, ZoomIn, ZoomOut, RotateCcw, RotateCw, Home, Compass, Hand, HelpCircle } from "lucide-react";
import { gessService } from "@/lib/client/api/services/gess-service";
import { perfilService } from "@/lib/client/api/services/perfil-service";
import { errorReporting } from "@/lib/client/utils/error-reporting";
import { loadPlanoDefinition } from "@/lib/shared/planos/registry";
import type { PlanoDefinition, PlanoItem } from "@/lib/shared/planos/registry";
import { LS_KEYS, BADGE_STYLES, CONTRATO_SIEMPRE_AL_FINAL, ESTADOS_STAND, ESTADOS_STAND_LEGACY, ERROR_LOG_PASOS_RESERVA, CATEGORIAS_IMAGEN, CATEGORIA_IMAGEN_LABELS, CATEGORIA_IMAGEN_ORDER, IGV_PORCENTAJE, normalizarCategoriasImagen, type CategoriaImagen } from "@/lib/shared/constants";
import { estadoStandBadge } from "@/lib/shared/utils/estado-stand";
import { codigoComercialStand } from "@/lib/shared/utils/stand-codigo";
import { precioTexto, resolverPrecioStand } from "@/lib/shared/utils/precio-stand";
import { calcularImportes } from "@/lib/shared/utils/importes";
import { areaDesdeTipoStand } from "@/lib/shared/utils/tipo-stand";
import { leyendaPlano } from "@/lib/shared/utils/leyenda-plano";
import { stringUtils } from "@/lib/shared/utils/string";
import { idiomaODefecto } from "@/lib/shared/utils/idioma";
import { leerIdiomaCookie } from "@/lib/client/utils/idioma";
import { textosReserva } from "@/lib/shared/textos/reserva";
import type { ReservaStep } from "@/lib/shared/constants";
import { usePlanoCarrito, totalCarrito, urlPabellon, type CarritoStandInfo } from "@/lib/client/stores/plano-carrito-store";
import { useReservaForm } from "./reserva/use-reserva-form";
import { ReservaModal } from "./reserva/reserva-modal";
import { useSesion } from "@/hooks/use-sesion";
import { useStandEvents } from "@/hooks/use-stand-events";
import { sincronizarEventoPublicoEnSesion } from "@/lib/client/sesion-evento";
import type { FormDatos } from "./reserva/interfaces";
import { toast } from "sonner";
import * as THREE from "three";

/* ================================================================
   PLANO ISOMÉTRICO — GESS edition.
   Construcción del layout en src/lib/planos/gess/construccion.ts
   ================================================================ */

import { Bloque3D, Floor, FurnitureRenderer } from "./plano-3d-componentes";

/* ---------- Escena ---------- */
interface GessLinked {
  standCode: string;
  tipoStand: string | null;
  /** Pabellon del evento al que pertenece el stand (viene del vinculo/importacion). */
  pabellon: string | null;
  /** Area comercial del stand en m² (API liststand o inferida del tipo). */
  area: string | null;
  empresa: string | null;
  empresaLogo: string | null;
  /** Precio neto (USD) resuelto del stand, para el paso de cuotas. */
  precio: number;
  /** Imagen referencial del tipo de stand (RF-08); aplica a todos los stands del tipo. */
  tipoImagen: string | null;
  estado: string | null;
  medidas: string | null;
  documentos: string[];
  imagenes: string[];
  imagenesCategorias: Record<string, string>;
}

interface GessInfoFull extends GessLinked {
  reserved: boolean;
  dbId: string;
}

/** Agrupa imagenes por categoria respetando el orden canonico. */
function agruparImagenes(imagenes: string[], categorias: Record<string, string>): { categoria: CategoriaImagen; urls: string[] }[] {
  return CATEGORIA_IMAGEN_ORDER.map((categoria) => ({
    categoria,
    urls: imagenes.filter((url) => (categorias[url] ?? CATEGORIAS_IMAGEN.OTRO) === categoria),
  })).filter((grupo) => grupo.urls.length > 0);
}

function getIdApi(row: Record<string, unknown>): string {
  return String(row.uid ?? row.UID ?? row.codigo ?? row.stand ?? row.STANDID ?? row.standId ?? row.stand_id ?? row.STAND ?? row.standCode ?? "");
}

/** API imperativa de la vista 3D para los botones de navegacion y el enfoque de bloques. */
interface VistaApi {
  /** Centra y acerca la vista a un bloque con vista elevada (arriba + costado),
   *  encuadrando tambien el globo del numero comercial. */
  enfocar: (x: number, z: number, tamano: number, altura: number) => void;
  /** Gira la camara alrededor del centro actual (grados; positivo = izquierda). */
  girar: (grados: number) => void;
  /** Acerca/aleja manteniendo el centro (factor < 1 acerca). */
  zoom: (factor: number) => void;
  /** Recentra el pivote de giro en el centro del plano (conserva la orientacion). */
  centrar: () => void;
  /** Vuelve a la vista inicial del plano. */
  reiniciar: () => void;
}

const suavizarMovimiento = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Boton de navegacion compacto: el titulo aparece como tooltip a la izquierda en hover. */
function BotonNav({ label, activo, onClick, children }: { label: string; activo?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <div className="group relative">
      <Button
        variant={activo ? "secondary" : "ghost"}
        size="icon"
        className={`h-8 w-8 ${activo ? "bg-primary/10 text-primary" : ""}`}
        aria-label={label}
        aria-pressed={activo}
        onClick={onClick}
      >
        {children}
      </Button>
      <span className="pointer-events-none absolute right-full top-1/2 z-20 mr-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        {label}
      </span>
    </div>
  );
}

/**
 * Anima la camara y el target de OrbitControls con transiciones suaves.
 * La navegacion "de mapa" (arrastrar = mover) y los botones pasan por aqui.
 */
function CameraRig({ registrar, cx, cz, S }: { registrar: (api: VistaApi) => void; cx: number; cz: number; S: number }) {
  const { camera, controls } = useThree();
  const anim = useRef<{ t: number; dur: number; pos0: THREE.Vector3; pos1: THREE.Vector3; obj0: THREE.Vector3; obj1: THREE.Vector3 } | null>(null);
  const inicial = useMemo(
    () => ({ pos: new THREE.Vector3(cx, S * 0.7, cz + S * 0.35), obj: new THREE.Vector3(cx, 0, cz) }),
    [cx, cz, S],
  );
  const minDistancia = S * 0.15;
  const maxDistancia = S * 1.6;

  useEffect(() => {
    const ctrl = controls as unknown as { target?: THREE.Vector3; addEventListener?: (tipo: string, fn: () => void) => void; removeEventListener?: (tipo: string, fn: () => void) => void } | null;
    const centroActual = () => (ctrl?.target ?? inicial.obj).clone();
    const activar = (pos1: THREE.Vector3, obj1: THREE.Vector3, dur = 0.7) => {
      anim.current = { t: 0, dur, pos0: camera.position.clone(), pos1, obj0: centroActual(), obj1 };
    };

    const api: VistaApi = {
      enfocar: (x, z, tamano, altura) => {
        /* Apunta al cuerpo alto del bloque (no al piso) y aleja lo suficiente para que
           entren el bloque completo y el globo del numero comercial de arriba. */
        const obj1 = new THREE.Vector3(x, altura * 0.7, z);
        const destino = Math.min(Math.max(tamano * 3, altura * 2.5, 10), maxDistancia);
        /* Vista siempre elevada (arriba + costado, ~58 grados): evita que otros bloques
           tapen el seleccionado y deja ver el globo del numero comercial. Conserva el
           angulo de giro actual para no desorientar. */
        const offset = camera.position.clone().sub(centroActual());
        const azimut = (Number.isFinite(offset.x) && offset.lengthSq() > 1e-6) ? Math.atan2(offset.x, offset.z) : 0.5;
        const elevacion = (58 * Math.PI) / 180;
        const dir = new THREE.Vector3(
          Math.sin(azimut) * Math.cos(elevacion),
          Math.sin(elevacion),
          Math.cos(azimut) * Math.cos(elevacion),
        );
        const dist = Math.max(destino, minDistancia * 1.05);
        activar(obj1.clone().add(dir.multiplyScalar(dist)), obj1);
      },
      girar: (grados) => {
        const centro = centroActual();
        const offset = camera.position.clone().sub(centro).applyAxisAngle(new THREE.Vector3(0, 1, 0), (grados * Math.PI) / 180);
        activar(centro.clone().add(offset), centro);
      },
      zoom: (factor) => {
        const centro = centroActual();
        const offset = camera.position.clone().sub(centro);
        const dist = Math.min(Math.max(offset.length() * factor, minDistancia), maxDistancia);
        activar(centro.clone().add(offset.normalize().multiplyScalar(dist)), centro);
      },
      centrar: () => {
        const centro = new THREE.Vector3(cx, 0, cz);
        const dir = camera.position.clone().sub(centroActual());
        if (!Number.isFinite(dir.x) || dir.lengthSq() < 1e-6) dir.set(0, 0.7, 0.35);
        dir.normalize();
        const dist = Math.min(Math.max(camera.position.distanceTo(centroActual()), S * 0.6, minDistancia * 1.05), maxDistancia);
        activar(centro.clone().add(dir.multiplyScalar(dist)), centro);
      },
      reiniciar: () => activar(inicial.pos.clone(), inicial.obj.clone(), 0.85),
    };
    registrar(api);

    /* Si el usuario empieza a arrastrar, la animacion se cancela y no pelea con el gesto. */
    const cancelar = () => { anim.current = null; };
    ctrl?.addEventListener?.("start", cancelar);
    return () => { ctrl?.removeEventListener?.("start", cancelar); };
  }, [camera, controls, cx, cz, S, inicial, minDistancia, maxDistancia, registrar]);

  useFrame((_, delta) => {
    const a = anim.current;
    if (!a) return;
    a.t = Math.min(1, a.t + delta / a.dur);
    const k = suavizarMovimiento(a.t);
    camera.position.lerpVectors(a.pos0, a.pos1, k);
    const ctrl = controls as unknown as { target?: THREE.Vector3 } | null;
    if (ctrl?.target) ctrl.target.lerpVectors(a.obj0, a.obj1, k);
    if (a.t >= 1) anim.current = null;
  });

  return null;
}

export function PlanoDinamico({ eventoId, tipoEvento, codigoEvento, planoId = "gess", openReserva, parentCodigo = null, bloqueInicial = null, nombrePlano = null }: { eventoId: string; tipoEvento: number; codigoEvento: number; planoId?: string; openReserva?: boolean; parentCodigo?: string | null; bloqueInicial?: string | null; nombrePlano?: string | null }) {
  const router = useRouter();
  const [plano, setPlano] = useState<PlanoDefinition | null>(null);
  const [planoLoading, setPlanoLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setPlanoLoading(true);
      const def = await loadPlanoDefinition(planoId);
      if (!cancelled) {
        setPlano(def ?? null);
        setPlanoLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [planoId]);

  const items=useMemo(()=>plano?.buildItems() ?? [],[plano]);
  const bnd=useMemo(()=>plano?plano.computeBounds(items):{minX:-20,maxX:20,minZ:-20,maxZ:20},[items, plano]);
  const furniture=useMemo(()=>plano?.buildFurniture() ?? [],[plano]);
  const seleccionesCarrito = usePlanoCarrito((s) => s.selecciones);
  const itemsCarrito = usePlanoCarrito((s) => s.items);
  const toggleCarrito = usePlanoCarrito((s) => s.toggle);
  const seleccionarSolo = usePlanoCarrito((s) => s.seleccionarSolo);
  const quitarCarrito = usePlanoCarrito((s) => s.quitar);
  const limpiarPlanoCarrito = usePlanoCarrito((s) => s.limpiarPlano);
  const idsPlano = useMemo(() => seleccionesCarrito[planoId] ?? [], [seleccionesCarrito, planoId]);
  const idsGlobales = useMemo(() => Object.values(seleccionesCarrito).flat(), [seleccionesCarrito]);
  const entradasCarrito = useMemo(() => Object.values(itemsCarrito), [itemsCarrito]);
  const parentsCarrito = usePlanoCarrito((s) => s.parents);
  const macroCodigo = usePlanoCarrito((s) => s.macroCodigo);

  // Registra el parent de este plano para navegar desde el carrito.
  useEffect(() => {
    usePlanoCarrito.getState().registrarPlano(planoId, parentCodigo ?? null);
  }, [planoId, parentCodigo]);
  const [linkedMap, setLinkedMap] = useState<Map<string, GessInfoFull>>(new Map());
  const [standsRefreshKey, setStandsRefreshKey] = useState(0);
  const [holdReserva, setHoldReserva] = useState<{ holdId: string; expiresAt: string } | null>(null);
  /** Ref sincrona para ignorar el evento Pusher de nuestro propio hold. */
  const holdReservaRef = useRef<{ holdId: string; expiresAt: string } | null>(null);
  /** Stands del hold que esta en vuelo: su evento puede llegar antes que la respuesta HTTP. */
  const holdSolicitudRef = useRef<string[] | null>(null);

  useStandEvents(eventoId, {
    onReserved: (event) => {
      setLinkedMap((prev) => {
        let cambio = false;
        const next = new Map(prev);
        for (const [bloqueId, info] of next) {
          if (event.standIds.includes(info.dbId) || event.standCodes.includes(info.standCode)) {
            next.set(bloqueId, { ...info, estado: ESTADOS_STAND.RESERVADO, reserved: true });
            cambio = true;
          }
        }
        return cambio ? next : prev;
      });
    },
    onHeld: (event) => {
      const esPropio = event.holdId === holdReservaRef.current?.holdId;
      const enSolicitud = holdSolicitudRef.current?.some((id) => event.standIds.includes(id)) ?? false;
      if (esPropio || enSolicitud) return;
      setLinkedMap((prev) => {
        let cambio = false;
        const next = new Map(prev);
        for (const [bloqueId, info] of next) {
          if (event.standIds.includes(info.dbId) || event.standCodes.includes(info.standCode)) {
            next.set(bloqueId, { ...info, estado: ESTADOS_STAND.EN_PROCESO, reserved: true });
            cambio = true;
          }
        }
        return cambio ? next : prev;
      });
    },
    onReleased: (event) => {
      setLinkedMap((prev) => {
        let cambio = false;
        const next = new Map(prev);
        for (const [bloqueId, info] of next) {
          if (info.estado === ESTADOS_STAND.EN_PROCESO && (event.standIds.includes(info.dbId) || event.standCodes.includes(info.standCode))) {
            next.set(bloqueId, { ...info, estado: ESTADOS_STAND.DISPONIBLE, reserved: false });
            cambio = true;
          }
        }
        return cambio ? next : prev;
      });
    },
    onPreReservaChanged: () => {
      setStandsRefreshKey((key) => key + 1);
    },
  });

  const [imgCarousel, setImgCarousel] = useState<{ images: string[]; idx: number; standCode: string; filtro: string; grupos: { categoria: CategoriaImagen; urls: string[] }[]; todas: string[] } | null>(null);
  const [dataReady, setDataReady] = useState(false);
  const [detailModal, setDetailModal] = useState<GessInfoFull | null>(null);
  const [imgFiltro, setImgFiltro] = useState<string>("todas");

  /** Abre el carrusel de imagenes del stand con navegacion por categoria. */
  const abrirCarrusel = (filtro: string, idx = 0) => {
    if (!detailModal) return;
    const grupos = agruparImagenes(detailModal.imagenes, detailModal.imagenesCategorias);
    const images = filtro === "todas" ? detailModal.imagenes : (grupos.find((g) => g.categoria === filtro)?.urls ?? detailModal.imagenes);
    setImgCarousel({ images, idx: Math.max(0, Math.min(idx, images.length - 1)), standCode: detailModal.standCode, filtro, grupos, todas: detailModal.imagenes });
  };

  const cambiarFiltroCarrusel = (filtro: string) => {
    setImgCarousel((prev) => {
      if (!prev) return prev;
      const images = filtro === "todas" ? prev.todas : (prev.grupos.find((g) => g.categoria === filtro)?.urls ?? prev.todas);
      return { ...prev, filtro, images, idx: 0 };
    });
  };
  const [legendOpen, setLegendOpen] = useState(false);
  const [standDocs, setStandDocs] = useState<string[]>([]);
  const [postSubmitOpen, setPostSubmitOpen] = useState(false);
  /* Textos del flujo que viven en portales (toast/modal); Google Translate no los cubre. */
  const textos = textosReserva(idiomaODefecto(leerIdiomaCookie()));
  const [panelMovil, setPanelMovil] = useState(false);
  /** Tooltip del hover sobre un stand reservado: posicion del cursor + razon social (RF-09). */
  const [hoverStand, setHoverStand] = useState<{ x: number; y: number; text: string } | null>(null);
  /** API de navegacion del visor (botones + enfoque de bloques). */
  const vistaApiRef = useRef<VistaApi | null>(null);
  /** Por defecto rige la navegacion original: arrastrar gira la vista alrededor del centro del plano. */
  const [modoOriginal, setModoOriginal] = useState(true);
  /** Los iconos de ayuda se muestran solo cuando el usuario habilita la navegacion manual. */
  const [panelAyuda, setPanelAyuda] = useState(false);
  const cx=(bnd.minX+bnd.maxX)/2,cz=(bnd.minZ+bnd.maxZ)/2,S=Math.max(bnd.maxX-bnd.minX,bnd.maxZ-bnd.minZ);

  const blockLabel = (type: PlanoItem["type"]) => plano?.blockLabel[type] ?? { label: "?", nombre: "?" };
  const leyenda = leyendaPlano(items, blockLabel);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [dbList, apiList] = await Promise.all([
          gessService.all(eventoId),
          gessService.fetchFromApi(tipoEvento, codigoEvento).catch((error: unknown) => {
            errorReporting.mapa(ERROR_LOG_PASOS_RESERVA.MAPA_API, error, { eventoId });
            return [] as Record<string, unknown>[];
          }),
        ]);

        if (cancelled) return;

        if (dbList.length === 0 && apiList.length > 0) {
          await gessService.sync({ eventoId, tipoEvento, codigoEvento });
          const fresh = await gessService.all(eventoId);
          dbList.splice(0, dbList.length, ...fresh);
        }

        // Index API rows by their ID (same logic as sync route: uid > UID > codigo > stand)
        const apiById = new Map<string, Record<string, unknown>>();
        for (const row of apiList) {
          const id = String((row as Record<string, unknown>).uid ?? (row as Record<string, unknown>).UID ?? (row as Record<string, unknown>).codigo ?? (row as Record<string, unknown>).stand ?? "");
          if (id) apiById.set(id, row as Record<string, unknown>);
        }

        const map = new Map<string, GessInfoFull>();
        for (const row of dbList) {
          const r: Record<string, unknown> = { ...row };
          const bloqueId = r.bloqueId ?? r.bloque_id ?? null;
          if (!bloqueId) continue;

          const standApiId = String(r.standApiId ?? r.stand_api_id ?? "");
          const apiRow = apiById.get(standApiId);

const tipoStand = (apiRow ? (apiRow.type ?? apiRow.tipo ?? apiRow.tipo_stand) : (r.tipoStand ?? r.tipo_stand ?? null)) as string | null;
// DB tiene prioridad sobre API para estado (refleja cambios locales como en_evaluacion)
const estadoDb = (r.estado ?? null) as string | null;
const estadoApi = apiRow ? (apiRow.status ?? apiRow.estado) as string | null : null;
const estado = estadoDb ?? estadoApi;
// La empresa vive en la BD (RF-09 completa reservas del portal); la API externa no la trae.
const empresa = ((r.empresa ?? null) as string | null) || (apiRow ? ((apiRow.company ?? apiRow.empresa ?? apiRow.razon_social ?? null) as string | null) : null);
const pabellon = (r.pabellon ?? null) as string | null;
const areaApi = apiRow ? String(apiRow.area ?? "").trim() : "";
const area = areaApi ? `${areaApi} m²` : areaDesdeTipoStand(tipoStand);
          /* Precio mostrado como `medidas` (compatibilidad del plano): catalogo por tipo + fallback de la fila. */
          const precio = resolverPrecioStand({
            medidas: (r.medidas ?? null) as string | null,
            tipoStand,
            rawData: r.rawData,
          });
          const medidas = precioTexto(precio);

map.set(String(bloqueId), {
  standCode: String(apiRow ? getIdApi(apiRow) : (r.standCode ?? r.stand_code ?? "")),
  tipoStand,
  pabellon,
  area,
  empresa,
            empresaLogo: (r.empresaLogo ?? null) as string | null,
            precio,
            tipoImagen: (r.tipoImagen ?? null) as string | null,
            estado,
            medidas,
            documentos: (Array.isArray(r.documentos) ? r.documentos : []) as string[],
            imagenes: (Array.isArray(r.imagenes) ? r.imagenes : []) as string[],
            imagenesCategorias: normalizarCategoriasImagen(r.imagenesCategorias),
            reserved: (estado ?? "") === ESTADOS_STAND_LEGACY.RESERVADO || (estado ?? "") === ESTADOS_STAND_LEGACY.EN_EVALUACION || estado === ESTADOS_STAND.EN_EVALUACION || estado === ESTADOS_STAND.PRE_RESERVADO,
            dbId: String(r.id ?? ""),
          });
        }
        setLinkedMap(map);
        if (!cancelled) setDataReady(true);
      } catch (error) {
        errorReporting.mapa(ERROR_LOG_PASOS_RESERVA.MAPA_CARGA, error, { eventoId });
        if (!cancelled) setDataReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [eventoId, tipoEvento, codigoEvento, standsRefreshKey]);

  const carritoInfoDe = useCallback((bloqueId: string): CarritoStandInfo => {
    const info = linkedMap.get(bloqueId);
    const item = items.find((it) => it.id === bloqueId);
    return {
      bloqueId,
      standCode: info?.standCode ?? "",
      pabellonCodigo: planoId,
      tipoLabel: item ? (plano?.blockLabel[item.type]?.label ?? null) : null,
      precio: info?.precio ?? null,
    };
  }, [linkedMap, items, plano, planoId]);

  // Valida la seleccion persistida del plano contra los stands cargados
  // (descarta ids que desaparecieron o quedaron reservados).
  useEffect(() => {
    if (!dataReady) return;
    /*
     * Mientras el usuario tiene un hold activo, el mapa puede reflejar su propio
     * stand como no disponible. No purgar la seleccion en ese caso: el wizard
     * conserva los stands que el usuario esta reservando.
     */
    if (holdReserva || holdReservaRef.current || holdSolicitudRef.current) return;
    const { selecciones, sincronizarPlano } = usePlanoCarrito.getState();
    const ids = selecciones[planoId] ?? [];
    if (ids.length === 0) return;
    const validos: CarritoStandInfo[] = [];
    for (const id of ids) {
      const info = linkedMap.get(id);
      if (!info || info.reserved) continue;
      validos.push(carritoInfoDe(id));
    }
    sincronizarPlano(planoId, validos);
  }, [dataReady, planoId, linkedMap, carritoInfoDe, holdReserva]);

  /*
   * RF-08: preseleccion desde `/mapa?bloque=...` (link de la bandeja). Abre el detalle
   * del stand y, si esta disponible, lo selecciona. Una sola vez por montaje.
   */
  const bloqueInicialRef = useRef(false);
  useEffect(() => {
    if (!bloqueInicial || !dataReady || bloqueInicialRef.current) return;
    const info = linkedMap.get(bloqueInicial);
    if (!info) return;
    bloqueInicialRef.current = true;
    const seleccionar = !info.reserved;
    queueMicrotask(() => {
      if (seleccionar) seleccionarSolo(planoId, carritoInfoDe(bloqueInicial));
      setImgFiltro("todas");
      setDetailModal(info);
    });
  }, [bloqueInicial, dataReady, linkedMap, planoId, seleccionarSolo, carritoInfoDe]);

  const sinContrato = CONTRATO_SIEMPRE_AL_FINAL;
  const {
    reservaOpen, setReservaOpen,
    reservaStep, setReservaStep,
    formDatos, setFormDatos,
    docsRequisitos,
    subiendoRequisito,
    submitting,
    submitStage,
    submitError,
    selectedCount,
    singleStand,
    stepDone,
    canGoStep,
    handleOpenChange,
    addDocRequisito,
    removeDocRequisito,
    handleSubmit,
    reset: resetForm,
    confirmado, setConfirmado,
    aceptaRepresentante, setAceptaRepresentante,
    cuotasConfig, setCuotasConfig, configCuotas,
    contratoDatos, setContratoDatos,
    contrato,
    generandoContrato,
    generarContratoYReservar,
    contratoFirmadoUrl,
    subiendoFirmado,
    subirContratoFirmado,
    firmaPerfilUrl,
    subirFirmaPerfil,
    firmaDigitalAplicada,
    firmarDigitalmente,
  } = useReservaForm(idsGlobales, linkedMap, { sinContrato });

  const { session: sesionReserva, cargando: sesionCargando, refrescar: refrescarSesion } = useSesion();

  /** Verificando el perfil antes de abrir el wizard (bloquea el boton mientras consulta). */
  const [verificandoPerfil, setVerificandoPerfil] = useState(false);

  /**
   * Candado previo al wizard de reserva: las cuentas vinculadas a una empresa deben
   * tener completos los datos obligatorios del representante (perfil); si faltan,
   * se redirige a /dashboard/perfil en vez de abrir la reserva.
   */
  const abrirReservaConPerfil = useCallback(async (): Promise<boolean> => {
    setVerificandoPerfil(true);
    try {
      const perfil = await perfilService.get().catch(() => null);
      if (perfil?.representanteIncompleto) {
        toast.error("Completa los datos del representante legal en tu perfil para continuar con la reserva.");
        router.push("/dashboard/perfil");
        return false;
      }
      if (sesionReserva?.authenticated) {
        const standIds = idsGlobales
          .map((id) => linkedMap.get(id)?.dbId)
          .filter((id): id is string => typeof id === "string" && id.length > 0);
        if (standIds.length > 0) {
          holdSolicitudRef.current = standIds;
          try {
            const hold = await gessService.hold(standIds);
            holdReservaRef.current = hold;
            setHoldReserva(hold);
          } catch (error) {
            const msg = error instanceof Error ? error.message : "No se pudo bloquear el stand. Intenta de nuevo.";
            errorReporting.reserva(ERROR_LOG_PASOS_RESERVA.HOLD, error, { stands: standIds });
            toast.error(msg);
            return false;
          } finally {
            holdSolicitudRef.current = null;
          }
        }
      }
      setReservaOpen(true);
      setReservaStep(0);
      return true;
    } finally {
      setVerificandoPerfil(false);
    }
  }, [router, setReservaOpen, setReservaStep, sesionReserva?.authenticated, idsGlobales, linkedMap]);

  useEffect(() => {
    if (!openReserva || !dataReady) return;
    void (async () => {
      try {
        const raw = localStorage.getItem(LS_KEYS.PLANO_SELECCION);
        if (raw) {
          const ids = JSON.parse(raw) as string[];
          const valid = ids.filter((id) => linkedMap.has(id) && !linkedMap.get(id)?.reserved);
          if (valid.length > 0) {
            const { sincronizarPlano } = usePlanoCarrito.getState();
            sincronizarPlano(planoId, valid.map(carritoInfoDe));
            void abrirReservaConPerfil();
          }
        }
      } catch { /* ignore */ }
      localStorage.removeItem(LS_KEYS.PLANO_SELECCION);
      router.replace("/plano", { scroll: false });
    })();
  }, [openReserva, dataReady, linkedMap, router, abrirReservaConPerfil, planoId, carritoInfoDe]);

  // Override: auto-open + restore selection from login redirect
  useEffect(() => {
    if (!openReserva || !dataReady) return;
    void (async () => {
      try {
        const raw = localStorage.getItem(LS_KEYS.PLANO_SELECCION);
        if (raw) {
          const ids = JSON.parse(raw) as string[];
          const valid = ids.filter((id) => linkedMap.has(id) && !linkedMap.get(id)?.reserved);
          if (valid.length > 0) {
            const { sincronizarPlano } = usePlanoCarrito.getState();
            sincronizarPlano(planoId, valid.map(carritoInfoDe));
          }
        }
      } catch { /* ignore */ }
      localStorage.removeItem(LS_KEYS.PLANO_SELECCION);
      router.replace(`/mapa?codigo=${planoId}`, { scroll: false });
      void abrirReservaConPerfil();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openReserva, dataReady, planoId, router]);

  const handleReservaOpenChange = useCallback((open: boolean) => {
    if (!open && holdReserva && !submitting) {
      void gessService.liberarHold(holdReserva.holdId).catch(() => {});
      holdReservaRef.current = null;
      setHoldReserva(null);
    }
    handleOpenChange(open);
  }, [handleOpenChange, holdReserva, submitting]);

  const handleSelect = (id: string) => {
    const info = linkedMap.get(id);
    if (info?.reserved) {
      if (idsPlano.length === 1 && idsPlano[0] === id) {
        limpiarPlanoCarrito(planoId);
      } else {
        seleccionarSolo(planoId, carritoInfoDe(id));
      }
      return;
    }
    toggleCarrito(planoId, carritoInfoDe(id));
  };
  const hayReservados = idsGlobales.some(id => linkedMap.get(id)?.reserved);
  const haySinStand = idsGlobales.some(id => !linkedMap.get(id)?.dbId);

  const selectedLabels = entradasCarrito
    .map(c => `${c.standCode || c.bloqueId}${c.pabellonCodigo !== planoId ? ` (${c.pabellonCodigo})` : ""}`)
    .join(", ");
  const singleId = idsGlobales.length === 1 ? idsGlobales[0] : undefined;
  const gessInfoForSelected = singleId ? (linkedMap.get(singleId) ?? null) : null;

  useEffect(() => {
    void (async () => {
      if (!reservaOpen) {
        setStandDocs([]);
        return;
      }
      if (!gessInfoForSelected?.dbId || !singleId) return;
      try {
        const stand = await gessService.findByBloque(singleId);
        const docs = stand?.documentos;
        setStandDocs(Array.isArray(docs) ? docs as string[] : []);
      } catch { /* ignore */ }
    })();
  }, [reservaOpen, gessInfoForSelected?.dbId, singleId]);

  const onDatosChange = (update: Partial<FormDatos>) => setFormDatos(d => ({ ...d, ...update }));

  // Navegacion del carrusel con las flechas del teclado mientras esta abierto.
  useEffect(() => {
    if (!imgCarousel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setImgCarousel((prev) => prev ? { ...prev, idx: Math.max(0, prev.idx - 1) } : null);
      if (e.key === "ArrowRight") setImgCarousel((prev) => prev ? { ...prev, idx: Math.min(prev.images.length - 1, prev.idx + 1) } : null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [imgCarousel]);

  // Contenido del panel "Mi seleccion": se monta en el aside (desktop) y en el
  // bottom sheet (mobile) sin duplicar el markup. Muestra el carrito global
  // (todos los pabellones).
  const totalCarritoCount = totalCarrito(seleccionesCarrito);
  const pabellonesConItems = new Set(entradasCarrito.map((c) => c.pabellonCodigo)).size;
  /* Total del carrito: precio persistido por item o el resuelto de la fila actual. */
  const totalCarritoPrecio = useMemo(
    () => entradasCarrito.reduce(
      (acc, c) => acc + (c.precio ?? linkedMap.get(c.bloqueId)?.precio ?? 0),
      0,
    ),
    [entradasCarrito, linkedMap],
  );
  /** El carrito muestra el mismo desglose neto + IGV que el contrato. */
  const importesCarrito = useMemo(() => calcularImportes(totalCarritoPrecio), [totalCarritoPrecio]);
  // Plano macro al que se puede volver desde este pabellon (padre registrado o macro global).
  const macroDestino = parentsCarrito[planoId] ?? (macroCodigo && macroCodigo !== planoId ? macroCodigo : null);
  const contenidoPanel = (
    <>
      <div className="flex items-center justify-between border-b border-border bg-secondary px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-bold tracking-tight text-primary uppercase">
          <ShoppingBag className="h-4 w-4 text-primary" />
          <span>Mi seleccion</span>
        </h3>
        <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-extrabold text-primary-foreground">
          {totalCarritoCount} {totalCarritoCount === 1 ? "stand" : "stands"}
        </span>
      </div>

      {entradasCarrito.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 p-6 text-center">
          <MousePointerClick className="h-5 w-5 text-muted-foreground/60" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span>Haz clic en un stand del plano para agregarlo.<br />Arrastra para rotar y usa la rueda para acercar.</span>
          </p>
        </div>
      ) : (
        <>
          {pabellonesConItems > 1 && (
            <p className="border-b border-border bg-secondary px-4 py-1.5 text-center text-[10px] font-medium text-muted-foreground">
              Carrito de {pabellonesConItems} pabellones
            </p>
          )}
          <div className="flex-1 divide-y divide-border overflow-y-auto">
            {entradasCarrito.map((c) => {
              const info = linkedMap.get(c.bloqueId);
              const esPlanoActual = c.pabellonCodigo === planoId;
              /* Precio: el persistido en el carrito (sirve entre pabellones) o el de la fila actual. */
              const precioItem = c.precio != null ? precioTexto(c.precio) : (info?.medidas ?? null);
              return (
                <div
                  key={c.bloqueId}
                  className="group flex cursor-pointer items-start justify-between gap-2 px-4 py-3 transition-colors hover:bg-secondary"
                  onClick={() => { if (info) { setImgFiltro("todas"); setDetailModal(info); } }}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-primary">{c.standCode || c.bloqueId}</span>
                      {!esPlanoActual && (
                        <Badge className="pointer-events-none border-transparent bg-info/10 text-[10px] text-info">
                          <span>{c.pabellonCodigo}</span>
                        </Badge>
                      )}
                      {info?.estado && <BadgeEstadoStand estado={info.estado} />}
                      {!info?.dbId && (
                        <Badge
                          className="pointer-events-none border-transparent bg-warning/10 text-[10px] text-warning"
                          title="Este bloque no tiene un stand vinculado en el evento"
                        >
                          <span>sin stand</span>
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
                      {c.tipoLabel ?? ""}
                      {info?.tipoStand ? ` • ${info.tipoStand}` : ""}
                    </p>
                    {precioItem && (
                      <p className="mt-1 text-sm font-bold text-gold">{precioItem}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!esPlanoActual && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 p-0 text-info hover:bg-info/10 hover:text-info"
                        title={`Ver pabellon ${c.pabellonCodigo}`}
                        onClick={(e) => { e.stopPropagation(); router.push(urlPabellon(c.pabellonCodigo, parentsCarrito, macroCodigo)); }}
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); quitarCarrito(c.bloqueId); }}
                      title="Quitar de la seleccion"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2.5 border-t border-border bg-secondary px-4 py-3.5">
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Valor venta (neto)</span>
                <span className="font-semibold text-foreground">{precioTexto(importesCarrito.valorVenta)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-muted-foreground">IGV ({Number((IGV_PORCENTAJE * 100).toFixed(2))}%)</span>
                <span className="font-semibold text-foreground">{precioTexto(importesCarrito.igv)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2 border-t border-border pt-2 text-sm">
                <span className="font-semibold text-primary">Total a pagar</span>
                <div className="text-right">
                  <p className="text-base leading-tight font-extrabold text-gold">{precioTexto(importesCarrito.total)}</p>
                  <p className="text-[10px] font-medium text-muted-foreground">
                    {totalCarritoCount} {totalCarritoCount === 1 ? "stand" : "stands"}
                  </p>
                </div>
              </div>
            </div>
            {macroDestino && (
              <Button
                variant="outline"
                className="w-full gap-1.5 text-xs font-medium"
                onClick={() => router.push(`/mapa?codigo=${encodeURIComponent(macroDestino)}`)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Volver al mapa macro</span>
              </Button>
            )}
            <Button
              variant="default"
              className="w-full gap-2 bg-gold font-bold text-gold-foreground shadow-md hover:bg-gold/90"
              disabled={totalCarritoCount === 0 || hayReservados || haySinStand || verificandoPerfil}
              onClick={() => { void abrirReservaConPerfil(); }}
            >
              <span>{hayReservados ? "Hay bloques no disponibles" : haySinStand ? "Hay bloques sin stand vinculado" : `Continuar con la Reserva (${totalCarritoCount})`}</span>
              {!hayReservados && !haySinStand && <ChevronRight className="h-4 w-4" />}
            </Button>
            {haySinStand && (
              <p className="text-center text-[10px] text-warning">
                Los bloques marcados &quot;sin stand&quot; no tienen un stand vinculado en este evento. El administrador debe vincularlos desde Vinculacion de Stands.
              </p>
            )}
          </div>
        </>
      )}
    </>
  );

  return (
    <div className="flex h-[calc(100vh-7rem)] w-full flex-col gap-4 lg:flex-row">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:flex-[78]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <h1 className="flex items-center gap-2 text-lg font-bold text-primary">
              <Layers className="h-4 w-4 text-primary" />
              <span>{nombrePlano ?? "Plano de stands"}</span>
            </h1>
            {totalCarritoCount > 0 && (
              <Badge className="pointer-events-none border-transparent bg-primary/10 text-primary">
                <span>{totalCarritoCount} {totalCarritoCount === 1 ? "stand seleccionado" : "stands seleccionados"}</span>
              </Badge>
            )}
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">
            Arrastra para rotar y usa la rueda para acercar
          </span>
        </div>

        <div className="relative min-h-0 flex-1 bg-slate-100">
          {planoLoading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-slate-100/90">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm font-medium text-muted-foreground">Cargando plano 3D...</p>
            </div>
          )}
        <Canvas shadows camera={{position:[cx,S*.7,cz+S*.35],fov:50,near:.1,far:300}}
        gl={{toneMapping:THREE.ACESFilmicToneMapping,outputColorSpace:THREE.SRGBColorSpace}}>
        <fog attach="fog" args={["#E8E0D5",S*.9,S*2.2]}/><ambientLight intensity={.75}/>
        <directionalLight position={[cx+S*.3,S*1.2,cz]} intensity={2.5} castShadow shadow-mapSize={[2048,2048]}
          shadow-camera-left={-S} shadow-camera-right={S} shadow-camera-top={S} shadow-camera-bottom={-S}/>
        <directionalLight position={[cx-S*.2,S*.5,cz-S*.3]} intensity={.4}/>
        <Floor bnd={bnd}/>
        {items.map((it)=>{
          const info = linkedMap.get(it.id);
          const reserved = info?.reserved ?? false;
          return (
            <Bloque3D
              key={it.id}
              item={it}
              selected={idsPlano.includes(it.id)}
              reserved={reserved}
              hoverText={reserved ? (info?.estado === ESTADOS_STAND.EN_PROCESO ? "En proceso de reserva, reintente luego." : (info?.empresa?.trim() || "Reservado")) : null}
              logoUrl={reserved ? (info?.empresaLogo ?? null) : null}
              topLabel={info?.standCode ? String(info.standCode).trim() || null : null}
              onHover={setHoverStand}
              onSelect={(id) => {
                handleSelect(id);
                /* Enfoca la vista al bloque tocado (con encuadre que incluye el globo). */
                vistaApiRef.current?.enfocar(it.x, it.z, Math.max(it.dim.w, it.dim.d), it.dim.h);
              }}
            />
          );
        })}
        {furniture.map((f)=><FurnitureRenderer key={f.id} item={f}/>)}
        <CameraRig registrar={(api) => { vistaApiRef.current = api; }} cx={cx} cz={cz} S={S}/>
        {/* Por defecto: navegacion original (arrastrar gira alrededor del centro del plano).
            El modo mapa (arrastrar mueve) se alterna desde los iconos de ayuda. */}
        <OrbitControls makeDefault enableRotate enablePan enableZoom target={[cx,0,cz]} maxPolarAngle={Math.PI/2.1} minDistance={S*.15} maxDistance={S*1.6}
          enableDamping dampingFactor={0.12}
          mouseButtons={modoOriginal
            ? { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
            : { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
          touches={modoOriginal
            ? { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
            : { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }}/>
      </Canvas>
        {/* Navegacion manual: boton visible que despliega los iconos de ayuda (zoom, giro, centrar). */}
        <div className="absolute bottom-4 right-4 z-10 flex flex-col items-end gap-1">
          {panelAyuda && (
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-white/95 p-1 shadow-md">
              <BotonNav label="Acercar" onClick={() => vistaApiRef.current?.zoom(0.75)}>
                <ZoomIn className="h-4 w-4" />
              </BotonNav>
              <BotonNav label="Alejar" onClick={() => vistaApiRef.current?.zoom(1.35)}>
                <ZoomOut className="h-4 w-4" />
              </BotonNav>
              <BotonNav label="Girar a la izquierda" onClick={() => vistaApiRef.current?.girar(45)}>
                <RotateCcw className="h-4 w-4" />
              </BotonNav>
              <BotonNav label="Girar a la derecha" onClick={() => vistaApiRef.current?.girar(-45)}>
                <RotateCw className="h-4 w-4" />
              </BotonNav>
              <BotonNav label="Centrar vista" onClick={() => vistaApiRef.current?.reiniciar()}>
                <Home className="h-4 w-4" />
              </BotonNav>
              <BotonNav
                label="Modo guiado (arrastrar gira sobre los ejes X/Y)"
                activo={modoOriginal}
                onClick={() => { setModoOriginal(true); vistaApiRef.current?.centrar(); }}
              >
                <Compass className="h-4 w-4" />
              </BotonNav>
              <BotonNav
                label="Modo manual (arrastrar mueve el plano)"
                activo={!modoOriginal}
                onClick={() => setModoOriginal(false)}
              >
                <Hand className="h-4 w-4" />
              </BotonNav>
            </div>
          )}
          <Button
            variant={panelAyuda ? "secondary" : "outline"}
            size="icon"
            className={`h-8 w-8 shadow-md ${panelAyuda ? "bg-primary/10 text-primary" : "bg-white/95"}`}
            title={panelAyuda ? "Ocultar controles de navegacion" : "Mostrar controles de navegacion"}
            aria-label="Mostrar controles de navegacion"
            aria-expanded={panelAyuda}
            onClick={() => setPanelAyuda((v) => !v)}
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </div>
        {panelAyuda && (
          <div className="pointer-events-none absolute bottom-4 left-3 right-14 z-10 rounded-xl bg-primary/85 px-3 py-1 text-center text-[10px] font-medium leading-tight text-primary-foreground shadow sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:whitespace-nowrap sm:rounded-full sm:text-left sm:text-[11px]">
            <span className="sm:hidden">{modoOriginal ? "Arrastra para girar la vista · 2 dedos para zoom" : "Arrastra para mover el plano · 2 dedos para zoom"}</span>
            <span className="hidden sm:inline">{modoOriginal ? "Modo guiado: arrastrar gira la vista sobre los ejes X/Y · Rueda para zoom" : "Modo manual: arrastrar mueve el plano · Rueda para zoom"}</span>
          </div>
        )}
        {hoverStand && (
          <div
            className="pointer-events-none fixed z-50 max-w-[260px] rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg"
            style={{ left: hoverStand.x + 14, top: hoverStand.y + 14 }}
          >
            <span>{hoverStand.text}</span>
          </div>
        )}
        </div>

        <div className="border-t border-border bg-secondary px-4 py-3">
          {/* Desktop: leyenda siempre visible */}
          <div className="hidden flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:flex">
            <span className="font-bold text-primary">Leyenda:</span>
            {leyenda.map((l) => (
              <Legend key={l.label} color={l.color} label={l.label} />
            ))}
          </div>
          {/* Mobile: toggle + leyenda */}
          <div className="sm:hidden">
            {!legendOpen ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-auto gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-primary"
                onClick={() => setLegendOpen(true)}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Leyenda</span>
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary">Leyenda</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 p-0 text-muted-foreground hover:bg-transparent hover:text-primary"
                    title="Cerrar leyenda"
                    onClick={() => setLegendOpen(false)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                  {leyenda.map((l) => (
                    <Legend key={l.label} color={l.color} label={l.label} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile: abre el panel "Mi seleccion" como bottom sheet */}
        <div className="border-t border-border bg-card px-4 py-3 lg:hidden">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between border-border"
            onClick={() => setPanelMovil(true)}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-primary">
              <ShoppingBag className="h-4 w-4" />
              <span>Mi seleccion</span>
            </span>
            <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
              {totalCarritoCount}
            </span>
          </Button>
        </div>
      </section>

      {/* 22% del contenedor (min. 15rem para que el carrito siga usable en pantallas chicas). */}
      <aside className="hidden flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:flex lg:min-w-[15rem] lg:flex-[22]">
        {contenidoPanel}
      </aside>

      <Sheet open={panelMovil} onOpenChange={setPanelMovil}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto p-0 pt-10 lg:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Mi seleccion</SheetTitle>
          </SheetHeader>
          {contenidoPanel}
        </SheetContent>
      </Sheet>

      {/* Detail Modal */}
      <Dialog open={detailModal !== null} onOpenChange={() => setDetailModal(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md max-sm:bottom-0 max-sm:top-auto max-sm:max-h-[85vh] max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-2xl sm:top-1/2 sm:translate-y-[-50%]">
          {/* Asa del bottom sheet (solo mobile) */}
          <span className="mx-auto mb-1 block h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" />
          <DialogHeader>
            <DialogTitle>
              <span>{tituloDetalle(detailModal, linkedMap, items, blockLabel)}</span>
            </DialogTitle>
          </DialogHeader>
          {detailModal && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-lg border border-border bg-secondary p-3 text-xs">
                <div><span className="text-muted-foreground">Pabellón</span><p className="font-medium">{detailModal.pabellon ?? "—"}</p></div>
                <div><span className="text-muted-foreground">Área</span><p className="font-medium">{detailModal.area ?? "—"}</p></div>
                <div><span className="text-muted-foreground">Código</span><p className="font-mono font-semibold text-primary">{detailModal.standCode}</p></div>
                <div><span className="text-muted-foreground">Tipo</span><p className="font-medium">{detailModal.tipoStand ?? "—"}</p></div>
                <div><span className="text-muted-foreground">Precio</span><p className="font-medium">{detailModal.medidas ?? "—"}</p></div>
                <div>
                  <span className="text-muted-foreground">Estado</span>
                  <div className="mt-0.5">
                    <BadgeEstadoStand estado={detailModal.estado} />
                  </div>
                </div>
                {detailModal.empresa && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Empresa</span>
                    <div className="flex items-center gap-2">
                      {detailModal.empresaLogo && (
                         
                        <img src={detailModal.empresaLogo} alt={`Logo de ${detailModal.empresa}`} className="h-5 w-5 rounded border border-border bg-white object-contain" />
                      )}
                      <p className="font-medium">{detailModal.empresa}</p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <Image className="h-3.5 w-3.5" />
                    <span>Imagenes y renders del stand</span>
                  </p>
                  {detailModal.imagenes.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto gap-1.5 p-0 text-[11px] font-medium text-primary hover:bg-transparent hover:underline"
                      onClick={() => abrirCarrusel("todas", 0)}
                    >
                      <span>Ver carrusel completo ({detailModal.imagenes.length} {detailModal.imagenes.length === 1 ? "foto" : "fotos"})</span>
                      <Eye className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {/* Imagen referencial del tipo de stand (RF-08) */}
                {detailModal.tipoImagen && (
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Imagen referencial{detailModal.tipoStand ? ` (${detailModal.tipoStand})` : ""}
                    </p>
                    { }
                    <img
                      src={detailModal.tipoImagen}
                      alt={`Imagen referencial del tipo ${detailModal.tipoStand ?? ""}`}
                      className="max-h-48 w-full rounded-lg border border-border bg-white object-contain"
                    />
                  </div>
                )}

                {detailModal.imagenes.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border bg-secondary px-3 py-3 text-center text-[11px] text-muted-foreground">
                    Sin imagenes cargadas para este stand.
                  </p>
                ) : (() => {
                  const grupos = agruparImagenes(detailModal.imagenes, detailModal.imagenesCategorias);
                  const activos = imgFiltro === "todas"
                    ? detailModal.imagenes
                    : (grupos.find((g) => g.categoria === imgFiltro)?.urls ?? detailModal.imagenes);
                  const visibles = activos.slice(0, 8);
                  const conFiltro = grupos.length > 1;
                  return (
                    <div className="space-y-2">
                      {conFiltro && (
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={`h-6 rounded-full px-2 text-[10px] font-medium ${imgFiltro === "todas" ? "bg-primary/15 text-primary hover:bg-primary/20" : "text-muted-foreground hover:text-foreground"}`}
                            onClick={() => setImgFiltro("todas")}
                          >
                            <span>Todas</span>
                            <span className="ml-1 opacity-70">{detailModal.imagenes.length}</span>
                          </Button>
                          {grupos.map(({ categoria, urls }) => (
                            <Button
                              key={categoria}
                              type="button"
                              variant="ghost"
                              size="sm"
                              className={`h-6 rounded-full px-2 text-[10px] font-medium ${imgFiltro === categoria ? "bg-primary/15 text-primary hover:bg-primary/20" : "text-muted-foreground hover:text-foreground"}`}
                              onClick={() => setImgFiltro(categoria)}
                            >
                              <span>{CATEGORIA_IMAGEN_LABELS[categoria]}</span>
                              <span className="ml-1 opacity-70">{urls.length}</span>
                            </Button>
                          ))}
                        </div>
                      )}
                      <div className="grid grid-cols-4 gap-2">
                        {visibles.map((url) => {
                          const categoria = (detailModal.imagenesCategorias[url] ?? CATEGORIAS_IMAGEN.OTRO) as CategoriaImagen;
                          return (
                            <Button
                              key={url}
                              type="button"
                              variant="ghost"
                              className="group relative h-auto overflow-hidden rounded-lg border border-border p-0 hover:border-primary/40"
                              onClick={() => abrirCarrusel(imgFiltro, Math.max(0, activos.indexOf(url)))}
                              title={`Ver ${CATEGORIA_IMAGEN_LABELS[categoria]} del stand ${detailModal.standCode}`}
                            >
                              { }
                              <img src={url} alt={`${CATEGORIA_IMAGEN_LABELS[categoria]} del stand ${detailModal.standCode}`} className="h-16 w-full object-cover transition-transform group-hover:scale-105" />
                              {conFiltro && imgFiltro === "todas" && (
                                <span className="pointer-events-none absolute bottom-0 left-0 max-w-full truncate rounded-tr bg-foreground/70 px-1 text-[9px] font-medium text-background">
                                  {CATEGORIA_IMAGEN_LABELS[categoria]}
                                </span>
                              )}
                            </Button>
                          );
                        })}
                        {activos.length > 8 && (
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-auto rounded-lg border border-dashed border-border p-0 text-muted-foreground hover:border-primary/40 hover:text-primary"
                            onClick={() => abrirCarrusel(imgFiltro, 8)}
                          >
                            <span className="flex h-16 w-full items-center justify-center text-xs font-semibold">
                              +{activos.length - 8}
                            </span>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {detailModal.documentos.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-primary">Documentos ({detailModal.documentos.length})</p>
                  <div className="space-y-0.5 rounded-lg border border-border p-2">
                    {detailModal.documentos.map((url, i) => (
                      <a key={i} href={url} target="_blank" className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs text-primary transition-colors hover:bg-primary/5">
                        <FileText className="h-3 w-3" />
                        <span className="truncate">{url.split("/").pop()}</span>
                        <Eye className="ml-auto h-3 w-3 opacity-50" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <Button variant="outline" size="sm" className="w-full" onClick={() => setDetailModal(null)}>
                <span>Cerrar</span>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ReservaModal
        open={reservaOpen}
        onOpenChange={handleReservaOpenChange}
        holdExpiresAt={holdReserva?.expiresAt ?? null}
        autenticado={sesionReserva?.authenticated === true}
        sesionCargando={sesionCargando}
        onAuthenticated={async () => {
          await sincronizarEventoPublicoEnSesion();
          await refrescarSesion();
        }}
        step={reservaStep as ReservaStep}
        onGoStep={(s) => setReservaStep(s)}
        stepDone={stepDone}
        canGoStep={canGoStep}
        formDatos={formDatos}
        onDatosChange={onDatosChange}
        docsRequisitos={docsRequisitos}
        subiendoRequisito={subiendoRequisito}
        submitting={submitting}
        submitStage={submitStage}
        submitError={submitError}
        selectedCount={selectedCount}
        singleStand={singleStand}
        selectedLabels={selectedLabels}
        selectedItems={entradasCarrito.map(c => {
          const info = linkedMap.get(c.bloqueId);
          return {
            id: c.bloqueId,
            standCode: info?.standCode ?? null,
            typeLabel: c.pabellonCodigo !== planoId ? `${c.tipoLabel ?? "?"} (${c.pabellonCodigo})` : (c.tipoLabel ?? "?"),
            medidas: info?.medidas ?? null,
            reserved: info?.reserved ?? false,
            precio: info?.precio ?? 0,
          };
        })}
        existingDocs={standDocs.length > 0 ? standDocs : (gessInfoForSelected?.documentos ?? [])}
        onAddRequisito={addDocRequisito}
        onRemoveRequisito={removeDocRequisito}
          confirmado={confirmado}
          onConfirmadoChange={setConfirmado}
          aceptaRepresentante={aceptaRepresentante}
          onAceptaRepresentanteChange={setAceptaRepresentante}
      configCuotas={configCuotas}
      cuotasPago={cuotasConfig}
      onCuotasPagoChange={setCuotasConfig}
      contratoDatos={contratoDatos}
      onContratoDatosChange={setContratoDatos}
        contrato={contrato}
        generandoContrato={generandoContrato}
        onGenerarContrato={generarContratoYReservar}
        contratoFirmadoUrl={contratoFirmadoUrl}
        subiendoFirmado={subiendoFirmado}
        onSubirFirmado={(file) => { void subirContratoFirmado(file); }}
        firmaPerfilUrl={firmaPerfilUrl}
        onSubirFirmaPerfil={subirFirmaPerfil}
        firmaDigitalAplicada={firmaDigitalAplicada}
        onFirmarDigital={() => { void firmarDigitalmente(); }}
        sinContrato={sinContrato}
        onSubmit={async () => {
          const result = await handleSubmit(holdReserva?.holdId);
          if (result === true) {
            holdReservaRef.current = null;
            setHoldReserva(null);
            const enviados = [...idsGlobales];
            const esMultiple = selectedCount > 1;
            if (esMultiple) {
              setPostSubmitOpen(true);
            } else {
              toast.success(textos.toastTitulo, {
                description: textos.toastDescripcion,
              });
            }
            setLinkedMap(prev => {
              const next = new Map(prev);
              for (const id of enviados) {
                const info = next.get(id);
                if (info) next.set(id, { ...info, reserved: true, estado: ESTADOS_STAND_LEGACY.EN_EVALUACION });
              }
              return next;
            });
            for (const id of enviados) {
              quitarCarrito(id);
            }
            resetForm();
          }
          return result === true;
        }}
      />

      {imgCarousel && (
        <Dialog open={true} onOpenChange={() => setImgCarousel(null)}>
          <DialogContent className="max-w-4xl border-border bg-card p-3 text-card-foreground sm:p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3 pr-8">
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
                    {imgCarousel.idx + 1} / {imgCarousel.images.length}
                  </span>
                  {(() => {
                    const urlActual = imgCarousel.images[imgCarousel.idx];
                    const categoriaActual = urlActual ? imgCarousel.grupos.find((g) => g.urls.includes(urlActual))?.categoria : undefined;
                    return categoriaActual ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        {CATEGORIA_IMAGEN_LABELS[categoriaActual]}
                      </span>
                    ) : null;
                  })()}
                </div>
                <span className="truncate text-[11px] text-muted-foreground">
                  {stringUtils.nombreArchivo(imgCarousel.images[imgCarousel.idx])}
                </span>
              </div>

              {imgCarousel.grupos.length > 1 && (
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={`h-6 rounded-full px-2 text-[10px] font-medium ${imgCarousel.filtro === "todas" ? "bg-primary/15 text-primary hover:bg-primary/20" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => cambiarFiltroCarrusel("todas")}
                  >
                    <span>Todas</span>
                    <span className="ml-1 opacity-70">{imgCarousel.todas.length}</span>
                  </Button>
                  {imgCarousel.grupos.map(({ categoria, urls }) => (
                    <Button
                      key={categoria}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={`h-6 rounded-full px-2 text-[10px] font-medium ${imgCarousel.filtro === categoria ? "bg-primary/15 text-primary hover:bg-primary/20" : "text-muted-foreground hover:text-foreground"}`}
                      onClick={() => cambiarFiltroCarrusel(categoria)}
                    >
                      <span>{CATEGORIA_IMAGEN_LABELS[categoria]}</span>
                      <span className="ml-1 opacity-70">{urls.length}</span>
                    </Button>
                  ))}
                </div>
              )}

              <div className="relative flex items-center justify-center px-12">
                {imgCarousel.images.length > 1 && (
                  <Button type="button" variant="ghost" size="icon"
                    className="absolute left-1 z-10 h-10 w-10 rounded-full bg-secondary/80 text-foreground backdrop-blur-sm hover:bg-secondary disabled:opacity-30"
                    onClick={() => setImgCarousel((prev) => prev ? { ...prev, idx: Math.max(0, prev.idx - 1) } : null)}
                    disabled={imgCarousel.idx === 0}
                    title="Anterior (flecha izquierda)"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                )}
                { }
                <img
                  src={imgCarousel.images[imgCarousel.idx]}
                  alt={`Imagen ${imgCarousel.idx + 1} de ${imgCarousel.images.length}`}
                  className="max-h-[65vh] w-full rounded-lg object-contain"
                />
                {imgCarousel.images.length > 1 && (
                  <Button type="button" variant="ghost" size="icon"
                    className="absolute right-1 z-10 h-10 w-10 rounded-full bg-secondary/80 text-foreground backdrop-blur-sm hover:bg-secondary disabled:opacity-30"
                    onClick={() => setImgCarousel((prev) => prev ? { ...prev, idx: Math.min(prev.images.length - 1, prev.idx + 1) } : null)}
                    disabled={imgCarousel.idx === imgCarousel.images.length - 1}
                    title="Siguiente (flecha derecha)"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                )}
              </div>

              {imgCarousel.images.length > 1 && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {imgCarousel.images.map((url, i) => (
                    <Button key={`${url}-${i}`} type="button" variant="ghost"
                      className={`h-12 w-16 overflow-hidden rounded-md border p-0 transition-all ${
                        i === imgCarousel.idx ? "border-primary ring-2 ring-primary/40" : "border-border opacity-60 hover:opacity-100"
                      }`}
                      onClick={() => setImgCarousel((prev) => prev ? { ...prev, idx: i } : null)}
                      title={`Ir a la imagen ${i + 1}`}
                    >
                      { }
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Post-submit modal — multi-stand flow explanation */}
      <Dialog open={postSubmitOpen} onOpenChange={setPostSubmitOpen}>
        <DialogContent className="rounded-xl border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle><span>{textos.modalTitulo}</span></DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-success/30 bg-success/10 p-4 text-center">
              <Check className="mx-auto mb-2 h-8 w-8 text-success" />
              <p className="text-sm font-bold text-foreground">{textos.modalOk}</p>
              <p className="mt-1 text-xs text-muted-foreground">{textos.modalPasos}</p>
            </div>

            <div className="space-y-0">
              {[
                { icon: ScrollText, color: "bg-success/10 text-success", title: textos.pasos[0].title, desc: textos.pasos[0].desc },
                { icon: Upload, color: "bg-gold/15 text-gold", title: textos.pasos[1].title, desc: textos.pasos[1].desc },
                { icon: FileText, color: "bg-info/10 text-info", title: textos.pasos[2].title, desc: textos.pasos[2].desc },
                { icon: ClipboardCheck, color: "bg-primary/10 text-primary", title: textos.pasos[3].title, desc: textos.pasos[3].desc },
                { icon: Bell, color: "bg-secondary text-muted-foreground", title: textos.pasos[4].title, desc: textos.pasos[4].desc },
              ].map((s, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${s.color}`}>
                      <s.icon className="h-4 w-4" />
                    </div>
                    {i < 4 && <div className="my-0.5 w-0.5 flex-1 bg-border" />}
                  </div>
                  <div className="pb-2">
                    <p className="text-xs font-semibold text-foreground">{s.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border bg-secondary p-3 text-center">
              <p className="text-[11px] text-muted-foreground">
                {textos.monitoreo.antes}
                <span className="font-medium text-primary">{textos.monitoreo.resaltado}</span>
                {textos.monitoreo.despues}
              </p>
            </div>

            <Button className="w-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90" onClick={() => setPostSubmitOpen(false)}>
              <span>{textos.modalBoton}</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BadgeEstadoStand({ estado }: { estado: string | null }) {
  const badge = estadoStandBadge(estado);
  return (
    <Badge className={`pointer-events-none text-[10px] ${badge?.clase ?? BADGE_STYLES.NEUTRAL}`}>
      <span>{badge?.texto ?? estado ?? "-"}</span>
    </Badge>
  );
}

/** Titulo del modal de detalle: "Detalles: <tipo> - <id del bloque>". */
function tituloDetalle(
  detalle: GessInfoFull | null,
  linkedMap: Map<string, GessInfoFull>,
  items: PlanoItem[],
  blockLabel: (type: PlanoItem["type"]) => { label: string; nombre: string },
): string {
  if (!detalle) return "Detalles";
  const bloqueId = [...linkedMap.entries()].find(([, v]) => v === detalle)?.[0];
  const item = items.find((it) => it.id === bloqueId);
  const label = item ? blockLabel(item.type).label : "";
    /* El contrato/cliente usan el codigo comercial del stand; el bloqueId solo ubica. */
    return `Detalles: ${label} - ${codigoComercialStand(detalle.standCode ?? bloqueId)}`;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: color }} />
      <span className="font-medium text-muted-foreground">{label}</span>
    </span>
  );
}
