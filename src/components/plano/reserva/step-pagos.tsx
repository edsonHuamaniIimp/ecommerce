"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, CheckCircle2, CreditCard, FileSignature, FileText, ShieldCheck } from "lucide-react";
import { Input, Label } from "@nrivera-iimp/ui-kit-iimp";
import { BADGE_STYLES, MODALIDADES_CUOTAS, MONEDAS, PORCENTAJES_POR_MODALIDAD, VALIDACIONES, type ModalidadCuotas } from "@/lib/shared/constants";
import { calcularImportes } from "@/lib/shared/utils/importes";
import { configCuotasValida, cronogramaPredeterminado, cronogramaValido, cuotasCoincidenConfig, cuotasPersonalizadasIniciales, cuotasPredeterminadas, planCuotasConFechas, porcentajesValidos, type ConfigCuotasEmpresa } from "@/lib/shared/utils/cuotas";
import { numberUtils } from "@/lib/shared/utils/number";
import { dateUtils } from "@/lib/shared/utils/date";
import { sunatService } from "@/lib/client/api/services/sunat-service";
import { datosContratoValidos } from "./interfaces";
import type { DatosContratoForm } from "./interfaces";
import type { CuotaConfig } from "./use-reserva-form";

interface Props {
  /** Precios netos (USD) de los stands seleccionados. */
  precios: number[];
  /** Cronograma personalizado de la empresa (Modalidad 4), si existe. */
  configCuotas: ConfigCuotasEmpresa | null;
  /** Cuotas configuradas por el cliente: porcentaje + fecha (1..N, hasta 9). */
  cuotas: CuotaConfig[];
  onCuotasChange: (cuotas: CuotaConfig[]) => void;
  /** Datos del exhibidor que van al cuerpo del contrato. */
  contratoDatos: DatosContratoForm;
  onContratoDatosChange: (datos: DatosContratoForm) => void;
  /** Contrato generado (se muestra el aviso cuando ya existe). */
  contrato: { docxUrl: string; pdfUrl: string | null } | null;
  /** El contrato se firma al final; aqui solo se configuran cuotas. */
  sinContrato?: boolean;
}

const OPCIONES: Array<{ cantidad: ModalidadCuotas; etiqueta: string; detalle: string }> = [
  { cantidad: MODALIDADES_CUOTAS.UNA, etiqueta: "1 cuota", detalle: "100% del total" },
  { cantidad: MODALIDADES_CUOTAS.DOS, etiqueta: "2 cuotas", detalle: "50% / 50%" },
  { cantidad: MODALIDADES_CUOTAS.TRES, etiqueta: "3 cuotas", detalle: "40% / 30% / 30%" },
];

/**
 * Paso 2: el cliente elige una modalidad de pago fija. Las fechas y porcentajes
 * los determina el cronograma del contrato; no se editan a mano.
 */
