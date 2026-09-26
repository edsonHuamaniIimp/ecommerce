import { describe, it, expect } from "vitest";
import { construirCodigoExpediente, mapSolicitudToExpediente } from "../sgc";
import type { SolicitudRow } from "@/domain/models/entities";
import { SGC_CODE_PREFIX, SGC_PROCESS_ORIGIN } from "@/lib/shared/constants";

function detalle(overrides: Partial<SolicitudRow> = {}): SolicitudRow {
  return {
    id: "abcdef12-3456-4789-8abc-def012345678",
    gessStandId: "g1",
    standCode: "STAND-2026-0042",
    standCodes: ["STAND-2026-0042"],
    tipoStand: null,
    medidas: null,
    empresa: "Expositor S.A.C.",
    email: null,
    userId: null,
    bloqueId: null,
    estado: null,
    estadoSolicitud: "aprobado",
    flgActivo: true,
    documentos: [],
    imagenes: [],
    docsAdjuntosCount: 0,
    clienteDocsAdjuntosCount: 0,
    docsAdminCount: 0,
    docsAdjuntos: [],
    updatedAt: new Date("2026-09-15T00:00:00.000Z"),
    revisiones: [],
    reevaluaciones: [],
    revisionComunicacion: null,
    revisionLegal: null,
    revisionLogistica: null,
    tieneFacturacion: false,
    tipoFacturacion: null,
    facturacionId: null,
    sgcEstadoEnvio: null,
    sgcLifecycleStatus: null,
    sgcStage: null,
    sgcSubsanacionMotivo: null,
    sgcDocumentosEnviados: false,
    sgcEnabled: false,
    ...overrides,
  };
}

describe("construirCodigoExpediente", () => {
  it("deberia usar el standCode cuando hay un solo stand", () => {
    expect(construirCodigoExpediente(detalle())).toBe("STAND-2026-0042");
  });

  it("deberia usar correlativo cuando hay varios stands", () => {
    const d = detalle({ standCodes: ["A", "B"] });
    expect(construirCodigoExpediente(d)).toBe(`${SGC_CODE_PREFIX}-abcdef12`);
  });
});

describe("mapSolicitudToExpediente", () => {
  it("deberia mapear catalogo, nombre y contraparte", () => {
    const out = mapSolicitudToExpediente(detalle(), { areaCode: "EVENTOS", contractTypeCode: "AUSPICIO" });
    expect(out).toMatchObject({
      code: "STAND-2026-0042",
      areaCode: "EVENTOS",
      contractTypeCode: "AUSPICIO",
      counterpartyLegalName: "Expositor S.A.C.",
      processOrigin: SGC_PROCESS_ORIGIN,
    });
    expect(out.name).toContain("STAND-2026-0042");
  });

  it("deberia usar el standCode como contraparte si no hay empresa", () => {
    const d = detalle({ empresa: null });
    expect(mapSolicitudToExpediente(d, { areaCode: "E", contractTypeCode: "T" }).counterpartyLegalName).toBe("STAND-2026-0042");
  });
});
