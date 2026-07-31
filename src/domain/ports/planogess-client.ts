export interface IPlanogessClient {
  fetchStands(tipoEvento: number, codigoEvento: number): Promise<Record<string, unknown>[]>;
}