export function StepPagos({ precios, configCuotas, cuotas, onCuotasChange, contratoDatos, onContratoDatosChange, contrato, sinContrato = true }: Props) {
  const neto = precios.reduce((s, p) => s + p, 0);
  const importes = calcularImportes(neto);
  const moneda = MONEDAS.USD;
  const hoy = dateUtils.todayLimaInputValue();
  const contratoOk = datosContratoValidos(contratoDatos);
  /* Lookups del API: RUC (SUNAT) y DNI del representante (RENIEC). */
  const [repValidado, setRepValidado] = useState(false);
  const repEditedRef = useRef(false);
  const [rucValidado, setRucValidado] = useState(false);
  const rucEditedRef = useRef(false);

  const setContratoCampo = (campo: keyof DatosContratoForm, valor: string) => {
    onContratoDatosChange({ ...contratoDatos, [campo]: valor });
  };

  /* DNI del representante (8 digitos): RENIEC autocompleta su nombre. */
  useEffect(() => {
    const dni = contratoDatos.representanteDni;
    if (!repEditedRef.current || dni.length !== VALIDACIONES.DNI_LONGITUD) return;
    repEditedRef.current = false;
    sunatService
      .consultarDni(dni)
      .then((r) => {
        if (r.nombreCompleto) {
          onContratoDatosChange({ ...contratoDatos, representanteDni: dni, representante: r.nombreCompleto });
          setRepValidado(true);
        }
      });
  }, [contratoDatos]); // eslint-disable-line react-hooks/exhaustive-deps

  /* RUC del exhibidor (11 digitos): SUNAT autocompleta razon social y domicilio fiscal. */
  useEffect(() => {
    const ruc = contratoDatos.ruc;
    if (!rucEditedRef.current || ruc.length !== VALIDACIONES.RUC_LONGITUD) return;
    rucEditedRef.current = false;
    sunatService
      .consultarRuc(ruc)
      .then((r) => {
        if (r.razonSocial) {
          onContratoDatosChange({
            ...contratoDatos,
            ruc,
            razonSocial: r.razonSocial,
            ...(r.direccion ? { direccion: r.direccion } : {}),
          });
          setRucValidado(true);
        }
      });
  }, [contratoDatos]); // eslint-disable-line react-hooks/exhaustive-deps

  const opciones = useMemo(
    () =>
      OPCIONES.map((opcion) => ({
        ...opcion,
        porcentajes: [...PORCENTAJES_POR_MODALIDAD[opcion.cantidad]],
        fechas: cronogramaPredeterminado(opcion.cantidad, hoy),
      })),
    [hoy],
  );

  const personalizado = configCuotasValida(configCuotas, hoy);
  const seleccionada = opciones.find((opcion) =>
    opcion.fechas &&
    cuotas.length === opcion.fechas.length &&
    cuotas.every((cuota, i) => cuota.porcentaje === opcion.porcentajes[i] && cuota.fecha === opcion.fechas?.[i]),
  );

  const porcentajes = cuotas.map((c) => c.porcentaje);
  const fechas = cuotas.map((c) => c.fecha);
  const plan = planCuotasConFechas(importes.total, porcentajes, fechas);
  const programadas = cuotas.map((c) => ({ porcentaje: c.porcentaje, fechaVencimiento: c.fecha }));
  const valido = cuotas.length > 0 && (personalizado
    ? cuotasCoincidenConfig(programadas, configCuotas, hoy)
    : cronogramaValido(programadas, hoy));

  /* Si el cronograma de fechas quedo obsoleto (p. ej. cambio el dia), reaplicarlo.
     En modalidad personalizada no se pisan los porcentajes mientras el cliente edita. */
  useEffect(() => {
    if (valido) return;
    if (personalizado) {
      if (!configCuotas) return;
      const fechasOk = cuotas.length === configCuotas.maxCuotas
        && cuotas.every((cuota, i) => cuota.fecha === configCuotas.fechas[i]);
      if (fechasOk) return;
      const config = cuotasPersonalizadasIniciales(configCuotas, hoy);
      if (config) onCuotasChange(config);
      return;
    }
    const primera = opciones.find((opcion) => opcion.fechas);
    if (!primera) return;
    const config = cuotasPredeterminadas(primera.cantidad, hoy);
    if (config) onCuotasChange(config);
  }, [valido, hoy, opciones, onCuotasChange, personalizado, configCuotas, cuotas]);

  const setPorcentaje = (idx: number, valor: number) => {
    const numero = Number.isFinite(valor) ? Math.max(0, Math.min(100, valor)) : 0;
    onCuotasChange(cuotas.map((cuota, i) => (i === idx ? { ...cuota, porcentaje: Math.round(numero * 100) / 100 } : cuota)));
  };

  const aplicarModalidad = (cantidad: ModalidadCuotas) => {
    const config = cuotasPredeterminadas(cantidad, hoy);
    if (config) onCuotasChange(config);
  };

  const fechaVisible = (fecha: string) => dateUtils.format(fecha, { idioma: "es" });

  return (
    <div className="flex flex-col gap-3 pt-3">
      <div className="flex items-start gap-3 rounded-xl border border-info/30 bg-info/10 px-3.5 py-3">
        <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-info" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Elige la modalidad de pago. El porcentaje y las fechas de cada cuota se toman del
          cronograma del contrato y no se editan manualmente.
        </p>
      </div>

      {/* Resumen de importes */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-secondary px-3 py-2 text-[10px] font-semibold tracking-wider text-primary uppercase">
          Importe
        </div>
        <div className="space-y-1.5 px-3 py-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Valor venta (neto)</span>
            <span className="font-medium text-foreground">{numberUtils.monto(importes.valorVenta, moneda, { decimales: 2 })}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">IGV (18%)</span>
            <span className="font-medium text-foreground">{numberUtils.monto(importes.igv, moneda, { decimales: 2 })}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-1.5 text-sm">
            <span className="font-semibold text-foreground">Total a pagar</span>
            <span className="font-bold text-primary">{numberUtils.monto(importes.total, moneda, { decimales: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Cronograma personalizado de la empresa (Modalidad 4) */}
      {personalizado && configCuotas && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary px-3 py-2">
            <span className="flex items-center gap-2 text-[10px] font-semibold tracking-wider text-primary uppercase">
              <CalendarClock className="h-3.5 w-3.5" />
              Cronograma configurado por el IIMP
            </span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              Modalidad 4
            </span>
          </div>
          <div className="space-y-3 px-3 py-3">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Estas son las cuotas y fechas asignadas a tu empresa. Puedes ajustar el
              porcentaje de cada cuota; la suma debe ser 100%.
            </p>
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="grid grid-cols-[auto_1fr_auto] gap-2 border-b border-border bg-secondary/60 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                <span>Cuota</span>
                <span>Vencimiento</span>
                <span className="text-right">Porcentaje / monto</span>
              </div>
              {plan.map((cuota, i) => (
                <div key={cuota.numero} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-border/60 px-3 py-2 text-xs last:border-b-0">
                  <span className="font-semibold text-foreground">{cuota.numero}</span>
                  <span className="text-muted-foreground">{fechaVisible(cuota.fechaVencimiento ?? "")}</span>
                  <span className="flex items-center justify-end gap-1.5">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={String(cuota.porcentaje)}
                      onChange={(e) => setPorcentaje(i, Number(e.target.value))}
                      className="h-7 w-[68px] text-center text-xs"
                    />
                    <span className="text-muted-foreground">%</span>
                    <span className="w-20 text-right font-semibold text-foreground">
                      {numberUtils.monto(cuota.monto, moneda, { decimales: 2 })}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className={porcentajesValidos(porcentajes, configCuotas?.maxCuotas) ? "text-success" : "text-warning"}>
                Suma: {Math.round(porcentajes.reduce((s, p) => s + p, 0) * 100) / 100}% de 100%
              </span>
              {!porcentajesValidos(porcentajes, configCuotas?.maxCuotas) && <span className="text-warning">Ajusta los porcentajes para continuar.</span>}
            </div>
          </div>
        </div>
      )}

      {/* Modalidades fijas */}
      {!personalizado && (
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary px-3 py-2">
          <span className="flex items-center gap-2 text-[10px] font-semibold tracking-wider text-primary uppercase">
            <CalendarClock className="h-3.5 w-3.5" />
            Modalidad de pago
          </span>
          {seleccionada && (
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
              {seleccionada.etiqueta}
            </span>
          )}
        </div>
        <div className="space-y-3 px-3 py-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {opciones.map((opcion) => {
              const activa = seleccionada?.cantidad === opcion.cantidad;
              return (
                <button
                  key={opcion.cantidad}
                  type="button"
                  aria-pressed={activa}
                  disabled={!opcion.fechas}
                  onClick={() => aplicarModalidad(opcion.cantidad)}
                  className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                    activa
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                      : "border-border bg-secondary/40 hover:border-primary/50"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <span className="block text-xs font-bold text-foreground">{opcion.etiqueta}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{opcion.detalle}</span>
                  <span className="mt-2 block text-[10px] leading-snug text-muted-foreground">
                    {opcion.fechas ? opcion.fechas.map(fechaVisible).join(" · ") : "Cronograma vencido"}
                  </span>
                </button>
              );
            })}
          </div>

          {opciones.every((opcion) => !opcion.fechas) && (
            <p className="text-[11px] font-medium text-destructive">
              El cronograma de pagos ya venció. Contacta a Facturación del IIMP.
            </p>
          )}

          {seleccionada && (
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="grid grid-cols-[auto_1fr_1fr] gap-2 border-b border-border bg-secondary/60 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                <span>Cuota</span>
                <span>Vencimiento</span>
                <span className="text-right">Monto</span>
              </div>
              {plan.map((cuota) => (
                <div key={cuota.numero} className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 border-b border-border/60 px-3 py-2 text-xs last:border-b-0">
                  <span className="font-semibold text-foreground">{cuota.numero}. {cuota.porcentaje}%</span>
                  <span className="text-muted-foreground">{fechaVisible(cuota.fechaVencimiento ?? "")}</span>
                  <span className="text-right font-semibold text-foreground">
                    {numberUtils.monto(cuota.monto, moneda, { decimales: 2 })}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground">
            Las fechas son las pactadas en el Anexo 2. El cronograma se traslada automáticamente al contrato.
          </p>
        </div>
      </div>
      )}

      {/* Datos del exhibidor para el cuerpo del contrato */}
      {!sinContrato && (
        <>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary px-3 py-2">
          <span className="flex items-center gap-2 text-[10px] font-semibold tracking-wider text-primary uppercase">
            <FileSignature className="h-3.5 w-3.5" />
            Datos para el contrato
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${contratoOk ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
            {contratoOk ? "Completos" : "Faltan datos"}
          </span>
        </div>
        <div className="space-y-2.5 px-3 py-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Estos datos aparecerán en el contrato de exhibición (parte &ldquo;EL EXHIBIDOR&rdquo;). Revísalos y complétalos tal
            como figuran en tu ficha RUC y en el poder del representante legal. Ya cargamos lo que ingresaste en el
            paso 1; puedes corregirlo aquí.
          </p>
          <div className="space-y-1">
            <Label htmlFor="contratoRazonSocial" className="text-[11px] font-medium text-muted-foreground"><span>Razón social / nombre del exhibidor *</span></Label>
            <Input id="contratoRazonSocial" className="h-9 text-sm" maxLength={200} value={contratoDatos.razonSocial}
              onChange={(e) => setContratoCampo("razonSocial", e.target.value)} placeholder="Ej. Corporación Minera S.A.C." />
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="contratoRuc" className="text-[11px] font-medium text-muted-foreground"><span>RUC / RUT / TaxID *</span></Label>
                {rucValidado && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${BADGE_STYLES.SUCCESS}`}>
                    <ShieldCheck className="h-3 w-3" />
                    <span>Validado SUNAT</span>
                  </span>
                )}
              </div>
              <Input id="contratoRuc" className="h-9 font-mono text-sm" maxLength={20} value={contratoDatos.ruc}
                onChange={(e) => {
                  rucEditedRef.current = true;
                  setRucValidado(false);
                  setContratoCampo("ruc", e.target.value.replace(/[^\dA-Za-z]/g, "").slice(0, 20));
                }} placeholder="20123456789" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="contratoDniRep" className="text-[11px] font-medium text-muted-foreground"><span>DNI / ID del representante *</span></Label>
                {repValidado && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${BADGE_STYLES.SUCCESS}`}>
                    <ShieldCheck className="h-3 w-3" />
                    <span>Validado RENIEC</span>
                  </span>
                )}
              </div>
              <Input id="contratoDniRep" className="h-9 font-mono text-sm" maxLength={15} value={contratoDatos.representanteDni}
                onChange={(e) => {
                  repEditedRef.current = true;
                  setRepValidado(false);
                  setContratoCampo("representanteDni", e.target.value.replace(/[^\dA-Za-z]/g, "").slice(0, 15));
                }} placeholder="45871233" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="contratoDireccion" className="text-[11px] font-medium text-muted-foreground"><span>Domicilio del exhibidor *</span></Label>
            <Input id="contratoDireccion" className="h-9 text-sm" maxLength={250} value={contratoDatos.direccion}
              onChange={(e) => setContratoCampo("direccion", e.target.value)} placeholder="Av. Los Ingenieros 245, La Molina, Lima" />
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="contratoRepresentante" className="text-[11px] font-medium text-muted-foreground"><span>Representante legal (nombre completo) *</span></Label>
              <Input id="contratoRepresentante" className="h-9 text-sm" maxLength={200} value={contratoDatos.representante}
                onChange={(e) => setContratoCampo("representante", e.target.value)} placeholder="Jorge Quispe Ramos" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contratoPartida" className="text-[11px] font-medium text-muted-foreground"><span>Partida electrónica (opcional)</span></Label>
              <Input id="contratoPartida" className="h-9 font-mono text-sm" maxLength={50} value={contratoDatos.partidaElectronica}
                onChange={(e) => setContratoCampo("partidaElectronica", e.target.value)} placeholder="11014857" />
            </div>
          </div>
          {!contratoOk && (
            <p className="text-[11px] font-medium text-warning">
              Completa razón social, RUC, domicilio, representante y su DNI para poder generar el contrato.
            </p>
          )}
        </div>
      </div>

      {!sinContrato && contrato && (
        <div className="flex items-start gap-2.5 rounded-xl border border-success/30 bg-success/10 px-3.5 py-3">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Contrato generado con esta configuración. Puedes descargarlo y firmarlo en el siguiente paso.
          </p>
        </div>
      )}
        </>
      )}

      {valido && (personalizado || seleccionada) && (
        <p className="flex items-center gap-1.5 text-[11px] text-success">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>
            {personalizado
              ? `Cronograma personalizado: ${cuotas.length} cuota${cuotas.length === 1 ? "" : "s"}.`
              : `${seleccionada?.etiqueta}: ${seleccionada?.detalle}.`} Cronograma listo.
          </span>
        </p>
      )}
    </div>
  );
}
