import { ESTADOS_STAND } from "@/lib/shared/constants";
import { precioTextoDesdeTipo } from "./precio-stand";

/** Stand local (subconjunto de gess_stand) para comparar contra el API. */
export interface GessSyncBdRow {
  standApiId: string;
  standCode: string;
  tipoStand?: string | null;
  medidas?: string | null;
  empresa?: string | null;
  estado?: string | null;
  bloqueId?: string | null;
}

/** Fila del API liststand ya aplanada (mismas claves que usa el sync). */
export interface GessSyncApiRow {
  id: string;
  tipo?: string;
  precio?: string;
  moneda?: string;
  empresa?: string;
}

/** Cambio detectado en un dato comercial de un stand. */
export interface CambioSyncGess {
  standCode: string;
  antes: string | null;
  despues: string | null;
}

export interface PrevisualizacionSyncGess {
  totalApi: number;
  totalBd: number;
  vinculados: number;
  precios: CambioSyncGess[];
  tipos: CambioSyncGess[];
  empresas: CambioSyncGess[];
  sinCambios: number;
  soloBd: number;
  nuevosApi: number;
}

/**
 * Valor que el sync guardara en `gess_stand.medidas`: precio + moneda del API
 * o, si el API no informa precio, el catalogo por tipo (misma regla del backend).
 */
export function medidasEsperadasDesdeApi(row: { tipo?: string; precio?: string; moneda?: string }): string | null {
  const precio = String(row.precio ?? "").trim();
  const moneda = String(row.moneda ?? "USD").trim() || "USD";
  if (precio) return `${precio} ${moneda}`;
  const tipo = String(row.tipo ?? "").trim();
  if (!tipo) return null;
  return precioTextoDesdeTipo(tipo);
}

/**
 * Compara la BD local contra el API para previsualizar que cambiara el sync
 * completo (sin `seleccionadas`). No muta nada: solo calcula diferencias.
 *
 * Reglas espejo del backend:
 *  - precio -> `medidas` (precio API o catalogo por tipo).
 *  - tipo -> `tipoStand`.
 *  - empresa del API solo si no hay pre-reserva local y el API la informa.
 *  - Las filas del API que no estan en BD se crean; las de BD sin API no se borran.
 */
export function calcularPrevisualizacionSync(
  dbRows: GessSyncBdRow[],
  apiRows: GessSyncApiRow[],
): PrevisualizacionSyncGess {
  const dbPorId = new Map<string, GessSyncBdRow>();
  for (const row of dbRows) {
    if (row.standApiId) dbPorId.set(String(row.standApiId), row);
  }
  const apiPorId = new Map<string, GessSyncApiRow>();
  for (const row of apiRows) {
    if (row.id) apiPorId.set(String(row.id), row);
  }

  const precios: CambioSyncGess[] = [];
  const tipos: CambioSyncGess[] = [];
  const empresas: CambioSyncGess[] = [];
  let sinCambios = 0;

  for (const [id, db] of dbPorId) {
    const api = apiPorId.get(id);
    if (!api) continue;

    let cambio = false;

    const medidasEsperadas = medidasEsperadasDesdeApi(api);
    const medidasActuales = String(db.medidas ?? "").trim() || null;
    if (medidasEsperadas !== null && medidasEsperadas !== medidasActuales) {
      precios.push({ standCode: db.standCode, antes: medidasActuales, despues: medidasEsperadas });
      cambio = true;
    }

    const tipoEsperado = String(api.tipo ?? "").trim() || null;
    const tipoActual = String(db.tipoStand ?? "").trim() || null;
    if (tipoEsperado !== null && tipoEsperado !== tipoActual) {
      tipos.push({ standCode: db.standCode, antes: tipoActual, despues: tipoEsperado });
      cambio = true;
    }

    const empresaEsperada = String(api.empresa ?? "").trim() || null;
    const empresaActual = String(db.empresa ?? "").trim() || null;
    if (empresaEsperada !== null && db.estado !== ESTADOS_STAND.PRE_RESERVADO && empresaEsperada !== empresaActual) {
      empresas.push({ standCode: db.standCode, antes: empresaActual, despues: empresaEsperada });
      cambio = true;
    }

    if (!cambio) sinCambios += 1;
  }

  let soloBd = 0;
  for (const id of dbPorId.keys()) if (!apiPorId.has(id)) soloBd += 1;

  let nuevosApi = 0;
  for (const id of apiPorId.keys()) if (!dbPorId.has(id)) nuevosApi += 1;

  return {
    totalApi: apiPorId.size,
    totalBd: dbPorId.size,
    vinculados: dbRows.filter((row) => Boolean(row.bloqueId)).length,
    precios,
    tipos,
    empresas,
    sinCambios,
    soloBd,
    nuevosApi,
  };
}
