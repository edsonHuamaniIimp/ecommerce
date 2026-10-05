/**
 * Cliente del API de reserva de stands del IIMP (`POST /stands/reserva`):
 * registra la reserva (contrato + cuenta corriente) y emite la factura de la 1ra cuota.
 * Reusa la cuenta tecnica (acceso VTA) y el token cacheado de liststand.
 *
 * Doc: API-RESERVA-STAND-INTEGRACION.md
 */
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { DomainError } from "@/lib/server/router";
import { fetchIimp, getIimpApiUrl, obtenerTokenIimp } from "@/infrastructure/external/liststand-client";
import type {
  IReservaIimpClient,
  ReservaIimpDocumento,
  ReservaIimpInput,
  ReservaIimpResponse,
} from "@/domain/ports/reserva-iimp-client";

function texto(valor: unknown): string {
  return valor === undefined || valor === null ? "" : String(valor);
}

function mapearDocumento(raw: Record<string, unknown> | null | undefined): ReservaIimpDocumento | null {
  if (!raw) return null;
  return {
    tipoDocumento: texto(raw.TipoDocumento),
    serie: texto(raw.Serie),
    numero: Number(raw.Numero ?? 0),
    fechaEmision: texto(raw.FechaEmision),
    tipoCambio: texto(raw.TipoCambio),
    igv: texto(raw.IGV),
    total: texto(raw.Total),
  };
}

function mapearRespuesta(raw: Record<string, unknown>): ReservaIimpResponse {
  const cliente = (raw.Cliente ?? {}) as Record<string, unknown>;
  const stands = Array.isArray(raw.Stands) ? (raw.Stands as Record<string, unknown>[]) : [];
  const cuotas = Array.isArray(raw.Cuotas) ? (raw.Cuotas as Record<string, unknown>[]) : [];
  return {
    contrato: texto(raw.Contrato),
    cuentaCorriente: Number(raw.CuentaCorriente ?? 0),
    cliente: {
      tipo: texto(cliente.Tipo),
      codigo: texto(cliente.Codigo),
      nombre: texto(cliente.Nombre),
      tipDocumento: texto(cliente.TipDocumento),
      numDocumento: texto(cliente.NumDocumento),
    },
    moneda: texto(raw.Moneda),
    stands: stands.map((s) => ({
      numero: texto(s.Numero),
      tipo: texto(s.Tipo),
      pabellon: texto(s.Pabellon),
      area: texto(s.Area),
      precio: texto(s.Precio),
    })),
    cuotas: cuotas.map((c) => ({
      cuota: Number(c.Cuota ?? 0),
      porcentaje: texto(c.Porcentaje),
      fecha: texto(c.Fecha),
      baseImponible: texto(c.BaseImponible),
      igv: texto(c.IGV),
      total: texto(c.Total),
      documento: mapearDocumento(c.Documento as Record<string, unknown> | null | undefined),
    })),
    baseImponible: texto(raw.BaseImponible),
    igv: texto(raw.IGV),
    total: texto(raw.Total),
  };
}

function cuerpo(input: ReservaIimpInput): Record<string, unknown> {
  const contacto = (c: { nombre: string; cargo?: string | null; tipoDocumento?: string | null; numDocumento?: string | null; email?: string | null; telefono?: string | null }) => ({
    Nombre: c.nombre,
    ...(c.cargo ? { Cargo: c.cargo } : {}),
    ...(c.tipoDocumento ? { TipoDocumento: c.tipoDocumento } : {}),
    ...(c.numDocumento ? { NumDocumento: c.numDocumento } : {}),
    ...(c.email ? { Email: c.email } : {}),
    ...(c.telefono ? { Telefono: c.telefono } : {}),
  });
  return {
    TipEvCod: input.tipEvCod,
    EvenCod: input.evenCod,
    Stands: input.stands,
    TipoFacturacion: input.tipoFacturacion,
    TipDocFacturacion: input.tipDocFacturacion,
    NumDocFacturacion: input.numDocFacturacion,
    ...(input.razonSocial ? { RazonSocial: input.razonSocial } : {}),
    ...(input.apellidoPaternoFact ? { ApellidoPaternoFact: input.apellidoPaternoFact } : {}),
    ...(input.apellidoMaternoFact ? { ApellidoMaternoFact: input.apellidoMaternoFact } : {}),
    ...(input.nombresFact ? { NombresFact: input.nombresFact } : {}),
    DirFacturacion: input.dirFacturacion,
    ...(input.web ? { Web: input.web } : {}),
    ...(input.telefono ? { Telefono: input.telefono } : {}),
    ...(input.friso ? { Friso: input.friso } : {}),
    Contactos: {
      Contrato: contacto(input.contactos.contrato),
      ...(input.contactos.responsable ? { Responsable: contacto(input.contactos.responsable) } : {}),
      Pagos: contacto(input.contactos.pagos),
    },
    Cuotas: input.cuotas.map((c) => ({ Porcentaje: c.porcentaje, Fecha: c.fecha })),
  };
}

export class ReservaIimpClient implements IReservaIimpClient {
  async reservar(input: ReservaIimpInput): Promise<ReservaIimpResponse> {
    const token = await obtenerTokenIimp();
    const res = await fetchIimp(`${getIimpApiUrl()}/stands/reserva`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(cuerpo(input)),
    });

    if (res.ok) {
      return mapearRespuesta((await res.json()) as Record<string, unknown>);
    }

    const json = (await res.json().catch(() => null)) as { codigo?: string; mensaje?: string; identificador?: string } | null;
    if (res.status === 400) {
      throw new DomainError(json?.mensaje ?? "Datos invalidos en la reserva del IIMP", API_ERROR_CODES.VALIDATION, 400);
    }
    if (res.status === 401) {
      throw new DomainError("La sesion con el API del IIMP expiro; reintenta", API_ERROR_CODES.UNAUTHORIZED, 502);
    }
    if (res.status === 403) {
      throw new DomainError("La cuenta tecnica del IIMP no tiene acceso VTA", API_ERROR_CODES.FORBIDDEN, 502);
    }
    if (res.status === 404) {
      throw new DomainError(json?.mensaje ?? "El evento no existe en el IIMP", API_ERROR_CODES.NOT_FOUND, 404);
    }
    if (res.status === 409) {
      throw new DomainError(json?.mensaje ?? "Algun stand ya fue reservado en el IIMP", API_ERROR_CODES.CONFLICT, 409);
    }
    throw new DomainError(
      `Error del API de reserva del IIMP${json?.identificador ? ` (${json.identificador})` : ""}`,
      API_ERROR_CODES.INTERNAL,
      502,
    );
  }
}
