"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardContent, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@nrivera-iimp/ui-kit-iimp";
import { Building2, CircleAlert, ClipboardList, FileSpreadsheet, Globe2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PaginaDashboard } from "@/components/dashboard/pagina-dashboard";
import { MapaMundialPaises } from "@/components/reportes/mapa-mundial-paises";
import { MapaPabellonesReporte } from "@/components/reportes/mapa-pabellones-reporte";
import { useSesion } from "@/hooks/use-sesion";
import { useConfirm } from "@/hooks/use-confirm";
import { internalApi } from "@/lib/client/api/services/internal-api";
import { PERMISSIONS, REPORTES_ALCANCES, REPORTES_VISTAS, TIPOS_DOCUMENTO_EMPRESA_LABELS, type ReporteAlcance, type ReporteVista } from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import { exportarTablaExcel, nombreArchivoExport } from "@/lib/shared/utils/export-tabla";
import { nombrePais } from "@/lib/shared/utils/pais";
import type { EmpresaPaisReporteDTO, MapaPabellonesReporteDTO as MapaPabellonesData, ResumenPaisSolicitudesDTO } from "@/types/dto/reportes";

interface ResultadoPais {
  id: string;
  ruc: string;
  razonSocial: string;
  paisActual: string;
  paisSie: string | null;
  paisNombreSie: string | null;
  estado: "sin_dato" | "por_actualizar" | "actualizado" | "igual" | "error";
  error?: string;
}

interface RespuestaSyncPaises {
  total: number;
  actualizados: number;
  resultados: ResultadoPais[];
}

