"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Switch,
} from "@nrivera-iimp/ui-kit-iimp";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileText,
  History,
  Loader2,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { ddConfiguracionService } from "@/lib/client/api/services/dd-configuracion-service";
import {
  BADGE_STYLES,
  DD_CONFIG_CIERRE_AYUDAS,
  DD_CONFIG_CIERRE_ESTADOS,
  DD_CONFIG_CIERRE_LABELS,
  DD_CONFIG_VIGENCIAS,
} from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import type {
  DdAuditoriaItemDTO,
  DdConfiguracionDTO,
} from "@/types/dto/debida-diligencia";

type TabConfig = "reglas" | "plantillas" | "auditoria";

const TAB_LABELS: { value: TabConfig; label: string; icon: React.ReactNode }[] = [
  { value: "reglas", label: "Reglas y plazos", icon: <SlidersHorizontal className="h-3.5 w-3.5" /> },
  { value: "plantillas", label: "Plantillas y links", icon: <FileText className="h-3.5 w-3.5" /> },
  { value: "auditoria", label: "Auditoría", icon: <History className="h-3.5 w-3.5" /> },
];

export function DdConfiguracion() {
  const [config, setConfig] = useState<DdConfiguracionDTO | null>(null);
  const [auditoria, setAuditoria] = useState<DdAuditoriaItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<TabConfig>("reglas");

  useEffect(() => {
    let activo = true;
    Promise.all([ddConfiguracionService.obtener(), ddConfiguracionService.auditoria()])
      .then(([respuesta, audit]) => {
        if (!activo) return;
        setConfig(respuesta);
        setAuditoria(audit.data);
      })
      .catch((error) => {
        if (activo) toast.error(error instanceof Error ? error.message : "No se pudo cargar la administración");
      })
      .finally(() => {
        if (activo) setLoading(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  const setCampo = <K extends keyof DdConfiguracionDTO>(campo: K, valor: DdConfiguracionDTO[K]) => {
    setConfig((actual) => (actual ? { ...actual, [campo]: valor } : actual));
  };

  const refrescarAuditoria = async () => {
    try {
      const audit = await ddConfiguracionService.auditoria();
      setAuditoria(audit.data);
      toast.success("Auditoría actualizada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la auditoría");
    }
  };

  const guardar = async () => {
    if (!config) return;
    if (!Number.isInteger(config.plazoDiasHabiles) || config.plazoDiasHabiles < 1 || config.plazoDiasHabiles > 30) {
      toast.error("El plazo debe ser un entero entre 1 y 30 días hábiles");
      return;
    }
    setSaving(true);
    try {
      const actualizada = await ddConfiguracionService.actualizar({
        plazoDiasHabiles: config.plazoDiasHabiles,
        estadoCierreAutomatico: config.estadoCierreAutomatico,
        exigirEvidencia: config.exigirEvidencia,
        permitirNaSinEvidencia: config.permitirNaSinEvidencia,
        revalidacionDeclaracion: config.revalidacionDeclaracion,
        noAptoBloqueaEmpresa: config.noAptoBloqueaEmpresa,
        legalSoloDerivacionSig: config.legalSoloDerivacionSig,
        vigenciaMeses: config.vigenciaMeses,
        permitirReutilizacionVinculo: config.permitirReutilizacionVinculo,
        asistenteIaHabilitado: config.asistenteIaHabilitado,
        exigirObservacionCriterio: config.exigirObservacionCriterio,
        manualUrl: config.manualUrl,
        reglamentoUrl: config.reglamentoUrl,
        plantillaInformeUrl: config.plantillaInformeUrl,
        linkListasUrl: config.linkListasUrl,
      });
      setConfig(actualizada);
      const audit = await ddConfiguracionService.auditoria();
      setAuditoria(audit.data);
      toast.success("Configuración de Debida Diligencia guardada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Administración de Debida Diligencia</h1>
            <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.INDIGO}`}>
              <Settings2 className="mr-1 h-3 w-3" />
              <span>Backoffice</span>
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Reglas, plazos, plantillas, links y auditoría del módulo.
          </p>
        </div>
        <Button type="button" size="sm" className="h-9 gap-1.5 text-xs" onClick={() => void guardar()} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          <span>{saving ? "Guardando..." : "Guardar cambios"}</span>
        </Button>
      </div>

      <div className="flex gap-6 border-b border-border" role="tablist" aria-label="Configuración DD">
        {TAB_LABELS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            className={`flex items-center gap-1.5 border-b-2 pb-3 text-xs font-semibold transition-colors ${
              tab === item.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab(item.value)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {tab === "reglas" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-primary">
                <History className="h-4 w-4" />
                <span>Plazo de respuesta</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Tiempo límite para que el cliente subsane observaciones.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs"><span>Días hábiles</span></Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={config.plazoDiasHabiles}
                  onChange={(event) => setCampo("plazoDiasHabiles", Number(event.target.value))}
                  className="mt-1 h-9 text-sm"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Lunes a viernes (sin feriados), contados desde que el expediente queda Observado.
                </p>
              </div>
              <div>
                <Label className="text-xs"><span>Cierre automático</span></Label>
                <Select
                  value={config.estadoCierreAutomatico}
                  onValueChange={(valor) => setCampo("estadoCierreAutomatico", valor)}
                >
                  <SelectTrigger className="mt-1 h-9 w-full text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(DD_CONFIG_CIERRE_ESTADOS).map((estado) => (
                      <SelectItem key={estado} value={estado}>
                        <span>{DD_CONFIG_CIERRE_LABELS[estado] ?? estado}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {DD_CONFIG_CIERRE_AYUDAS[config.estadoCierreAutomatico] ?? "Estado al vencer el plazo."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-primary">
                <ShieldCheck className="h-4 w-4" />
                <span>Reglas de evaluación</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">Parámetros operativos del módulo.</p>
            </CardHeader>
            <CardContent className="space-y-1 pt-3">
              <Toggle
                label="Exigir evidencia por campo aplicable"
                description="Obliga a adjuntar archivo o enlace en cada criterio con hallazgo."
                checked={config.exigirEvidencia}
                onChange={(valor) => setCampo("exigirEvidencia", valor)}
              />
              <Toggle
                label="Exigir observación en criterios con hallazgo"
                description="Al guardar la evaluación SIG, cada criterio con hallazgo necesita su observación (SI en «Hay reportes…» o «Registra antecedentes…»; NO en «Cumple en central de riesgo» y «Bancarizado»)."
                checked={config.exigirObservacionCriterio}
                onChange={(valor) => setCampo("exigirObservacionCriterio", valor)}
              />
              <Toggle
                label="Permitir N.A. sin evidencia"
                description="Los campos marcados como No Aplicable no requieren sustento."
                checked={config.permitirNaSinEvidencia}
                onChange={(valor) => setCampo("permitirNaSinEvidencia", valor)}
              />
              <Toggle
                label="Revalidación con declaración jurada"
                description="Permite renovar la vigencia con el formato firmado."
                checked={config.revalidacionDeclaracion}
                onChange={(valor) => setCampo("revalidacionDeclaracion", valor)}
              />
              <Toggle
                label="NO APTO bloquea toda la empresa"
                description="Si un vínculo queda No Apto, se bloquea la organización."
                checked={config.noAptoBloqueaEmpresa}
                onChange={(valor) => setCampo("noAptoBloqueaEmpresa", valor)}
              />
              <Toggle
                label="Legal solo por derivación SIG"
                description="Legal no puede tomar casos sin derivación previa."
                checked={config.legalSoloDerivacionSig}
                onChange={(valor) => setCampo("legalSoloDerivacionSig", valor)}
              />
              <Toggle
                label="Asistente IA en observaciones de criterios"
                description="Muestra «Ayúdate con IA» y «OCR + prompt» en la Matriz DD (OEFA, OSCE, INDECOPI, lavado/corrupción y Otros)."
                checked={config.asistenteIaHabilitado}
                onChange={(valor) => setCampo("asistenteIaHabilitado", valor)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-primary">
                <Settings2 className="h-4 w-4" />
                <span>Revalidación</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs"><span>Vigencia predeterminada</span></Label>
                <Select
                  value={String(config.vigenciaMeses)}
                  onValueChange={(valor) => setCampo("vigenciaMeses", Number(valor))}
                >
                  <SelectTrigger className="mt-1 h-9 w-full text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DD_CONFIG_VIGENCIAS.map((opcion) => (
                      <SelectItem key={opcion.meses} value={String(opcion.meses)}>
                        <span>{opcion.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-start pt-5">
                <Toggle
                  label="Permitir reutilización del mismo vínculo"
                  description="Habilita renovar la misma relación comercial."
                  checked={config.permitirReutilizacionVinculo}
                  onChange={(valor) => setCampo("permitirReutilizacionVinculo", valor)}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "plantillas" ? (
        <Card>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-bold text-primary">
              <FileText className="h-4 w-4" />
              <span>Plantillas y links</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Enlaces de referencia que se muestran a los equipos del módulo.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
            <LinkField
              label="Manual del Exhibidor"
              value={config.manualUrl}
              onChange={(valor) => setCampo("manualUrl", valor)}
            />
            <LinkField
              label="Reglamento de Stands"
              value={config.reglamentoUrl}
              onChange={(valor) => setCampo("reglamentoUrl", valor)}
            />
            <LinkField
              label="Plantilla de informe"
              value={config.plantillaInformeUrl}
              onChange={(valor) => setCampo("plantillaInformeUrl", valor)}
            />
            <LinkField
              label="Listas restrictivas"
              value={config.linkListasUrl}
              onChange={(valor) => setCampo("linkListasUrl", valor)}
            />
          </CardContent>
        </Card>
      ) : null}

      {tab === "auditoria" ? (
        <Card>
          <CardHeader className="border-b border-border pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-primary">
                <History className="h-4 w-4" />
                <span>Auditoría reciente</span>
              </CardTitle>
              <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.NEUTRAL}`}>
                <span>Últimos movimientos</span>
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-4">
            {auditoria.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <AlertCircle className="h-7 w-7 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Aún no hay movimientos de configuración.</p>
              </div>
            ) : (
              auditoria.map((item) => (
                <div key={item.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-foreground">{item.actor ?? "Sistema"}</p>
                    <span className="text-[10px] text-muted-foreground">{dateUtils.formatDateTime(item.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-primary">{item.mensaje}</p>
                  {item.entidad ? (
                    <p className="mt-1 text-[10px] text-muted-foreground">Entidad: {item.entidad}</p>
                  ) : null}
                </div>
              ))
            )}
            <div className="border-t border-border pt-3">
              <Button type="button" variant="ghost" size="sm" className="w-full gap-1.5 text-xs" onClick={() => { void refrescarAuditoria(); }}>
                <span>Actualizar auditoría</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary/30 p-3">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Los cambios aplican al módulo completo. Los plazos y reglas quedan registrados en auditoría.
        </p>
      </div>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (valor: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg p-3 transition-colors hover:bg-secondary/40">
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function LinkField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (valor: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs"><span>{label}</span></Label>
      <Input
        type="url"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder="https://..."
        className="mt-1 h-9 text-sm"
      />
    </div>
  );
}



