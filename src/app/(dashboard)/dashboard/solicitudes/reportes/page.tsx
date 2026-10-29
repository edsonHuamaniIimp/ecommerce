"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardContent, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@nrivera-iimp/ui-kit-iimp";
import { Building2, CircleAlert, ClipboardList, FileSpreadsheet, Globe2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PaginaDashboard } from "@/components/dashboard/pagina-dashboard";
import { MapaMundialPaises } from "@/components/reportes/mapa-mundial-paises";
import { useSesion } from "@/hooks/use-sesion";
import { internalApi } from "@/lib/client/api/services/internal-api";
import { PERMISSIONS, TIPOS_DOCUMENTO_EMPRESA_LABELS } from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import { exportarTablaExcel, nombreArchivoExport } from "@/lib/shared/utils/export-tabla";
import { nombrePais } from "@/lib/shared/utils/pais";
import type { EmpresaPaisReporte, ResumenPaisSolicitudes } from "@/domain/models/reportes";

type Alcance = "activas" | "todas";

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
  const [data, setData] = useState<ResumenPaisSolicitudes[]>([]);
  const [alcance, setAlcance] = useState<Alcance>("activas");
  const [loading, setLoading] = useState(true);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncData, setSyncData] = useState<RespuestaSyncPaises | null>(null);
  const [exporting, setExporting] = useState(false);

  const cargar = useCallback(
    async (valor: Alcance) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        if (valor === "todas") qs.set("incluirInactivas", "1");
        const response = await internalApi.get<{ data: ResumenPaisSolicitudes[] }>(
          `/api/reportes/solicitudes-por-pais?${qs.toString()}`,
        );
        setData(response.data ?? []);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo cargar el reporte");
        setData([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (cargando) return;
    const timer = window.setTimeout(() => { void cargar(alcance); }, 0);
    return () => window.clearTimeout(timer);
  }, [cargando, alcance, cargar]);

  const abrirSync = async () => {
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
    setSyncLoading(true);
    try {
      const response = await internalApi.post<RespuestaSyncPaises>("/api/empresas/sincronizar-paises", {
        aplicar: true,
        limite: 50,
      });
      toast.success(`${response.actualizados} países actualizados`);
      setSyncOpen(false);
      setSyncData(null);
      await cargar(alcance);
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
      if (alcance === "todas") qs.set("incluirInactivas", "1");
      const response = await internalApi.get<{ data: EmpresaPaisReporte[] }>(
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
              <p className="text-[10px] text-muted-foreground">{alcance === "activas" ? "activas" : "históricas"}</p>
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

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Cobertura geográfica</p>
          <h2 className="mt-0.5 text-base font-semibold tracking-tight text-foreground">Mapa de calor por país</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Intensidad según solicitudes registradas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={alcance} onValueChange={(valor) => setAlcance(valor as Alcance)}>
            <SelectTrigger className="h-8 w-[170px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="activas"><span>Solicitudes activas</span></SelectItem>
              <SelectItem value="todas"><span>Todas las solicitudes</span></SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            title="Actualizar reporte"
            aria-label="Actualizar reporte"
            onClick={() => void cargar(alcance)}
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
    </PaginaDashboard>
  );
}
