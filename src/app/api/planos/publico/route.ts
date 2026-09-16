import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES, TIPOS_PLANO } from "@/lib/shared/constants";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventoId = url.searchParams.get("eventoId");
  const tipoEventoParam = url.searchParams.get("tipoEvento");
  const codigoEventoParam = url.searchParams.get("codigoEvento");

  let codigo = url.searchParams.get("codigo");
  if (!codigo && tipoEventoParam && codigoEventoParam) {
    const planos = await services.planos.planosDeEvento(Number(tipoEventoParam), Number(codigoEventoParam));
    codigo = planos[0]?.codigo ?? null;
  }
  if (!codigo) return error(API_ERROR_CODES.VALIDATION, "codigo requerido", 400);

  const plano = await services.planos.detallePorCodigo(codigo);
  if (!plano || !plano.flgActivo) return error(API_ERROR_CODES.NOT_FOUND, "Plano no encontrado", 404);

  let ocupacion = null;
  let secciones = plano.secciones;
  if (plano.tipo === TIPOS_PLANO.MACRO) {
    const hijoIds = secciones.map((s) => s.planoHijoId).filter((v): v is string => !!v);
    const hijos = hijoIds.length > 0
      ? await services.planos.listar().then((list) => list.filter((p) => hijoIds.includes(p.id)))
      : [];
    const hijoCodigoMap = new Map(hijos.map((h) => [h.id, h.codigo]));
    secciones = secciones.map((s) => ({ ...s, planoHijoCodigo: s.planoHijoId ? (hijoCodigoMap.get(s.planoHijoId) ?? null) : null })) as never;

    if (eventoId) {
      ocupacion = await services.planos.ocupacion(plano.id, eventoId);
    }
  }

  return success({
    codigo: plano.codigo,
    nombre: plano.nombre,
    tipo: plano.tipo,
    imagenFondo: plano.imagenFondo,
    tipos: plano.tipos,
    bloques: plano.bloques,
    furniture: plano.furniture,
    secciones,
    ocupacion,
  });
}
