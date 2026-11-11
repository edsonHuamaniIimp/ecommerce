import type {
  DdAuditoriaItem,
  DdConfiguracionData,
  DdConfiguracionEntity,
} from "@/domain/models/dd-configuracion";

/** Persistencia de la configuracion y auditoria del modulo Debida Diligencia. */
export interface IDdConfiguracionRepository {
  obtener(): Promise<DdConfiguracionEntity | null>;
  guardar(data: DdConfiguracionData): Promise<DdConfiguracionEntity>;
  listarAuditoria(limit: number): Promise<DdAuditoriaItem[]>;
  registrarAuditoria(accion: string, actor: string, mensaje: string): Promise<void>;
}
