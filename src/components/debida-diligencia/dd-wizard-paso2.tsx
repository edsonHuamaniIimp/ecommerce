"use client";

import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nrivera-iimp/ui-kit-iimp";
import {
  Building2,
  CheckCircle2,
  Globe2,
  Handshake,
  Info,
  Mail,
  Plus,
} from "lucide-react";
import {
  BADGE_STYLES,
  DD_ACTIVIDADES_ECONOMICAS,
  DD_ACTIVIDAD_OTRO,
  DD_VINCULO_LABELS,
  DD_VINCULOS,
  type DdVinculo,
} from "@/lib/shared/constants";
import type { DdEmpresaDTO } from "@/types/dto/debida-diligencia";
import type { FormState } from "./dd-wizard";

interface Props {
  empresa: DdEmpresaDTO | null;
  form: FormState;
  setCampo: <K extends keyof FormState>(campo: K, valor: FormState[K]) => void;
}

const VINCULOS_PRINCIPALES: DdVinculo[] = [
  DD_VINCULOS.EXHIBIDOR,
  DD_VINCULOS.AUSPICIADOR,
  DD_VINCULOS.PROVEEDOR,
];

const VINCULOS_SECUNDARIOS: DdVinculo[] = [
  DD_VINCULOS.ASOCIADO_ADHERENTE,
  DD_VINCULOS.MEDIA_PARTNER,
  DD_VINCULOS.ALQUILERES,
  DD_VINCULOS.OTRO,
];

const DESCRIPCIONES: Partial<Record<DdVinculo, string>> = {
  [DD_VINCULOS.EXHIBIDOR]: "Stands, pabellón técnico y conferencias comerciales.",
  [DD_VINCULOS.AUSPICIADOR]: "Categorías Diamante, Platino, Oro o sesiones oficiales.",
  [DD_VINCULOS.PROVEEDOR]: "Servicios generales, logística, montaje o suministros.",
  [DD_VINCULOS.ASOCIADO_ADHERENTE]: "Vínculo institucional con la asociación.",
  [DD_VINCULOS.MEDIA_PARTNER]: "Difusión y cobertura del evento.",
  [DD_VINCULOS.ALQUILERES]: "Alquiler de espacios o servicios del recinto.",
  [DD_VINCULOS.OTRO]: "Otro alcance comercial no listado.",
};

