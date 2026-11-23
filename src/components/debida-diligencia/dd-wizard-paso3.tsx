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
  CheckCircle2,
  Info,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { PaisSelect } from "@/components/shared/pais-select";
import {
  BADGE_STYLES,
  DD_PORCENTAJE_MAX,
  DD_TIPO_VINCULO_PERSONA_LABELS,
  DD_TIPOS_DOCUMENTO_REPRESENTANTE,
  DD_TIPOS_DOCUMENTO_VINCULO,
  DD_TIPOS_DOCUMENTO_VINCULO_PERSONA,
  DD_TIPOS_VINCULO_PERSONA,
  type DdTipoVinculoPersona,
} from "@/lib/shared/constants";
import {
  esEmpresaVinculada,
  tipoDocumentoEmpresaVinculada,
  tipoDocumentoVinculoConConsulta,
} from "@/lib/shared/utils/debida-diligencia-v2";
import { esPaisPeru } from "@/lib/shared/utils/pais";
import type { BeneficiarioForm, FormState } from "./dd-wizard";

interface Props {
  form: FormState;
  setCampo: <K extends keyof FormState>(campo: K, valor: FormState[K]) => void;
  beneficiarios: BeneficiarioForm[];
  beneficiariosValidados: Record<string, "DNI" | "RUC">;
  buscandoBeneficiario: string | null;
  buscandoRepresentante: boolean;
  representanteValidado: "DNI" | "RUC" | null;
  observacionesRepresentante: string[];
  observacionesVinculoFaltante: string[];
  observacionesBeneficiario: Record<string, string[]>;
  actualizarDocumentoRepresentante: (valor: string) => void;
  cambiarNacionalidadRepresentante: (valor: string) => void;
  cambiarTipoDocumentoRepresentante: (valor: string) => void;
  actualizarDocumentoBeneficiario: (beneficiario: BeneficiarioForm, valor: string) => void;
  buscarBeneficiario: (beneficiario: BeneficiarioForm) => void;
  cambiarBeneficiario: (id: string, campo: keyof Omit<BeneficiarioForm, "id">, valor: string) => void;
  agregarBeneficiario: () => void;
  quitarBeneficiario: (id: string) => void;
}

