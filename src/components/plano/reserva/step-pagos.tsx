"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarClock, CheckCircle2, CreditCard, FileSignature, FileText, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Button, Input, Label } from "@nrivera-iimp/ui-kit-iimp";
import { BADGE_STYLES, CUOTAS_DIAS_MIN_ENTRE, MAX_CUOTAS_PAGO, MONEDAS, VALIDACIONES } from "@/lib/shared/constants";
import { calcularImportes } from "@/lib/shared/utils/importes";
import { fechasCuotasEnRango, fechasCuotasValidas, fechaMaximaCuota, planCuotasConFechas, porcentajesValidos, sumarDias } from "@/lib/shared/utils/cuotas";
import { numberUtils } from "@/lib/shared/utils/number";
import { dateUtils } from "@/lib/shared/utils/date";
import { sunatService } from "@/lib/client/api/services/sunat-service";
import { datosContratoValidos } from "./interfaces";
import type { DatosContratoForm } from "./interfaces";
import type { CuotaConfig } from "./use-reserva-form";

interface Props {
  /** Precios netos (USD) de los stands seleccionados. */
  precios: number[];
  /** Cuotas configuradas por el cliente: porcentaje + fecha (1..3, suman 100%). */
  cuotas: CuotaConfig[];
  onCuotasChange: (cuotas: CuotaConfig[]) => void;
  /** Datos del exhibidor que van al cuerpo del contrato. */
  contratoDatos: DatosContratoForm;
  onContratoDatosChange: (datos: DatosContratoForm) => void;
  /** Contrato generado (se muestra el aviso cuando ya existe). */
  contrato: { docxUrl: string; pdfUrl: string | null } | null;
}

function Preset({ label, activo, onClick }: { label: string; activo: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant={activo ? "default" : "outline"}
      size="sm"
      className="h-7 rounded-full px-3 text-[11px] font-semibold"
      onClick={onClick}
    >
      <span>{label}</span>
    </Button>
  );
}

/**
 * Paso 2: el cliente configura sus cuotas de pago (hasta 3): porcentajes que suman 100%
 * y **fechas de pago** (no pasadas y en orden). Al continuar se genera el contrato.
 */