export function DdWizardPaso2({ empresa, form, setCampo }: Props) {
  const alternarVinculo = (vinculo: DdVinculo) => {
    const marcado = form.tipoRelacionComercial.includes(vinculo);
    setCampo(
      "tipoRelacionComercial",
      marcado
        ? form.tipoRelacionComercial.filter((item) => item !== vinculo)
        : [...form.tipoRelacionComercial, vinculo],
    );
  };

  return (
    <div className="space-y-7">
      <section className="space-y-4" aria-labelledby="dd-paso2-empresa">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h2 id="dd-paso2-empresa" className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Building2 className="h-4 w-4" />
              <span>Datos de la empresa</span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Información registrada en el portal y validada contra SUNAT.
            </p>
          </div>
          <Badge className={`pointer-events-none gap-1 text-[10px] ${BADGE_STYLES.SUCCESS}`}>
            <CheckCircle2 className="h-3 w-3" />
            <span>Validado SUNAT</span>
          </Badge>
        </div>

        <div className="grid gap-4 rounded-xl border border-border bg-secondary/20 p-4 md:grid-cols-2">
          <div>
            <Label className="text-xs"><span>Razón social</span></Label>
            <Input value={empresa?.razonSocial ?? ""} readOnly className="mt-1 h-9 bg-secondary text-sm" />
          </div>
          <div>
            <Label className="text-xs"><span>RUC</span></Label>
            <Input value={empresa?.ruc ?? ""} readOnly className="mt-1 h-9 bg-secondary font-mono text-sm" />
          </div>
          <div>
            <Label className="text-xs"><span>País de constitución *</span></Label>
            <div className="relative mt-1">
              <Globe2 className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={form.paisConstitucion}
                onChange={(event) => setCampo("paisConstitucion", event.target.value)}
                className="h-9 pl-9 text-sm"
                placeholder="Perú"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs"><span>Actividad económica principal *</span></Label>
            <Select
              value={form.actividadEconomica || undefined}
              onValueChange={(valor) => setCampo("actividadEconomica", valor)}
            >
              <SelectTrigger className="mt-1 h-9 w-full text-sm">
                <SelectValue placeholder="Seleccione el sector" />
              </SelectTrigger>
              <SelectContent>
                {DD_ACTIVIDADES_ECONOMICAS.map((actividad) => (
                  <SelectItem key={actividad} value={actividad}>
                    <span>{actividad}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.actividadEconomica === DD_ACTIVIDAD_OTRO ? (
            <div className="md:col-span-2">
              <Label className="text-xs"><span>En caso de haber marcado Otro, indicar cuál *</span></Label>
              <Input
                value={form.actividadEconomicaOtro}
                onChange={(event) => setCampo("actividadEconomicaOtro", event.target.value)}
                className="mt-1 h-9 text-sm"
                placeholder="Detalle la actividad económica"
              />
            </div>
          ) : null}

          <div>
            <Label className="text-xs"><span>Sitio web de la empresa *</span></Label>
            <Input
              value={form.sitioWeb}
              onChange={(event) => setCampo("sitioWeb", event.target.value)}
              className="mt-1 h-9 text-sm"
              placeholder="https://www.empresa.com"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Se usa para la revisión reputacional de Comunicaciones.
            </p>
          </div>
          <div>
            <Label className="text-xs"><span>Correo de contacto del representante legal *</span></Label>
            <div className="relative mt-1">
              <Mail className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                value={form.emailRepresentante}
                onChange={(event) => setCampo("emailRepresentante", event.target.value)}
                className="h-9 pl-9 text-sm"
                placeholder="representante@empresa.com"
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Aquí recibirá las observaciones de Logística o Legal.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-border pt-6" aria-labelledby="dd-paso2-vinculos">
        <div className="border-b border-border pb-3">
          <h2 id="dd-paso2-vinculos" className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Handshake className="h-4 w-4" />
            <span>Vínculos comerciales declarados</span>
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Puede registrar más de un vínculo. Cada uno se evalúa por separado según los lineamientos de cumplimiento del IIMP.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {VINCULOS_PRINCIPALES.map((vinculo) => {
            const marcado = form.tipoRelacionComercial.includes(vinculo);
            return (
              <button
                key={vinculo}
                type="button"
                aria-pressed={marcado}
                onClick={() => alternarVinculo(vinculo)}
                className={`relative flex min-h-28 flex-col justify-between rounded-xl border-2 p-4 text-left transition-colors ${
                  marcado
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/40 hover:bg-secondary/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`grid h-5 w-5 place-items-center rounded border ${
                      marcado ? "border-primary bg-primary text-white" : "border-border bg-card"
                    }`}
                  >
                    {marcado ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                  </span>
                  <span className={`text-[10px] font-semibold ${marcado ? "text-primary" : "text-muted-foreground"}`}>
                    {marcado ? "Activo" : "Disponible"}
                  </span>
                </div>
                <div className="mt-3">
                  <p className={`text-sm font-bold ${marcado ? "text-primary" : "text-foreground"}`}>
                    {DD_VINCULO_LABELS[vinculo]}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    {DESCRIPCIONES[vinculo]}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Otros vínculos institucionales complementarios:
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {VINCULOS_SECUNDARIOS.map((vinculo) => {
              const marcado = form.tipoRelacionComercial.includes(vinculo);
              return (
                <Button
                  key={vinculo}
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-pressed={marcado}
                  className={`h-8 gap-1.5 rounded-lg text-xs ${
                    marcado ? "border-primary bg-primary/5 text-primary" : "text-muted-foreground"
                  }`}
                  onClick={() => alternarVinculo(vinculo)}
                >
                  {marcado ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  <span>{DD_VINCULO_LABELS[vinculo]}</span>
                </Button>
              );
            })}
          </div>
          {form.tipoRelacionComercial.includes(DD_VINCULOS.OTRO) ? (
            <div className="space-y-1.5 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <Label className="text-xs">
                <span>Detalle del vínculo comercial “Otro” *</span>
              </Label>
              <Input
                value={form.tipoRelacionComercialOtro}
                onChange={(event) => setCampo("tipoRelacionComercialOtro", event.target.value)}
                className="h-9 text-sm"
                placeholder="Ej. convenio de cooperación, canje, organización de actividad..."
              />
              <p className="text-[11px] text-muted-foreground">
                Indique el tipo o alcance del vínculo para que el equipo de cumplimiento pueda evaluarlo.
              </p>
            </div>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            {form.tipoRelacionComercial.length} vínculo(s) seleccionado(s).
          </p>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-gold-soft/60 border-l-[3px] border-l-gold bg-gold/10 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <p className="text-xs leading-relaxed text-foreground">
            Puede reservar un stand, pero no avanzará en las aprobaciones hasta completar la debida diligencia.
          </p>
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/30 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-foreground">
          Los vínculos comerciales describen la relación con el IIMP. Las personas y empresas vinculadas se declaran en el siguiente paso.
        </p>
      </div>
    </div>
  );
}
