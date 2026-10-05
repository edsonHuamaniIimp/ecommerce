import type { IGessRepository } from "@/domain/ports/gess-repository";
import type { IPlanogessClient } from "@/domain/ports/planogess-client";
import type { IPlanoRepository } from "@/domain/ports/plano-repository";
import type { ITipoStandImagenRepository } from "@/domain/ports/tipo-stand-imagen-repository";
import { ESTADOS_STAND } from "@/lib/shared/constants";
import { precioTextoDesdeTipo } from "@/lib/shared/utils/precio-stand";
import { claveTipoStand } from "@/lib/shared/utils/tipo-stand";

const TIPO_STAND_POR_NOMBRE: Record<string, string> = {
  Preferencial: "PREFERENCIAL",
  "Estandar A": "ESTANDAR_01",
  "Estandar B": "ESTANDAR_02",
  Columna: "ESTANDAR_02",
  "Isla Grande": "ISLAS",
};

function tipoStandDesdeNombre(nombre: string, fallback: string): string {
  const match = Object.keys(TIPO_STAND_POR_NOMBRE).find((k) => nombre.includes(k));
  return match ? TIPO_STAND_POR_NOMBRE[match] ?? fallback : fallback;
}

export class GessApplicationService {
  constructor(
    private readonly repo: IGessRepository,
    private readonly api: IPlanogessClient,
    private readonly planoRepo: IPlanoRepository,
    private readonly tiposImagenRepo: ITipoStandImagenRepository,
  ) {}

  /** Mapa clave canonica del tipo → imagen referencial del evento (pisa la global). */
  private async imagenesPorTipo(eventoId: string): Promise<Map<string, string>> {
    const filas = await this.tiposImagenRepo.listar();
    const mapa = new Map<string, string>();
    for (const fila of filas) {
      const clave = claveTipoStand(fila.tipo) ?? fila.tipo;
      if (fila.eventoId === eventoId) mapa.set(clave, fila.imagenUrl);
    }
    for (const fila of filas) {
      const clave = claveTipoStand(fila.tipo) ?? fila.tipo;
      if (!fila.eventoId && !mapa.has(clave)) mapa.set(clave, fila.imagenUrl);
    }
    return mapa;
  }

  /** Agrega `tipoImagen` (imagen referencial del tipo) a un stand. */
  private conTipoImagen<T extends { tipoStand: string | null }>(row: T, porTipo: Map<string, string>): T & { tipoImagen: string | null } {
    const clave = claveTipoStand(row.tipoStand);
    return { ...row, tipoImagen: clave ? (porTipo.get(clave) ?? null) : null };
  }

  async listar(eventoId: string, params: { page: number; perPage: number; search?: string; estado?: string }) {
    const result = await this.repo.findAllPaginated(eventoId, params);

    /*
     * RF-09: completa razon social y logo de los stands reservados desde la empresa/usuario
     * que reservo (solicitud → user_role → empresa), porque el API externo no conoce las
     * reservas hechas en este sistema.
     */
    const sinEmpresa = result.data.filter((d) => !d.empresa);
    if (sinEmpresa.length > 0) {
      const datos = await this.repo.datosEmpresaPorStands(sinEmpresa.map((d) => d.id));
      if (datos.size > 0) {
        result.data = result.data.map((d) => {
          if (d.empresa) return d;
          const reserva = datos.get(d.id);
          return reserva ? { ...d, empresa: reserva.razonSocial, empresaLogo: reserva.logoUrl } : d;
        });
      }
    }

    /* RF-08: imagen referencial por tipo del evento (fallback global). */
    const porTipo = await this.imagenesPorTipo(eventoId);
    result.data = result.data.map((d) => this.conTipoImagen(d, porTipo));
    return result;
  }

  async findByBloque(bloqueId: string) {
    const row = await this.repo.findByBloque(bloqueId);
    if (!row) return row;
    const porTipo = await this.imagenesPorTipo(row.eventoId);
    return this.conTipoImagen(row, porTipo);
  }

  async vincular(id: string, bloqueId: string | null) {
    return this.repo.update(id, { bloqueId });
  }

  async actualizarStand(id: string, data: { documentos?: string[]; documentosCategorias?: Record<string, string>; imagenes?: string[]; imagenesCategorias?: Record<string, string>; estado?: string }) {
    return this.repo.update(id, data);
  }

