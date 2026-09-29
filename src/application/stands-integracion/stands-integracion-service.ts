import type { IStandsIntegracionRepository } from "@/domain/ports/stands-integracion-repository";
import type {
  StandExhibidoraDTO,
  ContratoStandDTO,
  EmpresaMontajistaDTO,
  AsignarMontajistaInput,
  AsignacionMontajistaDTO,
} from "@/types/dto/stands/stands-integracion.dto";

export class StandsIntegracionApplicationService {
  constructor(private readonly repo: IStandsIntegracionRepository) {}

  async listarStandsExhibidora(empresaId: string, tipoEvento?: number, codigoEvento?: number): Promise<StandExhibidoraDTO[]> {
    return this.repo.listarStandsExhibidora(empresaId, tipoEvento, codigoEvento);
  }

  /** Asigna/reemplaza/desasigna la empresa montajista de un stand (null = no encontrado). */
  async asignarMontajista(input: AsignarMontajistaInput, createdBy: string): Promise<AsignacionMontajistaDTO | null> {
    return this.repo.asignarMontajista(input, createdBy);
  }

  /** Catalogo de montajistas (asignadas + busqueda en SIE). */
  async listarEmpresasMontajistas(search?: string): Promise<EmpresaMontajistaDTO[]> {
    return this.repo.listarEmpresasMontajistas(search);
  }

  /** true si el cliente (userId/email) puede asignar la montajista de ese stand (reserva pagada propia). */
  async clientePuedeAsignar(input: AsignarMontajistaInput, ident: { userId?: string | null; email?: string | null }): Promise<boolean> {
    return this.repo.esReservaPagadaDelCliente(input, ident);
  }

  async listarContratos(tipoEvento?: number, codigoEvento?: number): Promise<ContratoStandDTO[]> {
    return this.repo.listarContratos(tipoEvento, codigoEvento);
  }
}
