export interface ApiEventType {
  code: number;
  event: string;
}

export interface ApiEvent {
  codeEvent: number;
  event: string;
  inicio: string;
  fin: string;
  active: boolean;
}

export interface IKbServiciosClient {
  listarTiposEvento(): Promise<ApiEventType[]>;
  listarEventos(code: number): Promise<ApiEvent[]>;
}
