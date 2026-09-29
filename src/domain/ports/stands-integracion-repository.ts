import type {
  StandExhibidoraDTO,
  ContratoStandDTO,
  EmpresaMontajistaDTO,
  AsignarMontajistaInput,
  AsignacionMontajistaDTO,
} from "@/types/dto/stands/stands-integracion.dto";

export interface IStandsIntegracionRepository {
  listarStandsExhibidora(empresaId: string, tipoEvento?: number, codigoEvento?: number): Promise<StandExhibidoraDTO[]>;
  listarContratos(tipoEvento?: number, codigoEvento?: number): Promise<ContratoStandDTO[]>;

  /** Asigna/reemplaza/desasigna la montajista de un stand. null = stand no encontrado. */
  asignarMontajista(input: AsignarMontajistaInput, createdBy: string): Promise<AsignacionMontajistaDTO | null>;

  /** Catalogo de montajistas: las ya asignadas y, si hay `search`, tambien las del SIE. */
  listarEmpresasMontajistas(search?: string): Promise<EmpresaMontajistaDTO[]>;

  /** true si el cliente (userId/email) tiene una reserva PAGADA vigente para ese stand. */
  esReservaPagadaDelCliente(input: AsignarMontajistaInput, ident: { userId?: string | null; email?: string | null }): Promise<boolean>;
}
