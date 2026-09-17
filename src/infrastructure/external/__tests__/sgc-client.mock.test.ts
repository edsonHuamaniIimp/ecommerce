import { describe, it, expect } from "vitest";
import { SgcClientMock } from "../sgc-client.mock";
import { SgcApiError } from "@/domain/models/sgc";
import type { SgcCrearExpedienteInput, SgcReservarSubidaInput } from "@/domain/models/sgc";
import { SGC_APPROVAL_RESULT, SGC_CREATE_STATUS, SGC_DOCUMENT_CATEGORIES } from "@/lib/shared/constants";

function expedienteInput(): SgcCrearExpedienteInput {
  return {
    code: "STAND-2026-0042",
    areaCode: "EVENTOS",
    contractTypeCode: "AUSPICIO",
    name: "Separacion de stand - Expo Minera 2026",
    counterpartyLegalName: "Expositor S.A.C.",
    counterpartyTaxIdentifier: "20123456789",
    processOrigin: "ContratosStands",
  };
}

function subidaInput(documentId: string | null = null): SgcReservarSubidaInput {
  return {
    category: SGC_DOCUMENT_CATEGORIES.CONTRACT,
    title: "Contrato de separacion de stand v1",
    fileName: "contrato-stand-0042.pdf",
    sizeBytes: 245678,
    checksumSha256: "a".repeat(64),
    declaredMimeType: "application/pdf",
    documentId,
  };
}

describe("SgcClientMock", () => {
  it("deberia crear un expediente y devolver contractId", async () => {
    const client = new SgcClientMock();
    const res = await client.crearExpediente(expedienteInput(), "stands/reserva/s1");
    expect(res.contractId).toBeTruthy();
    expect(res.status).toBe(SGC_CREATE_STATUS.CREATED);
  });

  it("deberia ser idempotente por Idempotency-Key", async () => {
    const client = new SgcClientMock();
    const a = await client.crearExpediente(expedienteInput(), "stands/reserva/s1");
    const b = await client.crearExpediente(expedienteInput(), "stands/reserva/s1");
    expect(b.contractId).toBe(a.contractId);
  });

  it("deberia consultar un expediente recien creado sin ronda (steps vacio)", async () => {
    const client = new SgcClientMock();
    const { contractId } = await client.crearExpediente(expedienteInput(), "k1");
    const exp = await client.consultarExpediente(contractId);
    expect(exp.code).toBe("STAND-2026-0042");
    expect(exp.steps).toEqual([]);
    expect(exp.documents).toEqual([]);
  });

  it("deberia lanzar SgcApiError 404 al consultar un expediente inexistente", async () => {
    const client = new SgcClientMock();
    await expect(client.consultarExpediente("no-existe")).rejects.toBeInstanceOf(SgcApiError);
  });

  it("deberia reservar la subida de un documento nuevo", async () => {
    const client = new SgcClientMock();
    const { contractId } = await client.crearExpediente(expedienteInput(), "k2");
    const r = await client.reservarSubida(contractId, subidaInput());
    expect(r.documentId).toBeTruthy();
    expect(r.versionId).toBeTruthy();
    expect(r.versionNumber).toBe(1);
    expect(r.expiresInSeconds).toBeGreaterThan(0);
    expect(r.headers["x-amz-meta-checksum-sha256"]).toBe("a".repeat(64));
  });

  it("deberia crear una version nueva sobre el mismo documentId", async () => {
    const client = new SgcClientMock();
    const { contractId } = await client.crearExpediente(expedienteInput(), "k3");
    const v1 = await client.reservarSubida(contractId, subidaInput());
    const v2 = await client.reservarSubida(contractId, subidaInput(v1.documentId));
    expect(v2.documentId).toBe(v1.documentId);
    expect(v2.versionNumber).toBe(2);
  });

  it("deberia confirmar una subida como aceptada", async () => {
    const client = new SgcClientMock();
    const { contractId } = await client.crearExpediente(expedienteInput(), "k4");
    const r = await client.reservarSubida(contractId, subidaInput());
    const c = await client.confirmarSubida(r.versionId);
    expect(c.outcome).toBe(SGC_APPROVAL_RESULT.ACCEPTED);
  });

  it("deberia devolver una url de descarga de vida corta", async () => {
    const client = new SgcClientMock();
    const { contractId } = await client.crearExpediente(expedienteInput(), "k5");
    const r = await client.reservarSubida(contractId, subidaInput());
    const d = await client.obtenerUrlDescarga(r.versionId);
    expect(d.url).toContain(r.versionId);
    expect(d.expiresInSeconds).toBeGreaterThan(0);
  });
});
