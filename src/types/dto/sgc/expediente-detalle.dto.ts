export interface SgcCompletedByDTO {
  actorName: string;
  areaName: string;
  completedAt: string;
  constancy: string;
}

export interface SgcStepDTO {
  code: string;
  name: string;
  kind: string;
  position: number;
  status: string;
  areaId: string | null;
  completedBy: SgcCompletedByDTO | null;
}

export interface SgcHistoryItemDTO {
  id: string;
  source: string;
  title: string;
  detail: string;
  actorName: string;
  occurredAt: string;
}

export interface SgcDocumentoResumenDTO {
  documentId: string;
  category: string;
  title: string;
  currentVersionId: string | null;
}

export interface SgcExpedienteDetalleDTO {
  contractId: string;
  code: string;
  name: string;
  stage: string;
  lifecycleStatus: string | null;
  areaName: string | null;
  contractTypeName: string | null;
  counterpartyName: string | null;
  counterpartyEmail: string | null;
  counterpartyTaxIdentifier: string | null;
  currency: string | null;
  totalMinorUnits: number | null;
  startDate: string | null;
  endDate: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  documents: SgcDocumentoResumenDTO[];
  steps: SgcStepDTO[];
  history: SgcHistoryItemDTO[];
}
