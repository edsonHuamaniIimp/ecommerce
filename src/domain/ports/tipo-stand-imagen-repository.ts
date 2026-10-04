import type { TipoStandImagenEntity } from "../models/tipo-stand-imagen";

export interface ITipoStandImagenRepository {
  listar(): Promise<TipoStandImagenEntity[]>;
  /** Crea o reemplaza la imagen del tipo para un evento (null = global). */
  upsert(tipo: string, imagenUrl: string, eventoId: string | null): Promise<TipoStandImagenEntity>;
  eliminar(tipo: string, eventoId: string | null): Promise<void>;
}
