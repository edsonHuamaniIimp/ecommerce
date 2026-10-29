/** Datos minimos de la respuesta SUNAT usados para el resaltado temporal. */
export interface RucAutocompletadoLike {
  razonSocial?: string;
  nombreComercial?: string;
  direccion?: string;
  actividadEconomica?: string;
  estado?: string;
  condicion?: string;
}

export interface DniAutocompletadoLike {
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  nombreCompleto?: string;
}

export type RolDniResponsable = "representante" | "extemin" | "pagos";

/**
 * Campos del formulario que se resaltan cuando SUNAT devuelve datos.
 * No incluye telefono/sitio web porque SUNAT no los entrega.
 */
export function camposAutocompletadosRuc(r: RucAutocompletadoLike): string[] {
  const campos = ["ruc", "razonSocial", "nombreComercial", "facturarANombre"];
  if (r.direccion) campos.push("direccionFiscal");
  if (r.actividadEconomica) campos.push("actividadEconomica");
  if (r.estado || r.condicion) campos.push("estadoContribuyente");
  return campos;
}

/** Nombre oficial a partir de la respuesta de RENIEC. */
export function nombreCompletoDesdeDni(r: DniAutocompletadoLike | null | undefined): string {
  if (!r) return "";
  return r.nombreCompleto || [r.nombres, r.apellidoPaterno, r.apellidoMaterno].filter(Boolean).join(" ");
}

/**
 * Campos exactos por rol. Se mantienen aislados para que el DNI de pagos
 * nunca actualice el nombre de EXTEMIN ni viceversa.
 */
export function camposAutocompletadosDni(rol: RolDniResponsable, tieneNombre: boolean): string[] {
  const campos = rol === "representante"
    ? ["representanteLegalDni", ...(tieneNombre ? ["representanteLegalNombre"] : [])]
    : rol === "extemin"
      ? ["responsableExteminDni", ...(tieneNombre ? ["responsableExteminNombre"] : [])]
      : ["responsablePagosDni", ...(tieneNombre ? ["responsablePagosNombre"] : [])];
  return campos;
}
