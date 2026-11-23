"use client";

import { Badge } from "@nrivera-iimp/ui-kit-iimp";
import { IGV_PORCENTAJE, MONEDAS, TIPOS_DESCUENTO } from "@/lib/shared/constants";
import type { PlanCuotasSolicitud } from "@/domain/models/entities";
import { dateUtils } from "@/lib/shared/utils/date";
import { numberUtils } from "@/lib/shared/utils/number";

interface Props {
  plan: PlanCuotasSolicitud | null;
  /** Moneda de respaldo si el plan no la trae. */
  moneda: string | null;
}

function Dato({ label, valor, destacado = false }: { label: string; valor: string; destacado?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`truncate text-xs ${destacado ? "font-semibold text-foreground" : "text-foreground"}`} title={valor}>
        {valor}
      </p>
    </div>
  );
}

function etiquetaDescuento(plan: PlanCuotasSolicitud, moneda: string): string {
  if (plan.descuentoTipo === TIPOS_DESCUENTO.POR_STAND) return "Por stand";
  if (plan.descuentoTipo === TIPOS_DESCUENTO.MONTO) {
    return `Monto fijo sobre el total (${numberUtils.monto(plan.descuentoValor ?? 0, moneda, { decimales: 2 })})`;
  }
  const porcentaje = plan.descuentoValor ?? plan.descuentoPorcentaje ?? 0;
  return porcentaje > 0 ? `Porcentaje sobre el total (${porcentaje}%)` : "Sin descuento";
}

/**
 * Solo lectura: declara la configuracion comercial de una reserva de pabellon
 * internacional (moneda, descuentos, neto, IGV, total y cuotas) tal como se
 * guardo al crear la solicitud.
 */
export function ConfiguracionPabellonPanel({ plan, moneda }: Props) {
  if (!plan) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
        La solicitud no tiene una configuración comercial registrada.
      </p>
    );
  }

  const monedaPlan = plan.moneda ?? moneda ?? "";
  const monto = (valor: number | undefined) => numberUtils.monto(valor ?? 0, monedaPlan, { decimales: 2 });
  const stands = plan.descuentosPorStand ?? [];
  const igvTexto = `IGV (${Math.round(IGV_PORCENTAJE * 100)}%)`;
  const totalCuotas = plan.cuotas.reduce((suma, cuota) => suma + cuota.monto, 0);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Configuración general</p>
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
          <Dato label="Moneda" valor={monedaPlan || "—"} />
          <Dato
            label="Tipo de cambio"
            valor={
              monedaPlan === MONEDAS.PEN && plan.tipoCambio
                ? `S/ ${plan.tipoCambio} por US$`
                : "No aplica (contrato en USD)"
            }
          />
          <Dato label="Tipo de descuento" valor={etiquetaDescuento(plan, monedaPlan)} />
          <Dato label="Cantidad de cuotas" valor={String(plan.cuotas.length)} />
        </div>
      </div>

      <div className="rounded-lg border p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Resumen económico</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
          <Dato label="Suma de lista (sin IGV)" valor={monto(plan.netoLista)} />
          <Dato label="Descuento" valor={`- ${monto(plan.descuentoMonto)}`} />
          <Dato label="Suma con descuento (sin IGV)" valor={monto(plan.netoDescontado)} destacado />
          <Dato label={igvTexto} valor={monto(plan.igv)} />
          <Dato label="Total con IGV" valor={monto(plan.total)} destacado />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <p className="border-b bg-muted/20 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Costos y descuentos por stand ({stands.length})
        </p>
        {stands.length === 0 ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">
            El descuento se aplicó sobre el total del contrato; no hay detalle por stand en esta configuración.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-1.5 font-semibold">Stand</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Precio lista (sin IGV)</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Descuento</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Monto descontado</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Neto (sin IGV)</th>
                  <th className="px-3 py-1.5 text-right font-semibold">{igvTexto}</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Con IGV</th>
                </tr>
              </thead>
              <tbody>
                {stands.map((stand) => {
                  const igvStand = stand.neto * IGV_PORCENTAJE;
                  const valor = stand.valor ?? stand.porcentaje;
                  const etiqueta = !valor
                    ? "—"
                    : stand.tipo === TIPOS_DESCUENTO.MONTO
                      ? monto(valor)
                      : `${valor}%`;
                  return (
                    <tr key={stand.standId} className="border-b last:border-0">
                      <td className="px-3 py-1.5 font-mono font-medium">{stand.standCode ?? stand.standId}</td>
                      <td className="px-3 py-1.5 text-right">{monto(stand.precio)}</td>
                      <td className="px-3 py-1.5 text-right">{etiqueta}</td>
                      <td className="px-3 py-1.5 text-right">{monto(stand.descuentoMonto)}</td>
                      <td className="px-3 py-1.5 text-right font-medium">{monto(stand.neto)}</td>
                      <td className="px-3 py-1.5 text-right">{monto(igvStand)}</td>
                      <td className="px-3 py-1.5 text-right font-medium">{monto(stand.neto + igvStand)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/20 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Cronograma de cuotas (con IGV)
          </p>
          <Badge variant="secondary" className="pointer-events-none text-[9px]">
            <span>Suma de cuotas {monto(totalCuotas)}</span>
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-1.5 font-semibold">Cuota</th>
                <th className="px-3 py-1.5 text-right font-semibold">Porcentaje</th>
                <th className="px-3 py-1.5 text-right font-semibold">Monto</th>
                <th className="px-3 py-1.5 font-semibold">Vencimiento</th>
              </tr>
            </thead>
            <tbody>
              {plan.cuotas.map((cuota) => (
                <tr key={cuota.numero} className="border-b last:border-0">
                  <td className="px-3 py-1.5">{cuota.numero}</td>
                  <td className="px-3 py-1.5 text-right">{cuota.porcentaje}%</td>
                  <td className="px-3 py-1.5 text-right font-medium">{monto(cuota.monto)}</td>
                  <td className="px-3 py-1.5">
                    {cuota.fechaVencimiento ? dateUtils.format(cuota.fechaVencimiento) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
