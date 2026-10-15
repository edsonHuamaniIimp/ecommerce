/**
 * Cliente del API de reserva de stands del IIMP (`POST /stands/reserva` y los
 * endpoints de archivos de la cuenta corriente): registra la reserva (contrato
 * + cuenta corriente); el IIMP factura cada cuota en su fecha.
 * Reusa la cuenta tecnica (acceso VTA) y el token cacheado de liststand.
 *
 * Doc: API-RESERVA-STAND-INTEGRACION.md (v2, 13-10-2026)
 */
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { DomainError } from "@/lib/server/router";
import { fetchIimp, getIimpApiUrl, obtenerTokenIimp } from "@/infrastructure/external/liststand-client";
import type {
  IReservaIimpClient,
  ReservaIimpArchivo,
  ReservaIimpArchivoInput,
  ReservaIimpCuentaInput,
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

function mapearArchivos(raw: unknown): ReservaIimpArchivo[] {
  const lista = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
  return lista.map((a) => ({
    item: Number(a.Item ?? 0),
    tipo: texto(a.Tipo),
    cuota: a.Cuota === undefined || a.Cuota === null ? null : Number(a.Cuota),
    link: texto(a.Link),
    nombre: a.Nombre === undefined || a.Nombre === null ? null : texto(a.Nombre),
    fecha: texto(a.Fecha),
  }));
}

function cuerpoArchivo(a: ReservaIimpArchivoInput): Record<string, unknown> {
  return {
    Tipo: a.tipo,
    ...(a.cuota ? { Cuota: a.cuota } : {}),
    Link: a.link,
    ...(a.nombre ? { Nombre: a.nombre } : {}),
  };
}

function mapearRespuesta(raw: Record<string, unknown>): ReservaIimpResponse {
  const cliente = (raw.Cliente ?? {}) as Record<string, unknown>;
  const stands = Array.isArray(raw.Stands) ? (raw.Stands as Record<string, unknown>[]) : [];
  const cuotas = Array.isArray(raw.Cuotas) ? (raw.Cuotas as Record<string, unknown>[]) : [];
  return {
    numeroSolicitud: texto(raw.NumeroSolicitud),
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
    archivos: mapearArchivos(raw.Archivos),
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
    NumeroSolicitud: input.numeroSolicitud,
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
    ...(input.archivos && input.archivos.length > 0 ? { Archivos: input.archivos.map(cuerpoArchivo) } : {}),
  };
}

/** Errores HTTP del API del IIMP comunes a reserva y archivos. */
function lanzarError(res: Response, json: { mensaje?: string; identificador?: string } | null, contexto: "RESERVA" | "ARCHIVOS"): never {
  const esArchivos = contexto === "ARCHIVOS";
  if (res.status === 400) {
    throw new DomainError(
      json?.mensaje ?? (esArchivos ? "Datos invalidos en los archivos de la cuenta corriente" : "Datos invalidos en la reserva del IIMP"),
      API_ERROR_CODES.VALIDATION,
      400,
    );
  }
  if (res.status === 401) {
    throw new DomainError("La sesion con el API del IIMP expiro; reintenta", API_ERROR_CODES.UNAUTHORIZED, 502);
  }
  if (res.status === 403) {
    throw new DomainError("La cuenta tecnica del IIMP no tiene acceso VTA", API_ERROR_CODES.FORBIDDEN, 502);
  }
  if (res.status === 404) {
    throw new DomainError(
      json?.mensaje ?? (esArchivos ? "La cuenta corriente no existe en el IIMP" : "El evento no existe en el IIMP"),
      API_ERROR_CODES.NOT_FOUND,
      404,
    );
  }
  if (res.status === 409) {
    throw new DomainError(json?.mensaje ?? "Conflicto al registrar la reserva en el IIMP", API_ERROR_CODES.CONFLICT, 409);
  }
  throw new DomainError(
    `${esArchivos ? "Error del API de archivos del IIMP" : "Error del API de reserva del IIMP"}${json?.identificador ? ` (${json.identificador})` : ""}`,
    API_ERROR_CODES.INTERNAL,
    502,
  );
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
    lanzarError(res, (await res.json().catch(() => null)) as { mensaje?: string; identificador?: string } | null, "RESERVA");
  }

  async agregarArchivos(input: ReservaIimpCuentaInput & { archivos: ReservaIimpArchivoInput[] }): Promise<ReservaIimpArchivo[]> {
    return this.postCuenta("/stands/archivos", {
      ...cuerpoCuenta(input),
      Archivos: input.archivos.map(cuerpoArchivo),
    });
  }

  async listarArchivos(input: ReservaIimpCuentaInput): Promise<ReservaIimpArchivo[]> {
    return this.postCuenta("/stands/archivos/lista", cuerpoCuenta(input));
  }

  async eliminarArchivo(input: ReservaIimpCuentaInput & { item: number }): Promise<ReservaIimpArchivo[]> {
    return this.postCuenta("/stands/archivos/eliminar", { ...cuerpoCuenta(input), Item: input.item });
  }

  /** POST sobre la cuenta corriente; las tres operaciones devuelven la lista completa. */
  private async postCuenta(path: string, body: Record<string, unknown>): Promise<ReservaIimpArchivo[]> {
    const token = await obtenerTokenIimp();
    const res = await fetchIimp(`${getIimpApiUrl()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const json = (await res.json()) as Record<string, unknown>;
      return mapearArchivos(json.Archivos);
    }
    lanzarError(res, (await res.json().catch(() => null)) as { mensaje?: string; identificador?: string } | null, "ARCHIVOS");
  }
}

function cuerpoCuenta(input: ReservaIimpCuentaInput): Record<string, unknown> {
  /* v3: `NumeroSolicitud` identifica la cuenta (recomendado); el trio clasico es la alternativa. */
  if (input.numeroSolicitud) return { NumeroSolicitud: input.numeroSolicitud };
  return { TipEvCod: input.tipEvCod, EvenCod: input.evenCod, CuentaCorriente: input.cuentaCorriente };
}