export function StepPagos({ precios, cuotas, onCuotasChange, contratoDatos, onContratoDatosChange, contrato }: Props) {
  const neto = precios.reduce((s, p) => s + p, 0);
  const importes = calcularImportes(neto);
  const moneda = MONEDAS.USD;
  const hoy = dateUtils.todayInputValue();
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

  const porcentajes = cuotas.map((c) => c.porcentaje);
  const fechas = cuotas.map((c) => c.fecha);
  const plan = planCuotasConFechas(importes.total, porcentajes, fechas);
  const suma = Math.round(porcentajes.reduce((s, p) => s + p, 0) * 100) / 100;
  const sumaOk = porcentajesValidos(porcentajes);
  const fechasOk = fechasCuotasValidas(fechas) && fechasCuotasEnRango(fechas);
  const valido = sumaOk && fechasOk;
  const esPreset1 = cuotas.length === 1 && cuotas[0]?.porcentaje === 100;
  const esPreset2 = cuotas.length === 2 && cuotas[0]?.porcentaje === 50 && cuotas[1]?.porcentaje === 50;

  /** Maximo permitido para una cuota: lo que resta para llegar a 100% (sin exceder). */
  const maxPorCuota = (idx: number) => {
    const otros = Math.round((suma - (cuotas[idx]?.porcentaje ?? 0)) * 100) / 100;
    return Math.max(0, Math.round((100 - otros) * 100) / 100);
  };

  /** Minimo permitido para la fecha de una cuota: hoy (1ra) o la anterior + separacion minima. */
  const minFechaCuota = (idx: number): string => {
    const previa = idx > 0 ? cuotas[idx - 1]?.fecha : null;
    if (!previa) return hoy;
    return sumarDias(new Date(`${previa}T00:00:00`), CUOTAS_DIAS_MIN_ENTRE);
  };

  const setPorcentaje = (idx: number, valor: number) => {
    const maximo = maxPorCuota(idx);
    const numero = Number.isFinite(valor) ? valor : 0;
    const saneado = Math.min(Math.max(numero, 0), maximo);
    onCuotasChange(cuotas.map((c, i) => (i === idx ? { ...c, porcentaje: Math.round(saneado * 100) / 100 } : c)));
  };

  const setFecha = (idx: number, valor: string) => {
    onCuotasChange(cuotas.map((c, i) => (i === idx ? { ...c, fecha: valor } : c)));
  };

  const agregarCuota = () => {
    if (cuotas.length >= MAX_CUOTAS_PAGO) return;
    const restante = Math.max(0, Math.round((100 - suma) * 100) / 100);
    if (restante < 0.01) return; // sin porcentaje disponible: no se puede agregar
    onCuotasChange([...cuotas, { porcentaje: restante, fecha: fechaMaximaCuota(cuotas.length) }]);
  };

  const quitarCuota = (idx: number) => {
    if (cuotas.length <= 1) return;
    onCuotasChange(cuotas.filter((_, i) => i !== idx));
  };

  const aplicarPreset = (porcentajesPreset: number[]) => {
    onCuotasChange(
      porcentajesPreset.map((porcentaje, i) => ({
        porcentaje,
        fecha: cuotas[i]?.fecha ?? fechaMaximaCuota(i),
      })),
    );
  };

  return (
    <div className="flex flex-col gap-3 pt-3">
      <div className="flex items-start gap-3 rounded-xl border border-info/30 bg-info/10 px-3.5 py-3">
        <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-info" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Configura tus cuotas (hasta {MAX_CUOTAS_PAGO}): porcentajes que suman 100% y sus
          fechas de pago. El contrato incluira este cronograma.
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

      {/* Configurador de cuotas */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary px-3 py-2">
          <span className="flex items-center gap-2 text-[10px] font-semibold tracking-wider text-primary uppercase">
            <CalendarClock className="h-3.5 w-3.5" />
            Configuracion de cuotas
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sumaOk ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
            {suma}% de 100%
          </span>
        </div>
        <div className="space-y-3 px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Rapidos:</span>
            <Preset label="100% (1 cuota)" activo={esPreset1} onClick={() => aplicarPreset([100])} />
            <Preset label="50% + 50% (2 cuotas)" activo={esPreset2} onClick={() => aplicarPreset([50, 50])} />
          </div>

          <div className="space-y-1.5">
            {cuotas.map((cuota, idx) => {
              const monto = plan[idx]?.monto ?? 0;
              return (
                <div key={idx} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/40 px-2.5 py-2 text-xs">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-card text-[10px] font-bold text-foreground">
                    {idx + 1}
                  </span>
                  <span className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="0"
                      max={maxPorCuota(idx)}
                      step="1"
                      value={String(cuota.porcentaje)}
                      onChange={(e) => setPorcentaje(idx, Number(e.target.value))}
                      className="h-7 w-[64px] text-center text-xs"
                    />
                    <span className="text-muted-foreground">%</span>
                  </span>
                  <Input
                    type="date"
                    min={minFechaCuota(idx)}
                    max={fechaMaximaCuota(idx)}
                    value={cuota.fecha}
                    onChange={(e) => setFecha(idx, e.target.value)}
                    className="h-7 w-[136px] text-xs"
                  />
                  <span className="font-semibold text-foreground">
                    {numberUtils.monto(monto, moneda, { decimales: 2 })}
                  </span>
                  {cuotas.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="ml-auto h-6 w-6 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Quitar cuota"
                      onClick={() => quitarCuota(idx)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {cuotas.length < MAX_CUOTAS_PAGO && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-full text-xs"
              disabled={suma >= 100}
              title={suma >= 100 ? "Ya distribuiste el 100%; reduce una cuota para agregar otra" : undefined}
              onClick={agregarCuota}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              <span>Agregar cuota ({cuotas.length + 1} de {MAX_CUOTAS_PAGO})</span>
            </Button>
          )}

          {!sumaOk && (
            <p className="text-[11px] font-medium text-warning">
              Ajusta los porcentajes: deben ser mayores a 0 y sumar exactamente 100%.
            </p>
          )}
          {sumaOk && !fechasOk && (
            <p className="text-[11px] font-medium text-warning">
              Revisa las fechas: no pueden ser anteriores a hoy, cada cuota debe ser <strong>posterior</strong> a la
              anterior (minimo {CUOTAS_DIAS_MIN_ENTRE} dia{CUOTAS_DIAS_MIN_ENTRE === 1 ? "" : "s"}) y cada cuota tiene
              un maximo (1ra: 1 mes, 2da: 2 meses, 3ra: 3 meses desde la solicitud; tope 15/07/2027).
            </p>
          )}
          <p className="text-[10px] text-muted-foreground">
            Las fechas se confirman con Facturacion del IIMP al momento del pago.
          </p>
        </div>
      </div>

      {/* Datos del exhibidor para el cuerpo del contrato */}
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
            Estos datos apareceran en el contrato de exhibicion (parte &ldquo;EL EXHIBIDOR&rdquo;). Revisalos y completalos tal
            como figuran en tu ficha RUC y en el poder del representante legal. Ya cargamos lo que ingresaste en el
            paso 1; puedes corregirlo aqui.
          </p>
          <div className="space-y-1">
            <Label htmlFor="contratoRazonSocial" className="text-[11px] font-medium text-muted-foreground"><span>Razon social / nombre del exhibidor *</span></Label>
            <Input id="contratoRazonSocial" className="h-9 text-sm" maxLength={200} value={contratoDatos.razonSocial}
              onChange={(e) => setContratoCampo("razonSocial", e.target.value)} placeholder="Ej. Corporacion Minera S.A.C." />
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
              <Label htmlFor="contratoPartida" className="text-[11px] font-medium text-muted-foreground"><span>Partida electronica (opcional)</span></Label>
              <Input id="contratoPartida" className="h-9 font-mono text-sm" maxLength={50} value={contratoDatos.partidaElectronica}
                onChange={(e) => setContratoCampo("partidaElectronica", e.target.value)} placeholder="11014857" />
            </div>
          </div>
          {!contratoOk && (
            <p className="text-[11px] font-medium text-warning">
              Completa razon social, RUC, domicilio, representante y su DNI para poder generar el contrato.
            </p>
          )}
        </div>
      </div>

      {contrato && (
        <div className="flex items-start gap-2.5 rounded-xl border border-success/30 bg-success/10 px-3.5 py-3">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Contrato generado con esta configuracion. Puedes descargarlo y firmarlo en el siguiente paso.
            {valido ? "" : " Ojo: ajusta las cuotas y vuelve a generar el contrato."}
          </p>
        </div>
      )}

      {valido && (
        <p className="flex items-center gap-1.5 text-[11px] text-success">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Configuracion de cuotas lista ({cuotas.length} cuota{cuotas.length === 1 ? "" : "s"}).</span>
        </p>
      )}
    </div>
  );
}