export default function ReportesSolicitudesPage() {
  const { session, cargando } = useSesion();
  const [data, setData] = useState<ResumenPaisSolicitudesDTO[]>([]);
  const [mapaPabellones, setMapaPabellones] = useState<MapaPabellonesData>({ pabellones: [], bloques: [] });
  const [alcance, setAlcance] = useState<ReporteAlcance>(REPORTES_ALCANCES.ACTIVAS);
  const [vista, setVista] = useState<ReporteVista>(REPORTES_VISTAS.PAISES);
  const [loading, setLoading] = useState(true);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncData, setSyncData] = useState<RespuestaSyncPaises | null>(null);
  const [exporting, setExporting] = useState(false);
  const { confirm, confirmDialog } = useConfirm();

  const cargar = useCallback(
    async (valor: ReporteAlcance, eventoId?: string) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        if (valor === REPORTES_ALCANCES.TODAS) qs.set("incluirInactivas", "1");
        const mapaQs = new URLSearchParams(qs);
        if (eventoId) mapaQs.set("eventoId", eventoId);
        const [response, mapaResponse] = await Promise.all([
          internalApi.get<{ data: ResumenPaisSolicitudesDTO[] }>(
            `/api/reportes/solicitudes-por-pais?${qs.toString()}`,
          ),
          eventoId
            ? internalApi.get<MapaPabellonesData>(
                `/api/reportes/mapa-pabellones?${mapaQs.toString()}`,
              ).catch(() => null)
            : Promise.resolve(null),
        ]);
        setData(response.data ?? []);
        setMapaPabellones(mapaResponse ?? { pabellones: [], bloques: [] });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo cargar el reporte");
        setData([]);
        setMapaPabellones({ pabellones: [], bloques: [] });
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (cargando) return;
    const timer = window.setTimeout(() => { void cargar(alcance, session?.eventoId ?? undefined); }, 0);
    return () => window.clearTimeout(timer);
  }, [cargando, alcance, cargar, session?.eventoId]);

  const abrirSync = async () => {
    const confirmado = await confirm({
      title: "Sincronizar países desde SIE",
      description: "Se consultará el servicio SIE y, si después aplicas los cambios, se actualizará el país de las empresas no domiciliadas que tengan país pendiente. Esta acción modifica datos de empresas.",
      confirmLabel: "Consultar SIE",
      cancelLabel: "Cancelar",
    });
    if (!confirmado) return;
    setSyncOpen(true);
    setSyncLoading(true);
    setSyncData(null);
    try {
      const response = await internalApi.post<RespuestaSyncPaises>("/api/empresas/sincronizar-paises", {
        aplicar: false,
        limite: 50,
      });
      setSyncData(response);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo consultar SIE");
    } finally {
      setSyncLoading(false);
    }
  };

  const aplicarSync = async () => {
    const porAplicar = syncData?.resultados.filter((fila) => fila.estado === "por_actualizar").length ?? 0;
    if (porAplicar === 0) {
      toast.info("No hay cambios de país para aplicar");
      return;
    }
    const confirmado = await confirm({
      title: "Aplicar cambios de país",
      description: `Se actualizarán ${porAplicar} empresa(s) con el país devuelto por SIE. Esta acción modificará sus datos. ¿Deseas continuar?`,
      confirmLabel: "Aplicar cambios",
      cancelLabel: "Cancelar",
      destructive: true,
    });
    if (!confirmado) return;
    setSyncLoading(true);
    try {
      const response = await internalApi.post<RespuestaSyncPaises>("/api/empresas/sincronizar-paises", {
        aplicar: true,
        limite: 50,
      });
      toast.success(`${response.actualizados} países actualizados`);
      setSyncOpen(false);
      setSyncData(null);
      await cargar(alcance, session?.eventoId ?? undefined);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo aplicar la sincronización");
    } finally {
      setSyncLoading(false);
    }
  };

  const exportarExcel = async () => {
    setExporting(true);
    try {
      const qs = new URLSearchParams();
      if (alcance === REPORTES_ALCANCES.TODAS) qs.set("incluirInactivas", "1");
      const response = await internalApi.get<{ data: EmpresaPaisReporteDTO[] }>(
        `/api/reportes/empresas-por-pais?${qs.toString()}`,
      );
      if (!response.data?.length) {
        toast.error("No hay empresas para exportar con los filtros actuales");
        return;
      }
      await exportarTablaExcel(
        response.data,
        [
          { encabezado: "País", valor: (fila) => (fila.pais ? nombrePais(fila.pais) : "Sin país") },
          { encabezado: "Código país", valor: (fila) => fila.pais ?? "" },
          { encabezado: "RUC / RUT", valor: (fila) => fila.ruc ?? "" },
          { encabezado: "Tipo documento", valor: (fila) => TIPOS_DOCUMENTO_EMPRESA_LABELS[fila.tipoDocumento ?? ""] ?? fila.tipoDocumento ?? "" },
          { encabezado: "Razón social", valor: (fila) => fila.razonSocial },
          { encabezado: "Estado", valor: (fila) => fila.estado ?? "" },
          { encabezado: "Solicitudes", valor: (fila) => fila.solicitudes },
          { encabezado: "Activas", valor: (fila) => fila.solicitudesActivas },
          { encabezado: "Inactivas", valor: (fila) => fila.solicitudesInactivas },
          { encabezado: "Datos validados", valor: (fila) => fila.datosValidadosEn ? dateUtils.formatDateTime(fila.datosValidadosEn) : "" },
        ],
        nombreArchivoExport("empresas-por-pais", "xlsx"),
        "Empresas",
      );
      toast.success(`${response.data.length} empresas exportadas`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo descargar el Excel");
    } finally {
      setExporting(false);
    }
  };

  const puedeSincronizar = session?.permissions?.includes(PERMISSIONS.EMPRESAS_MANAGE) ||
    session?.permissions?.includes(PERMISSIONS.ADMIN_FULL);

  const totalSolicitudes = data.reduce((total, fila) => total + fila.solicitudes, 0);
  const totalEmpresas = data.reduce((total, fila) => total + fila.empresas, 0);
  const totalPaises = data.filter((fila) => fila.pais).length;
  const totalSinPais = data.filter((fila) => !fila.pais).reduce((total, fila) => total + fila.empresas, 0);

  return (
    <PaginaDashboard
      titulo="Reportes de solicitudes"
      descripcion="Distribución geográfica de las empresas que registraron solicitudes de alquiler."
      cargando={cargando}
      tieneEvento
      ancho="amplio"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-primary/10" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Globe2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Países</p>
              <p className="text-2xl font-semibold tracking-tight text-foreground">{totalPaises}</p>
              <p className="text-[10px] text-muted-foreground">con solicitudes</p>
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-gold/10" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Empresas</p>
              <p className="text-2xl font-semibold tracking-tight text-foreground">{totalEmpresas}</p>
              <p className="text-[10px] text-muted-foreground">con actividad</p>
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-info/10" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10 text-info">
              <ClipboardList className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Solicitudes</p>
              <p className="text-2xl font-semibold tracking-tight text-foreground">{totalSolicitudes}</p>
              <p className="text-[10px] text-muted-foreground">{alcance === REPORTES_ALCANCES.ACTIVAS ? "activas" : "históricas"}</p>
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-warning/30 bg-warning/5 p-4 shadow-sm">
          <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-warning/10" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/15 text-warning">
              <CircleAlert className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Sin país</p>
              <p className="text-2xl font-semibold tracking-tight text-foreground">{totalSinPais}</p>
              <p className="text-[10px] text-muted-foreground">por confirmar</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 rounded-xl border border-border bg-secondary/40 p-1" role="tablist" aria-label="Vistas del reporte">
        <button
          type="button"
          role="tab"
          aria-selected={vista === REPORTES_VISTAS.PAISES}
          onClick={() => setVista(REPORTES_VISTAS.PAISES)}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${vista === REPORTES_VISTAS.PAISES ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Cobertura geográfica
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={vista === REPORTES_VISTAS.PABELLONES}
          onClick={() => setVista(REPORTES_VISTAS.PABELLONES)}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${vista === REPORTES_VISTAS.PABELLONES ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Mapa de pabellones 2D
        </button>
      </div>

      {vista === REPORTES_VISTAS.PAISES ? (
        <>
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Cobertura geográfica</p>
          <h2 className="mt-0.5 text-base font-semibold tracking-tight text-foreground">Mapa de calor por país</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Intensidad según solicitudes registradas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={alcance} onValueChange={(valor) => setAlcance(valor as ReporteAlcance)}>
            <SelectTrigger className="h-8 w-[170px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={REPORTES_ALCANCES.ACTIVAS}><span>Solicitudes activas</span></SelectItem>
              <SelectItem value={REPORTES_ALCANCES.TODAS}><span>Todas las solicitudes</span></SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            title="Actualizar reporte"
            aria-label="Actualizar reporte"
            onClick={() => void cargar(alcance, session?.eventoId ?? undefined)}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => void exportarExcel()}
            disabled={exporting || loading}
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{exporting ? "Generando..." : "Descargar Excel"}</span>
          </Button>
          {puedeSincronizar ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => void abrirSync()}
              disabled={syncLoading}
            >
              <Globe2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sincronizar países</span>
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <Card className="border-border/70">
          <CardContent className="flex h-80 items-center justify-center text-sm text-muted-foreground">
            Cargando mapa...
          </CardContent>
        </Card>
      ) : (
        <MapaMundialPaises data={data} />
      )}
        </>
      ) : (
        <MapaPabellonesReporte
          data={mapaPabellones}
          paises={data}
          eventoId={session?.eventoId}
          tipoEvento={session?.tipoEvento}
          codigoEvento={session?.codigoEvento}
        />
      )}

      <Dialog open={syncOpen} onOpenChange={setSyncOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Globe2 className="h-4 w-4 text-primary" />
              <span>Sincronizar países desde SIE</span>
            </DialogTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Solo se actualizarán empresas no domiciliadas con país pendiente. Revisa la previsualización antes de aplicar.
            </p>
          </DialogHeader>

          {syncLoading && !syncData ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Consultando SIE...
            </div>
          ) : syncData ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {syncData.total} empresas analizadas · {syncData.actualizados} actualizadas en la última ejecución.
              </p>
              <div className="max-h-72 space-y-1.5 overflow-y-auto">
                {syncData.resultados.map((fila) => (
                  <div key={fila.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground">{fila.razonSocial}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{fila.ruc}</p>
                    </div>
                    <div className="shrink-0 text-right text-[11px]">
                      <p className="text-muted-foreground">
                        {fila.paisSie ? nombrePais(fila.paisSie) : "Sin dato en SIE"}
                      </p>
                      {fila.error ? <p className="text-destructive">{fila.error}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">No se pudo obtener la previsualización.</p>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSyncOpen(false)}>
              <span>Cancelar</span>
            </Button>
            <Button
              size="sm"
              onClick={() => void aplicarSync()}
              disabled={syncLoading || !syncData || syncData.resultados.length === 0}
            >
              {syncLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              <span>Aplicar países</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </PaginaDashboard>
  );
}