export function DdWizardPaso3({
  form,
  setCampo,
  beneficiarios,
  beneficiariosValidados,
  buscandoBeneficiario,
  buscandoRepresentante,
  representanteValidado,
  observacionesRepresentante,
  observacionesVinculoFaltante,
  observacionesBeneficiario,
  actualizarDocumentoRepresentante,
  cambiarNacionalidadRepresentante,
  cambiarTipoDocumentoRepresentante,
  actualizarDocumentoBeneficiario,
  buscarBeneficiario,
  cambiarBeneficiario,
  agregarBeneficiario,
  quitarBeneficiario,
}: Props) {
  const totalVinculosObservados =
    (observacionesRepresentante.length > 0 ? 1 : 0) +
    (observacionesVinculoFaltante.length > 0 ? 1 : 0) +
    Object.values(observacionesBeneficiario).filter((textos) => textos.length > 0).length;

  return (
    <div className="space-y-7">
      <section className="space-y-4" aria-labelledby="dd-paso3-representante">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h2 id="dd-paso3-representante" className="flex items-center gap-2 text-sm font-semibold text-primary">
              <UserRound className="h-4 w-4" />
              <span>Representante legal principal</span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Persona que actúa en nombre de la empresa y recibe las comunicaciones del proceso.
            </p>
          </div>
          <Badge className={`pointer-events-none text-[10px] ${observacionesRepresentante.length > 0 ? BADGE_STYLES.WARNING : BADGE_STYLES.NEUTRAL}`}>
            <span>{observacionesRepresentante.length > 0 ? "Observado" : "Obligatorio"}</span>
          </Badge>
        </div>

        {observacionesRepresentante.length > 0 ? (
          <div className="rounded-lg border border-warning/40 bg-warning/5 p-3">
            <p className="text-xs font-semibold text-warning">Logística observó al representante legal</p>
            <ul className="mt-1 list-inside list-disc space-y-1 text-xs text-foreground">
              {observacionesRepresentante.map((texto) => (
                <li key={texto}>{texto}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-4 rounded-xl border border-border bg-secondary/20 p-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs"><span>Nacionalidad *</span></Label>
            <PaisSelect
              id="representanteNacionalidad"
              value={form.representanteNacionalidad}
              onChange={cambiarNacionalidadRepresentante}
              valueMode="nombre"
              mostrarCodigo={false}
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs"><span>Nombre y apellidos completos *</span></Label>
            <Input
              value={form.representanteNombre}
              onChange={(event) => setCampo("representanteNombre", event.target.value)}
              className="mt-1 h-9 text-sm"
              placeholder="Nombres y apellidos del representante"
            />
          </div>
          <div>
            <Label className="text-xs"><span>Tipo de documento *</span></Label>
            <Select
              value={form.representanteTipoDocumento}
              onValueChange={cambiarTipoDocumentoRepresentante}
            >
              <SelectTrigger className="mt-1 h-9 w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(DD_TIPOS_DOCUMENTO_REPRESENTANTE).map((tipo) => (
                  <SelectItem key={tipo} value={tipo}><span>{tipo}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs"><span>Número de documento *</span></Label>
            <Input
              value={form.representanteDocumento}
              onChange={(event) => actualizarDocumentoRepresentante(event.target.value)}
              className="mt-1 h-9 font-mono text-sm"
              inputMode={esPaisPeru(form.representanteNacionalidad) ? "numeric" : "text"}
              autoComplete="off"
              placeholder="DNI, carnet o pasaporte"
            />
            {!esPaisPeru(form.representanteNacionalidad) ? (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Para nacionalidad distinta a Perú no se consulta RENIEC/SUNAT.
              </p>
            ) : null}
            {buscandoRepresentante ? (
              <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Consultando RENIEC / SUNAT...</span>
              </p>
            ) : representanteValidado ? (
              <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-success">
                <CheckCircle2 className="h-3 w-3" />
                <span>Validado con {representanteValidado === "DNI" ? "RENIEC" : "SUNAT"}</span>
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {observacionesVinculoFaltante.length > 0 ? (
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-3">
          <p className="text-xs font-semibold text-warning">Falta agregar un vínculo</p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-xs text-foreground">
            {observacionesVinculoFaltante.map((texto) => (
              <li key={texto}>{texto}</li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Usa “Agregar vínculo” en la sección siguiente y registra los datos solicitados.
          </p>
        </div>
      ) : null}

      <section className="space-y-4 border-t border-border pt-6" aria-labelledby="dd-paso3-vinculos">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
          <div>
            <h2 id="dd-paso3-vinculos" className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Users className="h-4 w-4" />
              <span>Otras personas naturales o jurídicas vinculadas</span>
              <Badge className="pointer-events-none text-[10px]">{beneficiarios.length} registro(s)</Badge>
              {totalVinculosObservados > 0 ? (
                <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.WARNING}`}>
                  <span>{totalVinculosObservados} observado(s)</span>
                </Badge>
              ) : null}
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              Declare las personas naturales o jurídicas vinculadas a la empresa en caso aplique alguna de ellas (representantes legales, apoderados, directores, gerentes, beneficiarios finales, accionistas o socios con 10% o más de participación).
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={agregarBeneficiario}>
            <Plus className="h-3.5 w-3.5" />
            <span>Agregar vínculo</span>
          </Button>
        </div>

        {beneficiarios.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-8 text-center">
            <Users className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-xs font-medium text-foreground">No se declararon personas vinculadas</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Agregue un vínculo si corresponde a un representante, apoderado, director, socio, beneficiario o empresa vinculada.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {beneficiarios.map((beneficiario, indice) => {
              const empresaVinculada = esEmpresaVinculada(beneficiario.tipoVinculoPersona);
              const observacionesVinculo = observacionesBeneficiario[beneficiario.id] ?? [];
              const tipoConsulta = tipoDocumentoVinculoConConsulta(
                beneficiario.tipoVinculoPersona,
                beneficiario.tipoDocumento,
              );
              const consultaPermitida = esPaisPeru(beneficiario.nacionalidad) && tipoConsulta !== null;
              const tituloConsulta = !esPaisPeru(beneficiario.nacionalidad)
                ? "Solo se consulta RENIEC/SUNAT para vínculos con nacionalidad peruana."
                : tipoConsulta === "RUC"
                  ? "Buscar RUC en SUNAT"
                  : tipoConsulta === "DNI"
                    ? "Buscar DNI en RENIEC"
                    : "La consulta solo aplica a DNI o RUC.";
              return (
              <div
                key={beneficiario.id}
                className={`overflow-hidden rounded-xl border bg-card ${
                  observacionesVinculo.length > 0 ? "border-warning ring-2 ring-warning/20" : "border-border"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/30 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-foreground">Vínculo {indice + 1}</span>
                    {beneficiario.tipoVinculoPersona ? (
                      <Badge className={`pointer-events-none text-[9px] ${BADGE_STYLES.NEUTRAL}`}>
                        <span>{DD_TIPO_VINCULO_PERSONA_LABELS[beneficiario.tipoVinculoPersona as DdTipoVinculoPersona] ?? beneficiario.tipoVinculoPersona}</span>
                      </Badge>
                    ) : (
                      <Badge className={`pointer-events-none text-[9px] ${BADGE_STYLES.WARNING}`}>
                        <span>Sin tipo</span>
                      </Badge>
                    )}
                    <Badge className={`pointer-events-none text-[9px] ${BADGE_STYLES.INFO}`}>
                      <span>Declarado</span>
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 p-1.5 text-[10px] text-destructive hover:text-destructive"
                    onClick={() => quitarBeneficiario(beneficiario.id)}
                    aria-label={`Eliminar vínculo ${indice + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Eliminar</span>
                  </Button>
                </div>

                {observacionesVinculo.length > 0 ? (
                  <div className="border-b border-warning/30 bg-warning/5 px-3 py-2">
                    <p className="text-[11px] font-semibold text-warning">Logística observó este vínculo</p>
                    <ul className="mt-1 list-inside list-disc space-y-1 text-[11px] text-foreground">
                      {observacionesVinculo.map((texto) => (
                        <li key={texto}>{texto}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="grid gap-3 p-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-[11px]"><span>Nacionalidad *</span></Label>
                    <PaisSelect
                      id={`beneficiarioNacionalidad-${beneficiario.id}`}
                      value={beneficiario.nacionalidad}
                      onChange={(valor) => cambiarBeneficiario(beneficiario.id, "nacionalidad", valor)}
                      valueMode="nombre"
                      mostrarCodigo={false}
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]"><span>Tipo de documento *</span></Label>
                    <Select
                      value={beneficiario.tipoDocumento}
                      onValueChange={(valor) => cambiarBeneficiario(beneficiario.id, "tipoDocumento", valor)}
                      disabled={empresaVinculada}
                    >
                      <SelectTrigger className="mt-1 h-8 w-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(empresaVinculada
                          ? [tipoDocumentoEmpresaVinculada(beneficiario.nacionalidad)]
                          : DD_TIPOS_DOCUMENTO_VINCULO_PERSONA
                        ).map((tipo) => (
                          <SelectItem key={tipo} value={tipo}>
                            <span>{tipo}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {empresaVinculada ? (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {esPaisPeru(beneficiario.nacionalidad) || !beneficiario.nacionalidad
                          ? "La empresa vinculada peruana se identifica con RUC."
                          : "La empresa vinculada extranjera se identifica con RUT (identificador tributario de su país)."}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <Label className="text-[11px]"><span>Documento *</span></Label>
                    <div className="mt-1 flex items-center gap-2">
                      <Input
                        value={beneficiario.documento}
                        onChange={(event) => actualizarDocumentoBeneficiario(beneficiario, event.target.value)}
                        className="h-8 w-full font-mono text-xs"
                        placeholder={
                          beneficiario.tipoDocumento === DD_TIPOS_DOCUMENTO_VINCULO.RUC
                            ? "RUC de 11 dígitos"
                            : beneficiario.tipoDocumento === DD_TIPOS_DOCUMENTO_VINCULO.DNI
                              ? "DNI de 8 dígitos"
                              : beneficiario.tipoDocumento === DD_TIPOS_DOCUMENTO_VINCULO.RUT
                                ? "RUT / identificador tributario"
                                : "N.º de documento"
                        }
                        inputMode={
                          beneficiario.tipoDocumento === DD_TIPOS_DOCUMENTO_VINCULO.RUC ||
                          beneficiario.tipoDocumento === DD_TIPOS_DOCUMENTO_VINCULO.DNI
                            ? "numeric"
                            : "text"
                        }
                        autoComplete="off"
                        maxLength={
                          beneficiario.tipoDocumento === DD_TIPOS_DOCUMENTO_VINCULO.RUC
                            ? 11
                            : beneficiario.tipoDocumento === DD_TIPOS_DOCUMENTO_VINCULO.DNI
                              ? 8
                              : 20
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 shrink-0 p-0"
                        disabled={!consultaPermitida || buscandoBeneficiario === beneficiario.id}
                        onClick={() => buscarBeneficiario(beneficiario)}
                        title={tituloConsulta}
                        aria-label={`Buscar documento del vínculo ${indice + 1}`}
                      >
                        {buscandoBeneficiario === beneficiario.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Search className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    {!esPaisPeru(beneficiario.nacionalidad) ? (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {beneficiario.nacionalidad
                          ? "Documento del país de origen; no se consulta RENIEC/SUNAT."
                          : "Seleccione la nacionalidad para habilitar la consulta."}
                      </p>
                    ) : null}
                    {buscandoBeneficiario === beneficiario.id ? (
                      <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Consultando RENIEC / SUNAT...</span>
                      </p>
                    ) : beneficiariosValidados[beneficiario.id] ? (
                      <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-success">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Validado con {beneficiariosValidados[beneficiario.id] === "DNI" ? "RENIEC" : "SUNAT"}</span>
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <Label className="text-[11px]"><span>Nombre o razón social *</span></Label>
                    <Input
                      value={beneficiario.nombre}
                      onChange={(event) => cambiarBeneficiario(beneficiario.id, "nombre", event.target.value)}
                      className="mt-1 h-8 text-xs"
                      placeholder="Nombre completo o razón social"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]"><span>Tipo de vínculo *</span></Label>
                    <Select
                      value={beneficiario.tipoVinculoPersona || undefined}
                      onValueChange={(valor) => cambiarBeneficiario(beneficiario.id, "tipoVinculoPersona", valor)}
                    >
                      <SelectTrigger className="mt-1 h-8 w-full text-xs">
                        <SelectValue placeholder="Seleccione el tipo de vínculo" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(DD_TIPOS_VINCULO_PERSONA).map((tipo) => (
                          <SelectItem key={tipo} value={tipo}>
                            <span>{DD_TIPO_VINCULO_PERSONA_LABELS[tipo]}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[11px]"><span>Participación</span></Label>
                    <div className="relative mt-1">
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={DD_PORCENTAJE_MAX}
                        step={0.01}
                        value={beneficiario.porcentaje}
                        onChange={(event) => cambiarBeneficiario(beneficiario.id, "porcentaje", event.target.value)}
                        className="h-8 w-full pr-7 text-xs"
                      />
                      <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] text-muted-foreground">
                        %
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">Opcional; 0% por defecto.</p>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}

        <div className="flex items-start gap-3 rounded-lg border border-gold-soft/60 border-l-[3px] border-l-gold bg-gold/10 p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <p className="text-xs leading-relaxed text-foreground">
            Esta información se contrasta con registros públicos y listas restrictivas. Si una persona o empresa supera el 10% de participación, se evalúa como beneficiario final o socio relevante.
          </p>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/30 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-xs leading-relaxed text-foreground">
            El representante legal y las personas vinculadas son sujetos evaluados dentro del expediente de la empresa.
          </p>
        </div>
      </section>
    </div>
  );
}