  async sync(eventoId: string, tipoEvento: number, codigoEvento: number, seleccionadas?: Record<string, unknown>[]) {
    const rows = seleccionadas && seleccionadas.length > 0
      ? seleccionadas
      : await this.api.fetchStands(tipoEvento, codigoEvento);

    let creados = 0;
    let actualizados = 0;

    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const uid = String(r.stand ?? r.uid ?? r.UID ?? r.codigo ?? "");
      if (!uid) continue;

      const tipo = String(r.tipo ?? r.type ?? r.tipo_stand ?? "");
      /* Precio real del API (varia por pabellon): se guarda como "precio moneda" en `medidas`. */
      const precio = r.precio !== undefined && r.precio !== null ? String(r.precio).trim() : "";
      const moneda = String(r.moneda ?? "USD").trim() || "USD";
      const medidas = precio ? `${precio} ${moneda}` : precioTextoDesdeTipo(tipo);

      /* El API liststand entrega LIBRE/RESERVADO; el resto de fuentes ya viene normalizado. */
      const estadoApi = String(r.estado ?? r.status ?? "").trim().toLowerCase();
      const estado =
        estadoApi === "libre"
          ? ESTADOS_STAND.DISPONIBLE
          : estadoApi === "reservado"
            ? ESTADOS_STAND.RESERVADO
            : estadoApi || null;

      const pabellonApi = String(r.pabellon ?? "").trim();
      const coordenadas = `${String(r.x ?? r.pos_x ?? "")},${String(r.y ?? r.pos_y ?? "")}`;

      const exists = await this.repo.findByStandApiId(eventoId, uid);

      /*
       * Re-importacion: la BD deduplica por (eventoId, standApiId), asi que se actualiza
       * el mismo registro. Se protegen los datos locales: si el stand ya esta en un estado
       * gestionado por el portal (en_evaluacion/reservado) y el API aun lo reporta LIBRE,
       * se conserva el estado local; y no se pisa la empresa si el API no la trae.
       */
      const estadoProtegido =
        estado === ESTADOS_STAND.DISPONIBLE
        && (exists?.estado === ESTADOS_STAND.EN_EVALUACION || exists?.estado === ESTADOS_STAND.RESERVADO);

      const empresaApi = String(r.company ?? r.empresa ?? r.razon_social ?? "").trim();
      const data: Record<string, unknown> = {
        eventoId, standApiId: uid, standCode: uid,
        tipoStand: tipo || null, medidas: medidas || null,
        ...(estadoProtegido ? {} : { estado }),
        pabellon: pabellonApi || (r.x !== undefined ? coordenadas : null),
        rawData: row,
      };
      if (empresaApi) data.empresa = empresaApi;
      else if (!exists) data.empresa = null;

      if (exists) {
        await this.repo.update(exists.id, data as never);
        actualizados++;
      } else {
        await this.repo.create(data as never);
        creados++;
      }
    }

    return { creados, actualizados, total: rows.length };
  }

  /**
   * Genera stands demo (replica el formato y precios de la data real del API KBEventos)
   * y los persiste en gess_stand, vinculados a los bloques de los planos del evento.
   * Util para eventos sin datos en el API.
   */
  async mockup(eventoId: string, tipoEvento: number, codigoEvento: number) {
    const planos = await this.planoRepo.planosDeEvento(tipoEvento, codigoEvento);
    const bloques = planos.flatMap((p) =>
      p.bloques.map((b) => {
        const tipo = p.tipos.find((t) => t.codigo === b.tipoCodigo);
        const tipoStand = tipo ? tipoStandDesdeNombre(tipo.nombre, "ESTANDAR_01") : "ESTANDAR_01";
        return {
          bloqueId: b.bloqueId,
          tipoStand,
          medidas: precioTextoDesdeTipo(tipoStand),
          plan: p.codigo,
          x: b.x,
          z: b.z,
        };
      }),
    );

    let creados = 0;
    let actualizados = 0;
    for (const b of bloques) {
      const exists = await this.repo.findByStandApiId(eventoId, b.bloqueId);
      const data = {
        eventoId,
        standApiId: b.bloqueId,
        standCode: b.bloqueId,
        tipoStand: b.tipoStand,
        medidas: b.medidas,
        estado: ESTADOS_STAND.DISPONIBLE,
        empresa: null,
        pabellon: `${b.x},${b.z}`,
        bloqueId: b.bloqueId,
        rawData: { mock: true, tipoEvento, codigoEvento, plan: b.plan },
      };
      if (exists) {
        await this.repo.update(exists.id, data as never);
        actualizados++;
      } else {
        await this.repo.create(data as never);
        creados++;
      }
    }

    return { creados, actualizados, total: bloques.length, planos: planos.map((p) => p.codigo) };
  }
}
