import type { TipoStandImagenEntity } from "../models/tipo-stand-imagen";

export interface ITipoStandImagenRepository {
  listar(): Promise<TipoStandImagenEntity[]>;
  /** Crea o reemplaza la imagen del tipo (recibe la clave canonica). */
  upsert(tipo: string, imagenUrl: string): Promise<TipoStandImagenEntity>;
  eliminar(tipo: string): Promise<void>;
}
