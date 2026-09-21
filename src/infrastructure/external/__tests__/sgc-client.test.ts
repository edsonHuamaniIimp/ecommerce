import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SgcClient } from "../sgc-client";
import { SgcApiError } from "@/domain/models/sgc";
import { HTTP_METHODS, SGC_API_PATHS, SGC_APPROVAL_RESULT, SGC_DOCUMENT_CATEGORIES } from "@/lib/shared/constants";

const API_URL = "https://sgc.local/api/integrations/v1";
const API_KEY = "sgc_test";
const CFG = { apiUrl: API_URL, apiKey: API_KEY, timeoutMs: 5000 };
const CONTRACT_ID = "c1";
const VERSION_ID = "v1";

function respuesta(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SgcClient", () => {
  it("crearExpediente envia Bearer + Idempotency-Key al endpoint de contratos", async () => {
    vi.mocked(fetch).mockResolvedValue(respuesta(201, { contractId: CONTRACT_ID, status: "created" }) as unknown as Response);
    const client = new SgcClient(CFG);

    const res = await client.crearExpediente(
      { code: "STAND-1", areaCode: "EVENTOS", contractTypeCode: "AUSPICIO", name: "x", counterpartyLegalName: "y", counterpartyTaxIdentifier: "", processOrigin: "ContratosStands" },
      "stands/reserva/sol-1",
    );

    expect(res.contractId).toBe(CONTRACT_ID);
    expect(fetch).toHaveBeenCalledWith(
      `${API_URL}${SGC_API_PATHS.CONTRACTS}`,
      expect.objectContaining({
        method: HTTP_METHODS.POST,
        headers: expect.objectContaining({ Authorization: `Bearer ${API_KEY}`, "Idempotency-Key": "stands/reserva/sol-1" }),
      }),
    );
  });

  it("consultarExpediente hace GET con Bearer", async () => {
    vi.mocked(fetch).mockResolvedValue(respuesta(200, { contractId: CONTRACT_ID, code: "STAND-1", steps: [], history: [], documents: [] }) as unknown as Response);
    const client = new SgcClient(CFG);

    const res = await client.consultarExpediente(CONTRACT_ID);

    expect(res.contractId).toBe(CONTRACT_ID);
    expect(fetch).toHaveBeenCalledWith(
      `${API_URL}${SGC_API_PATHS.CONTRACT(CONTRACT_ID)}`,
      expect.objectContaining({ method: HTTP_METHODS.GET }),
    );
  });

  it("lanza SgcApiError ante respuesta no-ok", async () => {
    vi.mocked(fetch).mockResolvedValue(respuesta(404, { message: "no existe" }) as unknown as Response);
    const client = new SgcClient(CFG);

    await expect(client.consultarExpediente("nope")).rejects.toBeInstanceOf(SgcApiError);
  });

  it("reservarSubida hace POST al endpoint de documentos del contrato", async () => {
    vi.mocked(fetch).mockResolvedValue(respuesta(201, { uploadUrl: "https://s3/u", headers: {}, documentId: "d1", versionId: VERSION_ID, versionNumber: 1, expiresInSeconds: 300 }) as unknown as Response);
    const client = new SgcClient(CFG);

    const res = await client.reservarSubida(CONTRACT_ID, {
      category: SGC_DOCUMENT_CATEGORIES.CONTRACT,
      title: "Contrato",
      fileName: "c.pdf",
      sizeBytes: 10,
      checksumSha256: "a".repeat(64),
      declaredMimeType: "application/pdf",
    });

    expect(res.documentId).toBe("d1");
    expect(fetch).toHaveBeenCalledWith(
      `${API_URL}${SGC_API_PATHS.CONTRACT_DOCUMENTS(CONTRACT_ID)}`,
      expect.objectContaining({ method: HTTP_METHODS.POST }),
    );
  });

  it("transferirArchivo hace PUT al uploadUrl con los headers dados", async () => {
    vi.mocked(fetch).mockResolvedValue(respuesta(200, {}) as unknown as Response);
    const client = new SgcClient(CFG);
    const uploadUrl = "https://s3/u";
    const headers = { "content-type": "application/pdf" };

    await client.transferirArchivo(uploadUrl, headers, new Uint8Array([1, 2, 3]));

    expect(fetch).toHaveBeenCalledWith(uploadUrl, expect.objectContaining({ method: HTTP_METHODS.PUT, headers }));
  });

  it("confirmarSubida con 422 devuelve rejected sin lanzar", async () => {
    vi.mocked(fetch).mockResolvedValue(respuesta(422, { outcome: "rejected", message: "checksum" }) as unknown as Response);
    const client = new SgcClient(CFG);

    const res = await client.confirmarSubida(VERSION_ID);

    expect(res.outcome).toBe(SGC_APPROVAL_RESULT.REJECTED);
    expect(fetch).toHaveBeenCalledWith(
      `${API_URL}${SGC_API_PATHS.DOCUMENT_VERSION_COMPLETE(VERSION_ID)}`,
      expect.objectContaining({ method: HTTP_METHODS.POST }),
    );
  });

  it("obtenerUrlDescarga hace GET al endpoint de descarga", async () => {
    vi.mocked(fetch).mockResolvedValue(respuesta(200, { url: "https://s3/d", expiresInSeconds: 60 }) as unknown as Response);
    const client = new SgcClient(CFG);

    const res = await client.obtenerUrlDescarga(VERSION_ID);

    expect(res.url).toBe("https://s3/d");
    expect(fetch).toHaveBeenCalledWith(
      `${API_URL}${SGC_API_PATHS.DOCUMENT_VERSION_DOWNLOAD(VERSION_ID)}`,
      expect.objectContaining({ method: HTTP_METHODS.GET }),
    );
  });
});
