import type { IGessRepository } from "@/domain/ports/gess-repository";
import type { IPlanogessClient } from "@/domain/ports/planogess-client";
import type { IPlanoRepository } from "@/domain/ports/plano-repository";
import type { ITipoStandImagenRepository } from "@/domain/ports/tipo-stand-imagen-repository";
import type { GessStandEntity } from "@/domain/models/entities";
import { DomainError } from "@/lib/server/router";
import { API_ERROR_CODES, ESTADOS_STAND } from "@/lib/shared/constants";
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
    /* Logo de pre-reserva: se pinta igual que el de una reserva en el plano. */
    result.data = result.data.map((d) => (d.empresaLogo ? d : { ...d, empresaLogo: d.preReservaLogoUrl ?? null }));
    return result;
  }

  async findByBloque(bloqueId: string) {
    const row = await this.repo.findByBloque(bloqueId);
    if (!row) return row;
    const porTipo = await this.imagenesPorTipo(row.eventoId);
    return { ...this.conTipoImagen(row, porTipo), empresaLogo: row.empresaLogo ?? row.preReservaLogoUrl ?? null };
  }

  async vincular(id: string, bloqueId: string | null) {
    return this.repo.update(id, { bloqueId });
  }

  async actualizarStand(id: string, data: { documentos?: string[]; documentosCategorias?: Record<string, string>; imagenes?: string[]; imagenesCategorias?: Record<string, string>; estado?: string }) {
    return this.repo.update(id, data);
  }

  /**
   * Pre-reserva en lote: bloquea stands **disponibles** a nombre de una empresa
   * (buscador de entidades) **o** de un titulo libre — sin crear solicitud ni contrato.
   * Todo o nada: si algun stand no esta disponible, no se modifica ninguno.
   */
  async preReservar(
    standIds: string[],
    datos: { razonSocial?: string | null; titulo?: string | null; ruc?: string | null; sie?: string | null; logoUrl?: string | null },
    nota: string | null,
    por: string,
  ): Promise<{ preReservados: number }> {
    const razonSocial = datos.razonSocial?.trim() || null;
    const titulo = datos.titulo?.trim() || null;
    if (!razonSocial && !titulo) {
      throw new DomainError("Ingresa la empresa (razon social) o un titulo", API_ERROR_CODES.VALIDATION, 400);
    }
    const encontrados = await this.validarStands(standIds, ESTADOS_STAND.DISPONIBLE, "pre-reservar");
    const at = new Date();
    for (const stand of encontrados) {
      await this.repo.update(stand.id, {
        estado: ESTADOS_STAND.PRE_RESERVADO,
        /* Etiqueta visible en el plano (hover): empresa o titulo. */
        empresa: razonSocial ?? titulo,
        preReservaRazonSocial: razonSocial,
        preReservaTitulo: titulo,
        preReservaRuc: razonSocial ? (datos.ruc?.trim() || null) : null,
        preReservaSie: razonSocial ? (datos.sie?.trim() || null) : null,
        preReservaLogoUrl: datos.logoUrl?.trim() || null,
        preReservaNota: nota?.trim() || null,
        preReservaPor: por,
        preReservaAt: at,
      } as Partial<GessStandEntity>);
    }
    return { preReservados: encontrados.length };
  }

  /** Libera pre-reservas: solo stands `pre_reservado` vuelven a `disponible` (todo o nada). */
  async liberarPreReserva(standIds: string[]): Promise<{ liberados: number }> {
    const encontrados = await this.validarStands(standIds, ESTADOS_STAND.PRE_RESERVADO, "liberar");
    for (const stand of encontrados) {
      await this.repo.update(stand.id, {
        estado: ESTADOS_STAND.DISPONIBLE,
        empresa: null,
        preReservaRazonSocial: null,
        preReservaTitulo: null,
        preReservaRuc: null,
        preReservaSie: null,
        preReservaLogoUrl: null,
        preReservaNota: null,
        preReservaPor: null,
        preReservaAt: null,
      } as Partial<GessStandEntity>);
    }
    return { liberados: encontrados.length };
  }

  /** Edita empresa/titulo, logo y nota de una pre-reserva vigente (sin cambiar autor ni fecha). */
  async actualizarPreReserva(
    standId: string,
    datos: { razonSocial?: string | null; titulo?: string | null; ruc?: string | null; sie?: string | null; logoUrl?: string | null; nota: string | null },
  ): Promise<{ actualizado: boolean }> {
    const razonSocial = datos.razonSocial?.trim() || null;
    const titulo = datos.titulo?.trim() || null;
    if (!razonSocial && !titulo) {
      throw new DomainError("Ingresa la empresa (razon social) o un titulo", API_ERROR_CODES.VALIDATION, 400);
    }
    const stand = await this.repo.findById(standId);
    if (!stand) throw new DomainError("Stand no encontrado", API_ERROR_CODES.NOT_FOUND, 404);
    if (stand.estado !== ESTADOS_STAND.PRE_RESERVADO) {
      throw new DomainError(`No se puede editar: ${stand.standCode} no esta pre-reservado`, API_ERROR_CODES.CONFLICT, 409);
    }
    await this.repo.update(stand.id, {
      empresa: razonSocial ?? titulo,
      preReservaRazonSocial: razonSocial,
      preReservaTitulo: titulo,
      preReservaRuc: razonSocial ? (datos.ruc?.trim() || null) : null,
      preReservaSie: razonSocial ? (datos.sie?.trim() || null) : null,
      preReservaLogoUrl: datos.logoUrl?.trim() || null,
      preReservaNota: datos.nota?.trim() || null,
    } as Partial<GessStandEntity>);
    return { actualizado: true };
  }

  /** Valida en lote que los stands existan y esten en el estado requerido (todo o nada). */
  private async validarStands(standIds: string[], estadoRequerido: string, accion: string): Promise<GessStandEntity[]> {
    const ids = [...new Set(standIds.filter(Boolean))];
    if (ids.length === 0) {
      throw new DomainError(`No hay stands para ${accion}`, API_ERROR_CODES.VALIDATION, 400);
    }
    const encontrados: GessStandEntity[] = [];
    const conflictos: string[] = [];
    for (const id of ids) {
      const stand = await this.repo.findById(id);
      if (!stand || stand.estado !== estadoRequerido) {
        conflictos.push(stand?.standCode ?? id);
        continue;
      }
      encontrados.push(stand);
    }
    if (conflictos.length > 0) {
      throw new DomainError(
        `No se puede ${accion}: ${conflictos.join(", ")} no estan en estado ${estadoRequerido}`,
        API_ERROR_CODES.CONFLICT,
        409,
      );
    }
    return encontrados;
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
        && (exists?.estado === ESTADOS_STAND.EN_EVALUACION || exists?.estado === ESTADOS_STAND.RESERVADO || exists?.estado === ESTADOS_STAND.PRE_RESERVADO);

      const empresaApi = String(r.company ?? r.empresa ?? r.razon_social ?? "").trim();
      const data: Record<string, unknown> = {
        eventoId, standApiId: uid, standCode: uid,
        tipoStand: tipo || null, medidas: medidas || null,
        ...(estadoProtegido ? {} : { estado }),
        pabellon: pabellonApi || (r.x !== undefined ? coordenadas : null),
        rawData: row,
      };
      /* Pre-reserva vigente: manda la empresa local, el API no la pisa. */
      if (exists?.estado === ESTADOS_STAND.PRE_RESERVADO) {
        /* sin cambios de empresa */
      } else if (empresaApi) data.empresa = empresaApi;
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
