import { createHash } from "node:crypto";
import type { PlanCuotasSolicitud } from "@/domain/models/entities";
import type { ReservaIimpInput } from "@/domain/ports/reserva-iimp-client";
import type { SolicitudVigenteResponseDTO } from "@/types/dto/facturacion/solicitud-vigente-response.dto";

/** Datos de la solicitud que alimentan la respuesta (subconjunto de `datosReservaIImp`). */
export interface FuenteSolicitudVigente {
  iimpContrato: string | null;
  iimpCuentaCorriente: string | null;
  moneda: string;
  tipoCambio: number | null;
  standsPrecio?: Array<{ codigo: string; standCode: string; precioUsd: number }>;
  planCuotas: PlanCuotasSolicitud | null;
}

const num = (valor: number | null | undefined): number | null => (typeof valor === "number" && Number.isFinite(valor) ? valor : null);

/**
 * Mapper de la solicitud vigente: el cliente facturado sale del MISMO payload que se enviaria
 * al SIE (`ReservaIimpInput`), de modo que lo que el SIE lee coincide con lo que se enviaria hoy.
 * No incluye datos personales del representante legal.
 */
export function mapSolicitudVigente(
  numeroSolicitud: string,
  fuente: FuenteSolicitudVigente,
  payload: ReservaIimpInput,
): SolicitudVigenteResponseDTO {
  const plan = fuente.planCuotas;
  const descuentos = new Map((plan?.descuentosPorStand ?? []).map((d) => [d.standCode ?? "", d]));

  const facturacion: SolicitudVigenteResponseDTO["facturacion"] = {
    tipoComprobante: payload.tipoFacturacion,
    tipoDocumento: payload.tipDocFacturacion,
    numeroDocumento: payload.numDocFacturacion,
    razonSocial: payload.razonSocial?.trim() || null,
    nombres: payload.nombresFact?.trim() || null,
    apellidoPaterno: payload.apellidoPaternoFact?.trim() || null,
    apellidoMaterno: payload.apellidoMaternoFact?.trim() || null,
    paisCodigo: payload.pais ?? null,
    direccion: payload.dirFacturacion,
    telefono: payload.telefono?.trim() || null,
    web: payload.web?.trim() || null,
    friso: payload.friso?.trim() || null,
    correoFacturacion: payload.contactos.pagos.email ?? "",
    correoContrato: payload.contactos.contrato.email ?? "",
    correoPagos: payload.contactos.pagos.email ?? "",
  };

  const comercial: SolicitudVigenteResponseDTO["comercial"] = {
    moneda: fuente.moneda,
    tipoCambio: num(fuente.tipoCambio),
    modalidad: plan?.modalidad ?? null,
    netoLista: num(plan?.netoLista),
    descuentoMonto: num(plan?.descuentoMonto),
    netoDescontado: num(plan?.netoDescontado),
    igv: num(plan?.igv),
    total: num(plan?.total),
  };

  const stands = (fuente.standsPrecio ?? []).map((s) => {
    const d = descuentos.get(s.standCode);
    return {
      codigo: s.codigo,
      standCode: s.standCode,
      precioLista: s.precioUsd,
      descuentoPorcentaje: d ? d.porcentaje : null,
      descuentoMonto: d ? d.descuentoMonto : null,
      neto: d ? d.neto : null,
    };
  });

  const cuotas = (plan?.cuotas ?? []).map((c) => ({
    numero: c.numero,
    porcentaje: c.porcentaje,
    vencimiento: (c.fechaVencimiento ?? "").slice(0, 10),
    monto: c.monto,
  }));

  const version = createHash("sha256").update(JSON.stringify({ facturacion, comercial, stands, cuotas })).digest("hex").slice(0, 16);

  return {
    numeroSolicitud,
    contrato: fuente.iimpContrato,
    cuentaCorriente: fuente.iimpCuentaCorriente,
    version,
    facturacion,
    comercial,
    stands,
    cuotas,
  };
}
