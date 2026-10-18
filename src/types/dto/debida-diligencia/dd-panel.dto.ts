import type { DdEmpresaDTO } from "./dd-expediente.dto";

export interface DdPanelKpisDTO {
  total: number;
  aprobadasVigentes: number;
  porVencer: number;
  enRevision: number;
  observadas: number;
  rechazadas: number;
  pendientes: number;
  empresasRegistradas: number;
}

export interface DdPanelVinculoDTO {
  vinculo: string;
  label: string;
  total: number;
  aprobadas: number;
  observadas: number;
  pendientes: number;
}

export interface DdPanelVigenciaDTO {
  vigentes: number;
  porVencer: number;
  vencidas: number;
  total: number;
}

export interface DdMatrizRowDTO {
  id: string;
  empresa: DdEmpresaDTO;
  codigo: string | null;
  estado: string | null;
  tipoRelacionComercial: string | null;
  fechaAprobacion: string | null;
  fechaVencimiento: string | null;
  revisadoPor: string | null;
}

export interface DdPanelDTO {
  kpis: DdPanelKpisDTO;
  porVinculo: DdPanelVinculoDTO[];
  vigencia: DdPanelVigenciaDTO;
}
